const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mindee = require('mindee');

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send('✅ Nestle Finance Backend (Data Hunter Edition) is Awake!');
});

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        console.log('🚀 Sending to Mindee Custom Model...');

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

        // 1. Get the raw fields Map from the Custom Model
        const fields = response.document?.inference?.prediction?.fields || response.inference?.result?.fields || {};

        // 2. 🛡️ THE DATA HUNTER: Recursively digs out text from Mindee's custom classes
        const findValue = (obj) => {
            if (!obj) return null;
            if (typeof obj === 'string' || typeof obj === 'number') return obj;
            if (obj.content !== undefined) return obj.content;
            if (obj.value !== undefined) return obj.value;
            // For Nested Address Objects in your schema
            if (obj.address) return findValue(obj.address);
            // Dig into Arrays
            if (Array.isArray(obj) && obj.length > 0) return findValue(obj[0]);
            if (obj.values && Array.isArray(obj.values) && obj.values.length > 0) return findValue(obj.values[0]);
            return null;
        };

        const getVal = (key) => {
            let field = null;
            if (fields && typeof fields.get === 'function') field = fields.get(key);
            else if (fields) field = fields[key];
            return findValue(field);
        };

        const getNum = (key) => {
            const val = getVal(key);
            if (!val) return 0.00;
            const cleanVal = val.toString().replace(/[^0-9.-]+/g, "");
            return parseFloat(cleanVal) || 0.00;
        };

        // 3. 🚀 EXTRACT LINE ITEMS (Table Rows)
        let mappedLineItems = [];
        let rawLineItems = null;
        if (fields && typeof fields.get === 'function') rawLineItems = fields.get('line_items');
        else if (fields) rawLineItems = fields['line_items'];

        if (rawLineItems) {
            // Find the array holding the table rows
            let rows = [];
            if (Array.isArray(rawLineItems)) rows = rawLineItems;
            else if (Array.isArray(rawLineItems.values)) rows = rawLineItems.values;

            mappedLineItems = rows.map(row => {
                const getCol = (colKey) => {
                    let colData = null;
                    if (row && typeof row.get === 'function') colData = row.get(colKey);
                    else if (row) colData = row[colKey];
                    return findValue(colData);
                };

                return {
                    qty: getCol('quantity') || '1',
                    description: getCol('description') || 'Item',
                    unitPrice: `$${parseFloat(getCol('unit_price') || 0).toFixed(2)}`,
                    amount: `$${parseFloat(getCol('total_price') || 0).toFixed(2)}`
                };
            });
        }

        // 4. MAP TO NEHAA'S FRONTEND DASHBOARD
        const extractedData = {
            vendorName: getVal('supplier_name') || 'Unknown Vendor',
            vendorAddress: getVal('supplier_address') || 'Not Found',
            invoiceNumber: getVal('invoice_number') || 'Not Found',
            invoiceDate: getVal('date') || 'Not Found',
            poNumber: getVal('po_number') || 'Not Found',
            dueDate: getVal('due_date') || 'Not Found',
            billTo: getVal('customer_name') || 'Not Found',
            shipTo: getVal('shipping_address') || 'Not Found',
            subtotal: getNum('total_net'),
            salesTax: getNum('total_tax'),
            totalAmount: getNum('total_amount'),
            terms: 'Check Due Date',
            bankDetails: 'Securely Processed',
            lineItems: mappedLineItems.length > 0 ? mappedLineItems : null
        };

        console.log('✅ Extraction Complete! Sending to Frontend.');
        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('❌ Data extraction error:', error.message);
        res.status(500).json({ error: 'Invoice processing failed', details: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Backend LIVE on port ${port}`);
});