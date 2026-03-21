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

// 🛡️ MINDEE MAP TO JSON CONVERTER
function mindeeToObject(obj) {
    if (obj === null || obj === undefined) return null;
    if (typeof obj.entries === 'function') {
        const out = {};
        for (const [key, val] of obj.entries()) {
            out[key] = mindeeToObject(val);
        }
        return out;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => mindeeToObject(item));
    }
    if (typeof obj === 'object') {
        const out = {};
        for (const key of Object.keys(obj)) {
            if (!key.startsWith('_') && key !== 'polygon' && key !== 'boundingBox' && key !== 'bounding_box' && key !== 'confidence') {
                out[key] = mindeeToObject(obj[key]);
            }
        }
        return out;
    }
    return obj;
}

// ==========================================
// 🏢 AI EXTRACTION & AUTO-SAVE
// ==========================================

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        console.log(`\n📄 --- Extracting Document: ${req.file.originalname} ---`);

        const mindeeClient = new mindee.Client({ apiKey: process.env.MINDEE_V2_API_KEY });
        const inputSource = new mindee.BufferInput({ buffer: req.file.buffer, filename: req.file.originalname || 'invoice.pdf' });

        const response = await mindeeClient.enqueueAndGetResult(
            mindee.product.Extraction,
            inputSource,
            { modelId: "b3467dd3-63d2-4914-9791-a2dfadfbfe9a" }
        );

        const rawPrediction = response.document?.inference?.prediction?.fields || response.inference?.result?.fields || {};
        const rawFields = mindeeToObject(rawPrediction);

        const getSafeString = (field) => {
            if (field === null || field === undefined) return null;
            if (typeof field === 'string' || typeof field === 'number') return String(field).trim();

            if (field.value !== undefined && field.value !== null) return String(field.value).trim();
            if (field.content !== undefined && field.content !== null) return String(field.content).trim();
            if (field.text !== undefined && field.text !== null) return String(field.text).trim();

            if (Array.isArray(field) && field.length > 0) return getSafeString(field[0]);

            if (field.values && Array.isArray(field.values) && field.values.length > 0) return getSafeString(field.values[0]);
            if (field.items && Array.isArray(field.items) && field.items.length > 0) return getSafeString(field.items[0]);

            if (typeof field === 'object') {
                if (field.name) return getSafeString(field.name);
                if (field.description) return getSafeString(field.description);
                if (field.address) return getSafeString(field.address);
                if (field.number) return getSafeString(field.number);
            }
            return null;
        };

        const getAddressText = (field) => {
            if (!field) return null;
            const str = getSafeString(field);
            if (str && str !== '[object Object]') return str;

            if (typeof field === 'object') {
                const target = field.value || field.fields || field;
                let parts = [];

                if (target.address) parts.push(getSafeString(target.address));
                else {
                    if (target.street_number) parts.push(getSafeString(target.street_number));
                    if (target.street_name) parts.push(getSafeString(target.street_name));
                }
                if (target.city) parts.push(getSafeString(target.city));
                if (target.state) parts.push(getSafeString(target.state));
                if (target.postal_code) parts.push(getSafeString(target.postal_code));
                if (target.country) parts.push(getSafeString(target.country));

                if (parts.length > 0) return parts.filter(Boolean).join(', ');

                const extractAllStrings = (obj) => {
                    let strings = [];
                    for (const key in obj) {
                        if (typeof obj[key] === 'string') strings.push(obj[key]);
                        else if (typeof obj[key] === 'object' && obj[key] !== null) strings.push(...extractAllStrings(obj[key]));
                    }
                    return strings;
                };
                const allStrings = extractAllStrings(target);
                if (allStrings.length > 0) return allStrings.join(', ');
            }
            return null;
        };

        const getNum = (field) => {
            const str = getSafeString(field);
            if (!str) return 0.00;
            const cleanVal = str.replace(/[^0-9.-]+/g, "");
            return parseFloat(cleanVal) || 0.00;
        };

        // 🚀 NEW: Currency Extractor
        const extractCurrency = (localeField) => {
            if (!localeField) return 'USD'; // Default fallback
            const target = localeField.value || localeField.fields || localeField;
            if (target.currency) return getSafeString(target.currency) || 'USD';
            return 'USD';
        };

        const extractLineItems = (lineItemsObj) => {
            if (!lineItemsObj) return [];

            let itemsArray = [];

            if (lineItemsObj.items && typeof lineItemsObj.items === 'object') {
                itemsArray = Array.isArray(lineItemsObj.items) ? lineItemsObj.items : Object.values(lineItemsObj.items);
            }
            else if (lineItemsObj.values && typeof lineItemsObj.values === 'object') {
                itemsArray = Array.isArray(lineItemsObj.values) ? lineItemsObj.values : Object.values(lineItemsObj.values);
            }
            else if (Array.isArray(lineItemsObj)) {
                itemsArray = lineItemsObj;
            }
            else if (typeof lineItemsObj === 'object') {
                itemsArray = Object.values(lineItemsObj);
            }

            if (!Array.isArray(itemsArray)) return [];

            return itemsArray.map(item => {
                const f = item.value || item.fields || item;
                return {
                    qty: getSafeString(f?.quantity) || '1',
                    description: getSafeString(f?.description) || getSafeString(f?.item_description) || getSafeString(f) || 'Unknown Item',
                    unitPrice: getNum(f?.unit_price),
                    amount: getNum(f?.total_price) || getNum(f?.amount) || getNum(f?.total_amount)
                };
            }).filter(item => item.description !== 'Unknown Item' || item.amount > 0);
        };

        const getRefNumbers = (field) => {
            if (!field) return null;
            if (Array.isArray(field) && field.length > 0) return getSafeString(field[0]);
            if (field.values && Array.isArray(field.values) && field.values.length > 0) return getSafeString(field.values[0]);
            return getSafeString(field);
        };

        const extractedData = {
            vendorName: getSafeString(rawFields.supplier_name) || getSafeString(rawFields.vendor_name) || 'Unknown Vendor',
            vendorAddress: getAddressText(rawFields.supplier_address) || getAddressText(rawFields.vendor_address) || 'Not Found',
            invoiceNumber: getSafeString(rawFields.invoice_number) || 'Not Found',
            invoiceDate: getSafeString(rawFields.date) || getSafeString(rawFields.invoice_date) || 'Not Found',
            poNumber: getRefNumbers(rawFields.po_number) || getRefNumbers(rawFields.reference_numbers) || 'Not Found',
            dueDate: getSafeString(rawFields.due_date) || 'Not Found',
            billTo: getAddressText(rawFields.customer_address) || getAddressText(rawFields.billing_address) || getSafeString(rawFields.customer_name) || 'Not Found',
            shipTo: getAddressText(rawFields.shipping_address) || 'Not Found',
            subtotal: getNum(rawFields.total_net) || getNum(rawFields.subtotal),
            salesTax: getNum(rawFields.total_tax) || getNum(rawFields.tax),
            totalAmount: getNum(rawFields.total_amount) || getNum(rawFields.total),
            currency: extractCurrency(rawFields.locale), // <--- Added Currency Here
            lineItems: extractLineItems(rawFields.line_items)
        };

        console.log(`✅ Success! Formatted Payload for ${extractedData.vendorName} - Total ${extractedData.currency} ${extractedData.totalAmount}`);
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
        console.error('❌ DB Save Error:', error.message);
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