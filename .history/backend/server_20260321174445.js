const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mindee = require('mindee');
const supabase = require('./db');
const authRoutes = require('./routes/auth'); // Import Auth Routes

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS', 'PATCH'] }));
app.use(express.json());

// Mount the authentication routes
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.status(200).send('✅ Nestle Finance Enterprise API is Online');
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
// 🏢 AI EXTRACTION & AUTO-SAVE
// ==========================================

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const mindeeClient = new mindee.Client({ apiKey: process.env.MINDEE_V2_API_KEY });
        const inputSource = new mindee.BufferInput({ buffer: req.file.buffer, filename: req.file.originalname || 'invoice.pdf' });
        const response = await mindeeClient.enqueueAndGetResult(mindee.product.Extraction, inputSource, { modelId: "b3467dd3-63d2-4914-9791-a2dfadfbfe9a" });

        const rawFields = response.document?.inference?.prediction?.fields || {};
        const pureJson = cleanMindeeObject(rawFields);

        const getSafeString = (val) => {
            if (!val) return null;
            if (typeof val === 'string' || typeof val === 'number') return String(val).trim();
            if (typeof val === 'object') {
                if (val.value !== undefined) return String(val.value).trim();
                if (val.items && val.items.length > 0) return getSafeString(val.items[0]);
                if (val.fields) return getSafeString(val.fields);
            }
            return null;
        };

        const getNum = (val) => {
            const str = getSafeString(val);
            return str ? parseFloat(str.replace(/[^0-9.-]+/g, "")) || 0.00 : 0.00;
        };

        const rawItems = pureJson.line_items?.items || [];
        const mappedLineItems = rawItems.map(item => {
            const f = item.fields || item;
            return {
                qty: getSafeString(f.quantity) || '1',
                description: getSafeString(f.description) || 'Item',
                unitPrice: getNum(f.unit_price),
                amount: getNum(f.total_price) || getNum(f.amount)
            };
        });

        const extractedData = {
            vendorName: getSafeString(pureJson.supplier_name) || 'Unknown Vendor',
            vendorAddress: getSafeString(pureJson.supplier_address) || 'Not Found',
            invoiceNumber: getSafeString(pureJson.invoice_number) || 'Not Found',
            invoiceDate: getSafeString(pureJson.date) || 'Not Found',
            poNumber: getSafeString(pureJson.po_number) || 'Not Found',
            dueDate: getSafeString(pureJson.due_date) || 'Not Found',
            billTo: getSafeString(pureJson.customer_address) || 'Not Found',
            shipTo: getSafeString(pureJson.shipping_address) || 'Not Found',
            subtotal: getNum(pureJson.total_net),
            salesTax: getNum(pureJson.total_tax),
            totalAmount: getNum(pureJson.total_amount),
            lineItems: mappedLineItems
        };

        res.json({ success: true, extractedData });
    } catch (error) {
        console.error('❌ Extraction Error:', error.message);
        res.status(500).json({ error: 'Invoice processing failed' });
    }
});

app.post('/api/save-reconciliation', async (req, res) => {
    const { invoiceData, poData, matchStatus } = req.body;
    try {
        await supabase.from('invoices').insert([{ invoice_number: invoiceData.invoiceNumber, extracted_amount: invoiceData.totalAmount, status: matchStatus }]);
        await supabase.from('purchase_orders').insert([{ po_number: poData.poNumber !== 'Not Found' ? poData.poNumber : invoiceData.invoiceNumber, total_amount: poData.totalAmount, status: matchStatus }]);

        const { error: reconErr } = await supabase.from('reconciliations').insert([{
            vendor_name: invoiceData.vendorName, invoice_number: invoiceData.invoiceNumber, po_number: poData.poNumber !== 'Not Found' ? poData.poNumber : invoiceData.invoiceNumber,
            invoice_total: invoiceData.totalAmount, po_total: poData.totalAmount, match_status: matchStatus, processed_at: new Date().toISOString()
        }]);

        if (invoiceData.lineItems && invoiceData.lineItems.length > 0) {
            const productEntries = invoiceData.lineItems.map(item => ({
                item_description: item.description, quantity: parseInt(item.qty) || 1, unit_price: parseFloat(item.unitPrice) || 0, total_price: parseFloat(item.amount) || 0
            }));
            await supabase.from('products').insert(productEntries);
        }

        if (reconErr) throw reconErr;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Database save failed' });
    }
});

// ==========================================
// 📋 FINANCE PORTAL QUEUE & ANALYTICS
// ==========================================

app.get('/api/reconciliations', async (req, res) => {
    try {
        const { data, error } = await supabase.from('reconciliations').select('*').order('processed_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch ledger' });
    }
});

app.patch('/api/reconciliations/:id', async (req, res) => {
    const { id } = req.params;
    const { newStatus } = req.body;
    try {
        const { error } = await supabase.from('reconciliations').update({ match_status: newStatus }).eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Status update failed' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Nestle Finance ERP Backend LIVE on port ${port}`);
});