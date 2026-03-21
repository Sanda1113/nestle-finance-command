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

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS', 'PATCH'] }));
app.use(express.json());
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.status(200).send('✅ Nestle Finance Enterprise API is Online');
});

const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// 🏢 AI EXTRACTION & AUTO-SAVE
// ==========================================

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const mindeeClient = new mindee.Client({ apiKey: process.env.MINDEE_V2_API_KEY });
        const inputSource = new mindee.BufferInput({ buffer: req.file.buffer, filename: req.file.originalname || 'invoice.pdf' });

        const response = await mindeeClient.enqueueAndGetResult(
            mindee.product.Extraction,
            inputSource,
            { modelId: "b3467dd3-63d2-4914-9791-a2dfadfbfe9a" }
        );

        // 🛡️ SAFELY PARSE MINDEE V5 CUSTOM MODEL PAYLOAD
        const rawFields = response.document?.inference?.prediction?.fields || response.inference?.result?.fields || {};

        // A much safer string extractor that looks for specific Mindee object keys
        const getSafeString = (field) => {
            if (!field) return null;
            if (typeof field === 'string' || typeof field === 'number') return String(field).trim();
            if (field.value !== undefined && field.value !== null) return String(field.value).trim();
            if (field.content !== undefined && field.content !== null) return String(field.content).trim();
            if (field.values && Array.isArray(field.values) && field.values.length > 0) return getSafeString(field.values[0]);
            return null;
        };

        const getNum = (field) => {
            const str = getSafeString(field);
            if (!str) return 0.00;
            const cleanVal = str.replace(/[^0-9.-]+/g, "");
            return parseFloat(cleanVal) || 0.00;
        };

        // Custom logic to handle Mindee's array-based line items safely
        const extractLineItems = (lineItemsObj) => {
            if (!lineItemsObj) return [];
            // Mindee sometimes puts items in `.items` or `.values`
            const itemsArray = lineItemsObj.items || lineItemsObj.values || lineItemsObj;
            if (!Array.isArray(itemsArray)) return [];

            return itemsArray.map(item => {
                const f = item.fields || item.values || item;
                return {
                    qty: getSafeString(f.quantity) || '1',
                    description: getSafeString(f.description) || getSafeString(f.item_description) || 'Item',
                    unitPrice: getNum(f.unit_price),
                    amount: getNum(f.total_price) || getNum(f.amount) || getNum(f.total_amount)
                };
            });
        };

        const mappedLineItems = extractLineItems(rawFields.line_items);

        const extractedData = {
            vendorName: getSafeString(rawFields.supplier_name) || getSafeString(rawFields.vendor_name) || 'Unknown Vendor',
            vendorAddress: getSafeString(rawFields.supplier_address) || getSafeString(rawFields.vendor_address) || 'Not Found',
            invoiceNumber: getSafeString(rawFields.invoice_number) || 'Not Found',
            invoiceDate: getSafeString(rawFields.date) || getSafeString(rawFields.invoice_date) || 'Not Found',
            poNumber: getSafeString(rawFields.po_number) || getSafeString(rawFields.reference_numbers) || 'Not Found',
            dueDate: getSafeString(rawFields.due_date) || 'Not Found',
            billTo: getSafeString(rawFields.customer_address) || getSafeString(rawFields.customer_name) || 'Not Found',
            shipTo: getSafeString(rawFields.shipping_address) || 'Not Found',
            subtotal: getNum(rawFields.total_net) || getNum(rawFields.subtotal),
            salesTax: getNum(rawFields.total_tax) || getNum(rawFields.tax),
            totalAmount: getNum(rawFields.total_amount) || getNum(rawFields.total),
            lineItems: mappedLineItems
        };

        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('❌ Extraction Error:', error.message);
        res.status(500).json({ error: 'Invoice processing failed' });
    }
});

// ==========================================
// 🛡️ DATABASE PIPELINE
// ==========================================

app.post('/api/save-reconciliation', async (req, res) => {
    const { invoiceData, poData, matchStatus } = req.body;
    try {
        await supabase.from('invoices').insert([{
            invoice_number: invoiceData.invoiceNumber,
            extracted_amount: invoiceData.totalAmount,
            status: matchStatus
        }]);

        await supabase.from('purchase_orders').insert([{
            po_number: poData.poNumber !== 'Not Found' ? poData.poNumber : invoiceData.invoiceNumber,
            total_amount: poData.totalAmount,
            status: matchStatus
        }]);

        const { error: reconErr } = await supabase.from('reconciliations').insert([{
            vendor_name: invoiceData.vendorName,
            invoice_number: invoiceData.invoiceNumber,
            po_number: poData.poNumber !== 'Not Found' ? poData.poNumber : invoiceData.invoiceNumber,
            invoice_total: invoiceData.totalAmount,
            po_total: poData.totalAmount,
            match_status: matchStatus,
            processed_at: new Date().toISOString()
        }]);

        if (invoiceData.lineItems && invoiceData.lineItems.length > 0) {
            const productEntries = invoiceData.lineItems.map(item => ({
                item_description: item.description,
                quantity: parseInt(item.qty) || 1,
                unit_price: parseFloat(item.unitPrice) || 0,
                total_price: parseFloat(item.amount) || 0
            }));
            await supabase.from('products').insert(productEntries);
        }

        if (reconErr) throw reconErr;
        res.json({ success: true });
    } catch (error) {
        console.error('DB Save Error:', error);
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