const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mindee = require('mindee');
const supabase = require('./db');
const authRoutes = require('./routes/auth');
const sprint2Routes = require('./routes/sprint2'); // Add this line
app.use('/api/sprint2', sprint2Routes);            // Add this line below your auth app.use
const xlsx = require('xlsx');

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

// 🛡️ MINDEE MAP TO JSON CONVERTER (UNTOUCHED)
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
// 🏢 AI EXTRACTION & AUTO-SAVE (UNTOUCHED MINDEE CORE)
// ==========================================

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        console.log(`\n📄 --- Extracting Document: ${req.file.originalname} ---`);

        const fileName = req.file.originalname.toLowerCase();

        // 🚀 NATIVE EXCEL & CSV HANDLER (Bypasses Mindee for raw tabular data)
        if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            console.log("📊 Excel/CSV Detected. Parsing natively...");
            let lineItems = [];
            let totalAmount = 0;

            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

            // Dynamically find columns that look like Description, Qty, and Price
            data.forEach((row, index) => {
                const values = Object.values(row);
                if (values.length >= 2) {
                    const desc = values.find(v => typeof v === 'string' && isNaN(v)) || `Item ${index + 1}`;
                    const numbers = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));

                    const qty = numbers.length > 1 ? numbers[0] : 1;
                    const price = numbers.length > 1 ? numbers[1] : (numbers[0] || 0);
                    const amount = qty * price;

                    if (price > 0) {
                        lineItems.push({ qty: qty.toString(), description: desc, unitPrice: price, amount: amount });
                        totalAmount += amount;
                    }
                }
            });

            return res.json({
                success: true,
                extractedData: {
                    vendorName: 'Supplier (Extracted via CSV)',
                    vendorAddress: 'Extracted from Tabular Data',
                    invoiceNumber: `DOC-${Date.now().toString().slice(-5)}`,
                    invoiceDate: new Date().toISOString().split('T')[0],
                    poNumber: 'Not Found',
                    dueDate: new Date().toISOString().split('T')[0],
                    billTo: 'Nestle Procurement',
                    shipTo: 'Nestle Warehouse',
                    subtotal: totalAmount,
                    salesTax: 0,
                    totalAmount: totalAmount,
                    currency: 'USD',
                    lineItems: lineItems
                }
            });
        }

        // 🛡️ --- UNTOUCHED MINDEE CORE BELOW ---
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
            const targetObj = Array.isArray(field) ? field[0] : field;
            if (!targetObj) return null;
            const str = getSafeString(targetObj);
            if (str && str !== '[object Object]') return str;

            if (typeof targetObj === 'object') {
                let parts = [];
                const target = targetObj.value || targetObj.fields || targetObj;

                if (target.address) {
                    const addrStr = getSafeString(target.address);
                    if (addrStr) parts.push(addrStr);
                }

                if (parts.length === 0) {
                    if (target.street_number) parts.push(getSafeString(target.street_number));
                    if (target.street_name) parts.push(getSafeString(target.street_name));
                    if (target.city) parts.push(getSafeString(target.city));
                    if (target.state) parts.push(getSafeString(target.state));
                    if (target.postal_code) parts.push(getSafeString(target.postal_code));
                    if (target.country) parts.push(getSafeString(target.country));
                }

                if (parts.length > 0) return parts.filter(Boolean).join(', ');
            }
            return null;
        };

        const getNum = (field) => {
            const str = getSafeString(field);
            if (!str) return 0.00;
            const cleanVal = str.replace(/[^0-9.-]+/g, "");
            return parseFloat(cleanVal) || 0.00;
        };

        const extractCurrency = (localeField) => {
            if (!localeField) return 'USD';
            const target = localeField.value || localeField.fields || localeField;
            if (target.currency) return getSafeString(target.currency) || 'USD';
            return 'USD';
        };

        const extractLineItems = (lineItemsObj) => {
            if (!lineItemsObj) return [];

            let itemsArray = [];
            if (lineItemsObj.items && typeof lineItemsObj.items === 'object') {
                itemsArray = Array.isArray(lineItemsObj.items) ? lineItemsObj.items : Object.values(lineItemsObj.items);
            } else if (lineItemsObj.values && typeof lineItemsObj.values === 'object') {
                itemsArray = Array.isArray(lineItemsObj.values) ? lineItemsObj.values : Object.values(lineItemsObj.values);
            } else if (Array.isArray(lineItemsObj)) {
                itemsArray = lineItemsObj;
            } else if (typeof lineItemsObj === 'object') {
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
            }).filter(item => item.amount > 0 || item.unitPrice > 0);
        };

        const getRefNumbers = (field) => {
            if (!field) return null;
            if (Array.isArray(field) && field.length > 0) return getSafeString(field[0]);
            if (field.values && Array.isArray(field.values) && field.values.length > 0) return getSafeString(field.values[0]);
            return getSafeString(field);
        }

        const extractedData = {
            vendorName: getSafeString(rawFields.supplier_name) || getSafeString(rawFields.vendor_name) || getSafeString(rawFields.customer_name) || 'Unknown Vendor',
            vendorAddress: getAddressText(rawFields.supplier_address) || getAddressText(rawFields.vendor_address) || 'Not Found',
            invoiceNumber: getSafeString(rawFields.invoice_number) || getSafeString(rawFields.document_number) || getSafeString(rawFields.po_number) || 'Not Found',
            invoiceDate: getSafeString(rawFields.date) || getSafeString(rawFields.invoice_date) || getSafeString(rawFields.issue_date) || new Date().toISOString().split('T')[0],
            poNumber: getRefNumbers(rawFields.po_number) || getRefNumbers(rawFields.reference_numbers) || 'Not Found',
            dueDate: getSafeString(rawFields.due_date) || 'Not Found',
            billTo: getAddressText(rawFields.customer_address) || getAddressText(rawFields.billing_address) || getSafeString(rawFields.customer_name) || 'Not Found',
            shipTo: getAddressText(rawFields.shipping_address) || 'Not Found',
            subtotal: getNum(rawFields.total_net) || getNum(rawFields.subtotal),
            salesTax: getNum(rawFields.total_tax) || getNum(rawFields.tax),
            totalAmount: getNum(rawFields.total_amount) || getNum(rawFields.total),
            currency: extractCurrency(rawFields.locale),
            lineItems: extractLineItems(rawFields.line_items)
        };

        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('❌ Extraction Error:', error.message);
        res.status(500).json({ error: 'Invoice processing failed' });
    }
});

