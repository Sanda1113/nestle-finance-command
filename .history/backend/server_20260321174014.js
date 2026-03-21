const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mindee = require('mindee');
const supabase = require('./db');
const authRoutes = require('./routes/auth');

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const app = express();
const port = process.env.PORT || 8080;

// 🛡️ CORS configured to support all multi-portal methods (GET, POST, PATCH)
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS', 'PATCH'] }));
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send('✅ Nestle Finance Enterprise Backend is Awake!');
});

const upload = multer({ storage: multer.memoryStorage() });

// 🛡️ THE UNIVERSAL DECRYPTOR
function cleanMindeeObject(obj) {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (obj.values && Array.isArray(obj.values)) return obj.values.map(item => cleanMindeeObject(item));
    if (obj.value !== undefined && typeof obj.value !== 'object') return obj.value;
    if (obj.content !== undefined && typeof obj.content !== 'object') return obj.content;
    if (Array.isArray(obj)) return obj.map(item => cleanMindeeObject(item));
    if (typeof obj.entries === 'function') {
        const cleaned = {};
        for (const [key, val] of obj.entries()) {
            if (key !== 'polygon' && key !== 'confidence' && key !== 'boundingBox') cleaned[key] = cleanMindeeObject(val);
        }
        return cleaned;
    }
    const cleaned = {};
    let targetObj = obj.value && typeof obj.value === 'object' ? obj.value : obj;
    for (const key of Object.keys(targetObj)) {
        if (key !== 'polygon' && key !== 'confidence' && key !== 'boundingBox' && !key.startsWith('_')) {
            cleaned[key] = cleanMindeeObject(targetObj[key]);
        }
    }
    return cleaned;
}

// ==========================================
// 🏢 SUPPLIER PORTAL: EXTRACTION
// ==========================================

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const apiKey = process.env.MINDEE_V2_API_KEY;
        if (!apiKey) throw new Error("Missing MINDEE_V2_API_KEY.");

        const mindeeClient = new mindee.Client({ apiKey: apiKey });
        const inputSource = new mindee.BufferInput({
            buffer: req.file.buffer,
            filename: req.file.originalname || 'invoice.pdf'
        });

        const productParams = { modelId: "b3467dd3-63d2-4914-9791-a2dfadfbfe9a" };

        const response = await mindeeClient.enqueueAndGetResult(
            mindee.product.Extraction,
            inputSource,
            productParams
        );

        const rawFields = response.document?.inference?.prediction?.fields || response.inference?.result?.fields || {};
        const pureJson = cleanMindeeObject(rawFields);

        const getSafeString = (val) => {
            if (val === null || val === undefined) return null;
            if (typeof val === 'string' || typeof val === 'number') return String(val).trim();
            if (typeof val === 'object') {
                if (val.value !== undefined && val.value !== null) return String(val.value).trim();
                if (val.content !== undefined && val.content !== null) return String(val.content).trim();
                if (val.items && Array.isArray(val.items)) {
                    if (val.items.length === 0) return null;
                    return getSafeString(val.items[0]);
                }
                if (Array.isArray(val) && val.length > 0) return getSafeString(val[0]);
                if (val.fields) return getSafeString(val.fields);
            }
            return null;
        };

        const getNum = (val) => {
            const strVal = getSafeString(val);
            if (!strVal) return 0.00;
            const cleanVal = strVal.replace(/[^0-9.-]+/g, "");
            return parseFloat(cleanVal) || 0.00;
        };

        const getAddressText = (obj) => {
            if (!obj) return null;
            const str = getSafeString(obj);
            if (str) return str;
            if (obj.fields && obj.fields.address) return getSafeString(obj.fields.address);
            if (obj.address) return getSafeString(obj.address);
            return null;
        };

        const rawItems = pureJson.line_items?.items || [];
        const mappedLineItems = rawItems.map(item => {
            const f = item.fields || item;
            return {
                qty: getSafeString(f.quantity) || '1',
                description: getSafeString(f.description) || 'Item',
                unitPrice: `$${parseFloat(getSafeString(f.unit_price) || 0).toFixed(2)}`,
                amount: `$${parseFloat(getSafeString(f.total_price) || getSafeString(f.amount) || 0).toFixed(2)}`
            };
        });

        const rawBank = pureJson.supplier_payment_details?.items || [];
        let bankString = 'Not Found';
        if (rawBank.length > 0) {
            const bFields = rawBank[0].fields || rawBank[0];
            bankString = `Account: ${getSafeString(bFields.account_number) || 'N/A'}, Routing: ${getSafeString(bFields.routing_number) || 'N/A'}`;
        }

        const extractedData = {
            vendorName: getSafeString(pureJson.supplier_name) || 'Unknown Vendor',
            vendorAddress: getAddressText(pureJson.supplier_address) || 'Not Found',
            invoiceNumber: getSafeString(pureJson.invoice_number) || 'Not Found',
            invoiceDate: getSafeString(pureJson.date) || getSafeString(pureJson.invoice_date) || 'Not Found',
            poNumber: getSafeString(pureJson.po_number) || getSafeString(pureJson.reference_numbers) || 'Not Found',
            dueDate: getSafeString(pureJson.due_date) || 'Not Found',
            billTo: getAddressText(pureJson.customer_address) || getSafeString(pureJson.customer_name) || 'Not Found',
            shipTo: getAddressText(pureJson.shipping_address) || 'Not Found',
            subtotal: getNum(pureJson.total_net),
            salesTax: getNum(pureJson.total_tax),
            totalAmount: getNum(pureJson.total_amount),
            terms: 'Check Due Date',
            bankDetails: bankString,
            lineItems: mappedLineItems.length > 0 ? mappedLineItems : null
        };

        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('❌ Data extraction error:', error.message);
        res.status(500).json({ error: 'Invoice processing failed', details: error.message });
    }
});

