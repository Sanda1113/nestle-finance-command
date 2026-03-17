const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mindee = require('mindee');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send('✅ Mindee Invoice Extractor is Live');
});

const upload = multer({ storage: multer.memoryStorage() });

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract raw address string from any Mindee field by trying multiple paths.
 */
const extractRawAddress = (field) => {
    if (!field) return null;

    // If it's an array, take first element (unlikely but safe)
    if (Array.isArray(field)) {
        field = field[0];
        if (!field) return null;
    }

    // Try nested address object (most common)
    if (field.address) {
        if (field.address.value) return field.address.value;
        if (field.address.content) return field.address.content;
        if (typeof field.address === 'string') return field.address;
    }

    // Try direct value/content
    if (field.value) return field.value;
    if (field.content) return field.content;

    // If the field itself is a string
    if (typeof field === 'string') return field;

    // If it's an object with a 'raw' property (rare)
    if (field.raw) return field.raw;

    // Log unhandled structure for debugging
    console.log('⚠️ Unhandled address structure:', JSON.stringify(field).slice(0, 500));
    return null;
};

const getAddressString = (field) => {
    const raw = extractRawAddress(field);
    return raw || 'Not Found';
};

/**
 * Format bank details from supplier_payment_details array.
 */
const formatBankDetails = (paymentArr) => {
    if (!paymentArr || !Array.isArray(paymentArr) || paymentArr.length === 0) {
        return 'Not Found';
    }
    const details = paymentArr[0];
    const parts = [];
    if (details.account_number?.value) parts.push(`Account: ${details.account_number.value}`);
    if (details.routing_number?.value) parts.push(`Routing: ${details.routing_number.value}`);
    if (details.iban?.value) parts.push(`IBAN: ${details.iban.value}`);
    if (details.swift?.value) parts.push(`SWIFT: ${details.swift.value}`);
    return parts.length > 0 ? parts.join(', ') : 'Not Found';
};

/**
 * Safely extract a scalar value from any Mindee field.
 */
const getValue = (field) => {
    if (!field) return null;
    // Try common paths
    if (field.value) return field.value;
    if (field.content) return field.content;
    if (typeof field === 'string') return field;
    return null;
};

/**
 * Safely parse a number from a Mindee field.
 */
const getNumber = (field) => {
    const val = getValue(field);
    if (val === null) return 0.00;
    const num = parseFloat(val);
    return isNaN(num) ? 0.00 : num;
};

// ==================== EXTRACTION ENDPOINT ====================

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    let tempFilePath = null;
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const tempDir = os.tmpdir();
        const fileExt = path.extname(req.file.originalname) || '.pdf';
        tempFilePath = path.join(tempDir, `invoice_${Date.now()}${fileExt}`);
        fs.writeFileSync(tempFilePath, req.file.buffer);
        console.log(`📁 Temporary file created: ${tempFilePath}`);

        const apiKey = process.env.MINDEE_API_KEY;
        if (!apiKey) throw new Error('MINDEE_API_KEY environment variable not set');

        const mindeeClient = new mindee.Client({ apiKey });

        const productParams = {
            modelId: 'b3467dd3-63d2-4914-9791-a2dfadfbfe9a',
        };

        const inputSource = new mindee.PathInput({ inputPath: tempFilePath });

        console.log('🚀 Sending to Mindee custom model...');
        const document = await mindeeClient.enqueueAndGetResult(
            mindee.product.Extraction,
            inputSource,
            productParams
        );

        console.log('📦 Full Mindee document (first 2000 chars):');
        console.log(JSON.stringify(document, null, 2).substring(0, 2000) + '...');

        // ---- CRITICAL: fields are inside rawHttp ----
        const fields = document.rawHttp?.inference?.result?.fields || {};
        console.log('🔍 Fields keys found:', Object.keys(fields));

        // ---- DEBUG: log full raw fields for addresses and line items ----
        console.log('🧪 FULL supplier_address:', JSON.stringify(fields.supplier_address, null, 2));
        console.log('🧪 FULL billing_address:', JSON.stringify(fields.billing_address, null, 2));
        console.log('🧪 FULL shipping_address:', JSON.stringify(fields.shipping_address, null, 2));
        console.log('🧪 FULL customer_address:', JSON.stringify(fields.customer_address, null, 2));
        console.log('🧪 FULL line_items:', JSON.stringify(fields.line_items, null, 2));

        // ========== EXTRACT LINE ITEMS ==========
        let lineItems = [];

        // Try to locate the line items array – common paths: line_items, line_items.items, line_items.values
        let rawItems = null;
        if (fields.line_items) {
            if (Array.isArray(fields.line_items)) {
                rawItems = fields.line_items;
            } else if (fields.line_items.items && Array.isArray(fields.line_items.items)) {
                rawItems = fields.line_items.items;
            } else if (fields.line_items.values && Array.isArray(fields.line_items.values)) {
                rawItems = fields.line_items.values;
            }
        }

        if (rawItems) {
            console.log(`🧪 Found ${rawItems.length} line items.`);
            rawItems.forEach((item, idx) => {
                console.log(`🧪 Line item ${idx} raw:`, JSON.stringify(item, null, 2));
                const qty = getValue(item.quantity) || '';
                const description = getValue(item.description) || '';
                const unitPrice = getNumber(item.unit_price);
                const amount = getNumber(item.total_price || item.amount);
                lineItems.push({
                    qty: qty.toString(),
                    description,
                    unitPrice: unitPrice ? `$${unitPrice.toFixed(2)}` : '$0.00',
                    amount: amount ? `$${amount.toFixed(2)}` : '$0.00'
                });
            });
        } else {
            console.log('🧪 No line items array found.');
        }

        // ========== MAP ALL FIELDS ==========
        const extractedData = {
            vendorName: getValue(fields.supplier_name) || 'Not Found',
            vendorAddress: getAddressString(fields.supplier_address),
            invoiceNumber: getValue(fields.invoice_number) || 'Not Found',
            invoiceDate: getValue(fields.date) || 'Not Found',
            poNumber: getValue(fields.po_number) || 'Not Found',
            dueDate: getValue(fields.due_date) || 'Not Found',
            billTo: getAddressString(fields.billing_address) ||
                    getAddressString(fields.customer_address) || 'Not Found',
            shipTo: getAddressString(fields.shipping_address) ||
                    getAddressString(fields.billing_address) || 'Not Found',
            subtotal: getNumber(fields.total_net),
            salesTax: getNumber(fields.total_tax),
            totalAmount: getNumber(fields.total_amount),
            terms: 'Not Found', // adjust if your model extracts this
            bankDetails: formatBankDetails(fields.supplier_payment_details),
            lineItems: lineItems.length > 0 ? lineItems : null
        };

        console.log('📤 Data sent to frontend:', JSON.stringify(extractedData, null, 2));
        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('❌ Mindee processing error:', error);
        res.status(500).json({ error: 'Invoice processing failed', details: error.message });
    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            console.log(`🗑️ Temporary file deleted: ${tempFilePath}`);
        }
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});