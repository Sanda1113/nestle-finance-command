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
    res.status(200).send('✅ Nestle Finance Backend (Bulletproof Mindee SDK) is Awake!');
});

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        console.log('🚀 Sending to Mindee Custom Model...');

        const apiKey = process.env.MINDEE_V2_API_KEY;
        if (!apiKey) throw new Error("Missing MINDEE_V2_API_KEY in environment variables.");

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

        // 🛡️ BULLETPROOF DATA PATH (Prevents the 500 Server Crash)
        const inference = response.document?.inference || response.inference || {};
        const fields = inference.prediction?.fields || inference.result?.fields || inference.prediction || {};

        // 🔍 DEBUG X-RAY: This will print the exact field names to Railway logs
        console.log("🔥 RAW MINDEE FIELDS FOUND:", Object.keys(fields));

        // Safely extract values without crashing
        const getVal = (fieldName) => {
            const field = fields[fieldName];
            if (!field) return null;
            return field.value || field.content || field || null;
        };

        const getNum = (fieldName) => parseFloat(getVal(fieldName)) || 0.00;

        // Safely map arrays
        let mappedLineItems = [];
        const rawItems = fields.line_items?.values || fields.line_items?.elements || fields.line_items || [];

        if (Array.isArray(rawItems)) {
            mappedLineItems = rawItems.map(item => ({
                qty: item.quantity?.value || item.quantity || '1',
                description: item.description?.value || item.description || 'Item',
                unitPrice: `$${parseFloat(item.unit_price?.value || item.unit_price || 0).toFixed(2)}`,
                amount: `$${parseFloat(item.total_price?.value || item.amount?.value || item.total_price || item.amount || 0).toFixed(2)}`
            }));
        }

        const extractedData = {
            vendorName: getVal('supplier_name') || 'Unknown Vendor',
            vendorAddress: getVal('supplier_address') || 'Not Found',
            invoiceNumber: getVal('invoice_number') || 'Not Found',
            invoiceDate: getVal('date') || 'Not Found',
            poNumber: getVal('po_number') || getVal('reference_numbers') || 'Not Found',
            dueDate: getVal('due_date') || 'Not Found',
            billTo: getVal('customer_name') || 'Not Found',
            shipTo: getVal('shipping_address') || 'Not Found',
            subtotal: getNum('total_net'),
            salesTax: getNum('total_tax'),
            totalAmount: getNum('total_amount'),
            terms: 'Check Due Date',
            bankDetails: 'Not Found',
            lineItems: mappedLineItems.length > 0 ? mappedLineItems : null
        };

        console.log('✅ Extraction Complete!');
        res.json({ success: true, extractedData });

    } catch (error) {
        // If it still crashes, it will print the EXACT reason here instead of failing silently
        console.error('❌ CRASH ERROR:', error.message);
        res.status(500).json({ error: 'Invoice processing failed', details: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Backend LIVE on port ${port}`);
});