// ==========================================
// 🛡️ DATA LOGGING (Saves to Supabase)
// ==========================================

app.post('/api/save-reconciliation', async (req, res) => {
    const { invoiceData, poData, matchStatus } = req.body;

    try {
        console.log(`💾 Auto-Saving to Database: ${matchStatus}`);

        // 1. Invoices Table
        const { error: invErr } = await supabase.from('invoices').insert([{
            invoice_number: invoiceData.invoiceNumber,
            extracted_amount: invoiceData.totalAmount,
            status: matchStatus
        }]);
        if (invErr) console.error("Invoice Insert Error:", invErr);

        // 2. Purchase Orders Table
        const { error: poErr } = await supabase.from('purchase_orders').insert([{
            po_number: poData.poNumber !== 'Not Found' ? poData.poNumber : poData.invoiceNumber,
            total_amount: poData.totalAmount,
            status: matchStatus
        }]);
        if (poErr) console.error("PO Insert Error:", poErr);

        // 3. Reconciliations Table (Primary table for Finance/Analytics Queue)
        const { error: reconErr } = await supabase.from('reconciliations').insert([{
            vendor_name: invoiceData.vendorName,
            invoice_number: invoiceData.invoiceNumber,
            po_number: poData.poNumber !== 'Not Found' ? poData.poNumber : poData.invoiceNumber,
            invoice_total: invoiceData.totalAmount,
            po_total: poData.totalAmount,
            match_status: matchStatus,
            processed_at: new Date().toISOString() // Added to ensure correct sorting in analytics
        }]);
        if (reconErr) throw reconErr;

        res.json({ success: true, message: 'Automatically saved to DB.' });
    } catch (error) {
        console.error('❌ DB Save Error:', error.message);
        res.status(500).json({ error: 'Failed to save to DB', details: error.message });
    }
});

// ==========================================
// 📈 FINANCE & ANALYTICS PORTAL ENDPOINTS
// ==========================================

// 1. Fetch all reconciliations for the Finance Dashboard
app.get('/api/reconciliations', async (req, res) => {
    try {
        console.log('📊 Fetching all reconciliations for Finance & Analytics...');
        const { data, error } = await supabase
            .from('reconciliations')
            .select('*')
            // This ensures your queue and analytics show the most recent documents first
            .order('id', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('❌ Fetch Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch data', details: error.message });
    }
});

// 2. Finance Team Manual Override (Approve/Reject)
app.patch('/api/reconciliations/:id', async (req, res) => {
    const { id } = req.params;
    const { newStatus } = req.body;

    try {
        console.log(`✍️ Finance Team manually updating Record ${id} to ${newStatus}`);
        const { data, error } = await supabase
            .from('reconciliations')
            .update({ match_status: newStatus })
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'Status updated successfully' });
    } catch (error) {
        console.error('❌ Update Error:', error.message);
        res.status(500).json({ error: 'Failed to update status', details: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Backend LIVE on port ${port}`);
});