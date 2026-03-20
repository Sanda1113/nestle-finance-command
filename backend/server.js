const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mindee = require('mindee');

// Load .env in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send('✅ Nestle Finance Backend (Mindee Custom Schema) is Awake!');
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

        // Your exact Model ID
        const productParams = { modelId: "b3467dd3-63d2-4914-9791-a2dfadfbfe9a" };

        const response = await mindeeClient.enqueueAndGetResult(
            mindee.product.Extraction,
            inputSource,
            productParams
        );

        // 1. Get the Custom Model Fields Object
        const fields = response.inference.result.fields;

        // 2. 🛡️ SAFELY EXTRACT FROM MINDEE'S CUSTOM CLASS/MAP
        const getVal = (key) => {
            // Check if it's a Map using .get(), otherwise treat as an object
            const field = (typeof fields.get === 'function') ? fields.get(key) : fields[key];
            if (!field) return null;
            return field.value || field.content || field.text || null;
        };

        const getNum = (key) => {
            const val = getVal(key);
            if (!val) return 0.00;
            const cleanVal = val.toString().replace(/[^0-9.-]+/g, "");
            return parseFloat(cleanVal) || 0.00;
        };

        // 3. Map nested addresses and complex objects based on your schema
        const getAddress = (key) => {
            const field = (typeof fields.get === 'function') ? fields.get(key) : fields[key];
            if (!field) return 'Not Found';

            // Sometimes custom models store nested fields in a .values array or .address prop
            if (field.address) return field.address;
            if (field.value) return field.value;
            if (field.content) return field.content;

            // If it's a deeply nested object, just stringify the known text properties
            if (typeof field === 'object') {
                return [field.street_name, field.city, field.country].filter(Boolean).join(', ') || 'Not Found';
            }
            return 'Not Found';
        };

        // 4. Map Line Items Array
        let mappedLineItems = [];
        const rawLineItems = (typeof fields.get === 'function') ? fields.get('line_items') : fields['line_items'];
        const itemsArray = rawLineItems?.values || rawLineItems?.elements || rawLineItems || [];

        if (Array.isArray(itemsArray)) {
            mappedLineItems = itemsArray.map(item => {
                const getProp = (propKey) => {
                    const p = item[propKey] || (typeof item.get === 'function' ? item.get(propKey) : null);
                    return p?.value || p?.content || p || '';
                };
                return {
                    qty: getProp('quantity') || '1',
                    description: getProp('description') || 'Item',
                    unitPrice: `$${parseFloat(getProp('unit_price') || 0).toFixed(2)}`,
                    amount: `$${parseFloat(getProp('total_price') || 0).toFixed(2)}`
                };
            });
        }

        // 5. 🚀 EXACT MAPPING TO YOUR DATA-SCHEMA.JSON
        const extractedData = {
            vendorName: getVal('supplier_name') || 'Unknown Vendor',
            vendorAddress: getAddress('supplier_address'),
            invoiceNumber: getVal('invoice_number') || 'Not Found',
            invoiceDate: getVal('date') || 'Not Found',
            poNumber: getVal('po_number') || getVal('reference_numbers') || 'Not Found',
            dueDate: getVal('due_date') || 'Not Found',
            billTo: getVal('customer_name') || 'Not Found',
            shipTo: getAddress('shipping_address') || 'Not Found',
            subtotal: getNum('total_net'),
            salesTax: getNum('total_tax'),
            totalAmount: getNum('total_amount'),
            terms: 'Check Due Date',
            bankDetails: 'Processed Securely',
            lineItems: mappedLineItems.length > 0 ? mappedLineItems : null
        };

        console.log('✅ Extraction Complete! Data:', JSON.stringify(extractedData, null, 2));
        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('❌ Mindee Custom SDK Error:', error.message);
        res.status(500).json({ error: 'Invoice processing failed', details: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Backend LIVE on port ${port}`);
});