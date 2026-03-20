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
    res.status(200).send('✅ Nestle Finance Backend (Precision Mapper) is Awake!');
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

        const rawFields = response.document?.inference?.prediction?.fields || response.inference?.result?.fields || {};
        const pureJson = cleanMindeeObject(rawFields);

        // --- 🎯 PRECISION HELPERS BASED ON YOUR EXACT LOGS ---

        // Addresses are inside { fields: { address: "..." } }
        const getAddressText = (obj) => {
            if (!obj) return null;
            if (typeof obj === 'string') return obj;
            if (obj.fields && obj.fields.address) return obj.fields.address;
            if (obj.address) return obj.address;
            return null;
        };

        const getVal = (val) => {
            if (val === null || val === undefined) return null;
            if (typeof val === 'object' && val.value !== undefined) return val.value;
            return val;
        };

        const getNum = (val) => {
            const v = getVal(val);
            if (!v) return 0.00;
            const cleanVal = v.toString().replace(/[^0-9.-]+/g, "");
            return parseFloat(cleanVal) || 0.00;
        };

        // Line Items are inside line_items.items, and each has a .fields wrapper
        const rawItems = pureJson.line_items?.items || [];
        const mappedLineItems = rawItems.map(item => {
            const f = item.fields || item;
            return {
                qty: getVal(f.quantity) || '1',
                description: getVal(f.description) || 'Item',
                unitPrice: `$${parseFloat(getVal(f.unit_price) || 0).toFixed(2)}`,
                amount: `$${parseFloat(getVal(f.total_price) || getVal(f.amount) || 0).toFixed(2)}`
            };
        });

        // Bank Details are inside supplier_payment_details.items
        const rawBank = pureJson.supplier_payment_details?.items || [];
        let bankString = 'Not Found';
        if (rawBank.length > 0) {
            const bFields = rawBank[0].fields || rawBank[0];
            bankString = `Account: ${getVal(bFields.account_number) || 'N/A'}, Routing: ${getVal(bFields.routing_number) || 'N/A'}`;
        }

        // --- FINAL MAPPING ---
        const extractedData = {
            vendorName: getVal(pureJson.supplier_name) || 'Unknown Vendor',
            vendorAddress: getAddressText(pureJson.supplier_address) || 'Not Found',
            invoiceNumber: getVal(pureJson.invoice_number) || 'Not Found',
            invoiceDate: getVal(pureJson.date) || getVal(pureJson.invoice_date) || 'Not Found',
            poNumber: getVal(pureJson.po_number) || getVal(pureJson.reference_numbers) || 'Not Found',
            dueDate: getVal(pureJson.due_date) || 'Not Found',

            // For Bill To, we check customer_address, then fallback to customer_name
            billTo: getAddressText(pureJson.customer_address) || getVal(pureJson.customer_name) || 'Not Found',
            shipTo: getAddressText(pureJson.shipping_address) || 'Not Found',

            subtotal: getNum(pureJson.total_net),
            salesTax: getNum(pureJson.total_tax),
            totalAmount: getNum(pureJson.total_amount),
            terms: 'Check Due Date',
            bankDetails: bankString,
            lineItems: mappedLineItems.length > 0 ? mappedLineItems : null
        };

        console.log('✅ Extraction Complete! Sending to frontend.');
        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('❌ Data extraction error:', error.message);
        res.status(500).json({ error: 'Invoice processing failed', details: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Backend LIVE on port ${port}`);
});