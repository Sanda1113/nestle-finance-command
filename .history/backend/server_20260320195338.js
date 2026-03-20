const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mindee = require('mindee'); // Using the official V5 SDK

// Load .env in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send('✅ Nestle Finance Backend (Mindee Custom SDK) is Awake!');
});

// Use memory storage so we don't have to deal with fs/disk cleanup
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        console.log('🚀 Sending to Mindee Custom Model...');

        const apiKey = process.env.MINDEE_V2_API_KEY;
        if (!apiKey) throw new Error("Missing MINDEE_V2_API_KEY in environment variables.");

        // 1. Init the new V5 client
        const mindeeClient = new mindee.Client({ apiKey: apiKey });

        // 2. Load the file from the Multer buffer (bypassing the need for fs.writeFileSync)
        const inputSource = new mindee.BufferInput({
            buffer: req.file.buffer,
            filename: req.file.originalname || 'invoice.pdf'
        });

        // 3. Set product parameters using YOUR Custom Model ID
        const productParams = {
            modelId: "b3467dd3-63d2-4914-9791-a2dfadfbfe9a"
        };

        // 4. Send for processing using the exact async function from the docs
        const response = await mindeeClient.enqueueAndGetResult(
            mindee.product.Extraction,
            inputSource,
            productParams
        );

        // 5. Access the result fields as per documentation
        const fields = response.inference.result.fields;

        // --- HELPER FUNCTIONS FOR CUSTOM SCHEMA ---
        const getVal = (fieldName) => {
            const field = fields[fieldName];
            if (!field) return null;
            // Custom objects store the main string in .value or .content
            return field.value || field.content || null;
        };

        const getNum = (fieldName) => {
            const val = getVal(fieldName);
            return parseFloat(val) || 0.00;
        };

        // Map your Custom Line Items safely
        let mappedLineItems = [];
        if (fields.line_items && fields.line_items.values) {
            mappedLineItems = fields.line_items.values.map(item => ({
                qty: item.quantity?.toString() || '1',
                description: item.description || 'Item',
                unitPrice: `$${parseFloat(item.unit_price || 0).toFixed(2)}`,
                amount: `$${parseFloat(item.total_price || item.amount || 0).toFixed(2)}`
            }));
        }

        // 6. Map to Nehaa's Frontend Dashboard using your exact schema keys
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

        console.log('✅ Extraction Complete! Sending JSON to frontend.');
        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('❌ Mindee Custom SDK Error:', error);
        res.status(500).json({ error: 'Invoice processing failed', details: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Backend LIVE on port ${port}`);
});