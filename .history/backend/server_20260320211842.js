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
    res.status(200).send('✅ Nestle Finance Backend (Universal Decryptor) is Awake!');
});

const upload = multer({ storage: multer.memoryStorage() });

// 🛡️ THE UNIVERSAL DECRYPTOR: Converts Mindee's crazy classes into pure JSON
function cleanMindeeObject(obj) {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;

    // 1. Strip out Mindee's List Wrappers
    if (obj.values && Array.isArray(obj.values)) {
        return obj.values.map(item => cleanMindeeObject(item));
    }

    // 2. Strip out Field Wrappers holding simple text/numbers
    if (obj.value !== undefined && typeof obj.value !== 'object') return obj.value;
    if (obj.content !== undefined && typeof obj.content !== 'object') return obj.content;

    // 3. Handle standard Arrays
    if (Array.isArray(obj)) {
        return obj.map(item => cleanMindeeObject(item));
    }

    // 4. Extract data from JavaScript Maps (Mindee uses these heavily)
    if (typeof obj.entries === 'function') {
        const cleaned = {};
        for (const [key, val] of obj.entries()) {
            if (key !== 'polygon' && key !== 'confidence' && key !== 'boundingBox') {
                cleaned[key] = cleanMindeeObject(val);
            }
        }
        return cleaned;
    }

    // 5. Handle standard Objects
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

        // Retrieve the raw hidden map
        const rawFields = response.document?.inference?.prediction?.fields || response.inference?.result?.fields || {};

        // 🚀 ACTIVATE DECRYPTOR: We now have pure, easy-to-read JSON!
        const pureJson = cleanMindeeObject(rawFields);

        // Print the pure JSON to Railway logs so we can see EXACTLY what Mindee found
        console.log("🔥 PURE JSON EXTRACTED:\n", JSON.stringify(pureJson, null, 2));

        // --- HELPER FUNCTIONS ---
        const getAddress = (addr) => {
            if (!addr) return 'Not Found';
            if (typeof addr === 'string') return addr; // If it's a simple string
            // If it's a nested object, join all the pieces together (Fixes the Jessie M Horne bug)
            const parts = [addr.address, addr.street_number, addr.street_name, addr.po_box, addr.city, addr.state, addr.postal_code, addr.country].filter(Boolean);
            return parts.length > 0 ? parts.join(', ') : 'Not Found';
        };

        const getNum = (val) => {
            if (!val) return 0.00;
            const cleanVal = val.toString().replace(/[^0-9.-]+/g, "");
            return parseFloat(cleanVal) || 0.00;
        };

        // --- MAP LINE ITEMS (Fixes the empty table bug) ---
        const rawLineItems = pureJson.line_items || pureJson.lineItems || [];
        const mappedLineItems = Array.isArray(rawLineItems) ? rawLineItems.map(item => ({
            qty: item.quantity?.toString() || item.qty?.toString() || '1',
            description: item.description || item.desc || 'Item',
            unitPrice: `$${parseFloat(item.unit_price || item.unitPrice || 0).toFixed(2)}`,
            amount: `$${parseFloat(item.total_price || item.amount || item.totalPrice || 0).toFixed(2)}`
        })) : [];

        // --- FINAL MAPPING ---
        const extractedData = {
            vendorName: pureJson.supplier_name || 'Unknown Vendor',
            vendorAddress: getAddress(pureJson.supplier_address),
            invoiceNumber: pureJson.invoice_number || 'Not Found',
            invoiceDate: pureJson.date || pureJson.invoice_date || 'Not Found',
            poNumber: pureJson.po_number || pureJson.purchase_order || 'Not Found',
            dueDate: pureJson.due_date || 'Not Found',
            billTo: getAddress(pureJson.customer_address) || pureJson.customer_name || 'Not Found',
            shipTo: getAddress(pureJson.shipping_address) || 'Not Found',
            subtotal: getNum(pureJson.total_net || pureJson.subtotal),
            salesTax: getNum(pureJson.total_tax || pureJson.tax),
            totalAmount: getNum(pureJson.total_amount || pureJson.total),
            terms: 'Check Due Date',
            bankDetails: 'Securely Processed',
            lineItems: mappedLineItems.length > 0 ? mappedLineItems : null
        };

        console.log('✅ Data successfully sent to frontend!');
        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('❌ Data extraction error:', error.message);
        res.status(500).json({ error: 'Invoice processing failed', details: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Backend LIVE on port ${port}`);
});