// ==========================================
// 🛡️ RECONCILIATION & LOGGING
// ==========================================

app.post('/api/save-reconciliation', async (req, res) => {
    const { invoiceData, poData, matchStatus, supplierEmail } = req.body;
    try {
        await supabase.from('invoices').insert([{ invoice_number: invoiceData.invoiceNumber, extracted_amount: invoiceData.totalAmount, status: matchStatus }]);

        let timeline = matchStatus === 'Approved' ? 'Awaiting Payout' : 'Discrepancy - Manual Review';

        const { error: reconErr } = await supabase.from('reconciliations').insert([{
            vendor_name: invoiceData.vendorName,
            invoice_number: invoiceData.invoiceNumber,
            po_number: poData.poNumber !== 'Not Found' ? poData.poNumber : invoiceData.invoiceNumber,
            invoice_total: invoiceData.totalAmount,
            po_total: poData.totalAmount,
            match_status: matchStatus,
            timeline_status: timeline,
            supplier_email: supplierEmail,
            invoice_data: invoiceData,
            po_data: poData,
            processed_at: new Date().toISOString()
        }]);

        if (reconErr) throw reconErr;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Database save failed' });
    }
});

app.get('/api/reconciliations', async (req, res) => {
    try {
        const { data, error } = await supabase.from('reconciliations').select('*').order('processed_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) { res.status(500).json({ error: 'Failed to fetch ledger' }); }
});

app.patch('/api/reconciliations/:id', async (req, res) => {
    const { id } = req.params;
    const { newStatus } = req.body;
    try {
        let newTimeline = newStatus === 'Approved' ? 'Approved - Awaiting Payout' : 'Rejected by Finance';
        const { error } = await supabase.from('reconciliations').update({ match_status: newStatus, timeline_status: newTimeline }).eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Status update failed' }); }
});

// ==========================================
// 📦 BOQ TO PO PROCUREMENT PIPELINE
// ==========================================

app.post('/api/save-boq', async (req, res) => {
    const { boqData, supplierEmail, vendorId } = req.body;
    try {
        const { error } = await supabase.from('boqs').insert([{
            vendor_name: boqData.vendorName,
            document_number: boqData.invoiceNumber !== 'Not Found' ? boqData.invoiceNumber : `BOQ-${Date.now().toString().slice(-6)}`,
            total_amount: boqData.totalAmount,
            currency: boqData.currency,
            status: 'Pending Review',
            line_items: boqData.lineItems,
            supplier_email: supplierEmail,
            vendor_id: vendorId
        }]);

        if (error) throw error;
        res.json({ success: true, message: 'BOQ Saved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Database save failed' });
    }
});

app.get('/api/boqs', async (req, res) => {
    try {
        const { data, error } = await supabase.from('boqs').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch BOQs' });
    }
});

app.post('/api/boqs/:id/reject', async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    try {
        const { error } = await supabase.from('boqs').update({ status: 'Rejected', rejection_reason: reason }).eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reject BOQ' });
    }
});

app.post('/api/boqs/:id/generate-po', async (req, res) => {
    const { id } = req.params;
    try {
        const { data: boqData, error: fetchErr } = await supabase.from('boqs').select('*').eq('id', id).single();
        if (fetchErr) throw fetchErr;

        const generatedPoNumber = `PO-NESTLE-${Date.now().toString().slice(-5)}`;

        const formalPoData = {
            poNumber: generatedPoNumber,
            poDate: new Date().toISOString().split('T')[0],
            buyerCompany: "Nestle Global Procurement\n123 Corporate Blvd\nColombo, Sri Lanka",
            supplierDetails: `${boqData.vendor_name}\n${boqData.supplier_email}`,
            currency: boqData.currency,
            totalAmount: boqData.total_amount,
            lineItems: boqData.line_items,
            deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            deliveryLocation: "Nestle Main Warehouse, Colombo",
            paymentTerms: "Net 30"
        };

        await supabase.from('boqs').update({ status: `PO Generated: ${generatedPoNumber}` }).eq('id', id);

        const { error: poErr } = await supabase.from('purchase_orders').insert([{
            po_number: generatedPoNumber,
            total_amount: boqData.total_amount,
            status: 'Pending',
            supplier_email: boqData.supplier_email,
            po_data: formalPoData,
            is_downloaded: false
        }]);

        if (poErr) throw poErr;
        res.json({ success: true, poNumber: generatedPoNumber });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate PO' });
    }
});

app.get('/api/supplier/pos/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const { data, error } = await supabase.from('purchase_orders').select('*').eq('supplier_email', email).not('po_data', 'is', null).order('id', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) { res.status(500).json({ error: 'Failed to fetch POs' }); }
});

app.patch('/api/purchase_orders/:id/downloaded', async (req, res) => {
    const { id } = req.params;
    try {
        await supabase.from('purchase_orders').update({ is_downloaded: true }).eq('id', id);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Update failed' }); }
});

// ==========================================
// 🚀 THE UNIFIED SUPPLIER TIMELINE ENGINE
// ==========================================
app.get('/api/supplier/logs/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const { data: boqs } = await supabase.from('boqs').select('id, document_number, total_amount, status, created_at, vendor_name').eq('supplier_email', email);
        const { data: pos } = await supabase.from('purchase_orders').select('id, po_number, total_amount, status, created_at, is_downloaded').eq('supplier_email', email);
        const { data: recs } = await supabase.from('reconciliations').select('id, invoice_number, match_status, timeline_status, processed_at').eq('supplier_email', email);

        let logs = [];
        if (boqs) boqs.forEach(b => logs.push({ id: `boq-${b.id}`, date: b.created_at, type: 'BOQ / Quote', ref: b.document_number, status: b.status, action: 'Upload' }));
        if (pos) pos.forEach(p => logs.push({ id: `po-${p.id}`, date: p.created_at || new Date().toISOString(), type: 'Official PO Generated', ref: p.po_number, status: p.is_downloaded ? 'Downloaded' : 'Available', action: 'Procurement' }));
        if (recs) recs.forEach(r => logs.push({ id: `rec-${r.id}`, date: r.processed_at, type: 'Invoice Match Process', ref: r.invoice_number, status: r.timeline_status, action: 'System Verification' }));

        logs.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({ success: true, logs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Nestle Finance ERP Backend LIVE on port ${port}`);
});