const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mindee = require('mindee'); // v5 SDK

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
    res.status(200).send('✅ Mindee Invoice Extractor is Live');
});

const upload = multer({ storage: multer.memoryStorage() });

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract address string from Mindee's address field object.
 * According to schema: supplier_address, billing_address, shipping_address, customer_address
 * have a nested "address" field containing the raw string.
 */
const getAddressString = (addrField) => {
    if (!addrField) return 'Not Found';
    // The raw address can be at addrField.address.value or addrField.address.content
    const raw = addrField.address?.value || addrField.address?.content || addrField.address;
    if (raw) return raw;
    // Fallback: if addrField itself is a string (unlikely but safe)
    return addrField.value || addrField.content || 'Not Found';
};

/**
 * Format bank details from supplier_payment_details array.
 * Each entry may contain account_number, routing_number, iban, swift.
 */
const formatBankDetails = (paymentArr) => {
    if (!paymentArr || !Array.isArray(paymentArr) || paymentArr.length === 0) {
        return 'Not Found';
    }
    const details = paymentArr[0]; // take first
    const parts = [];
    if (details.account_number?.value) parts.push(`Account: ${details.account_number.value}`);
    if (details.routing_number?.value) parts.push(`Routing: ${details.routing_number.value}`);
    if (details.iban?.value) parts.push(`IBAN: ${details.iban.value}`);
    if (details.swift?.value) parts.push(`SWIFT: ${details.swift.value}`);
    return parts.length > 0 ? parts.join(', ') : 'Not Found';
};

/**
 * Safely extract a scalar value from a Mindee field.
 */
const getValue = (field) => {
    if (!field) return null;
    // In v5, fields have .value or .content
    return field.value ?? field.content ?? null;
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

        // ---- Save uploaded file temporarily ----
        const tempDir = os.tmpdir();
        const fileExt = path.extname(req.file.originalname) || '.pdf';
        tempFilePath = path.join(tempDir, `invoice_${Date.now()}${fileExt}`);
        fs.writeFileSync(tempFilePath, req.file.buffer);
        console.log(`📁 Temporary file created: ${tempFilePath}`);

        // ---- Initialize Mindee client ----
        const apiKey = process.env.MINDEE_API_KEY;
        if (!apiKey) {
            throw new Error('MINDEE_API_KEY environment variable not set');
        }
        const mindeeClient = new mindee.Client({ apiKey });

        // ---- Configure custom model ----
        const productParams = {
            modelId: 'b3467dd3-63d2-4914-9791-a2dfadfbfe9a', // your model ID
        };

        const inputSource = new mindee.PathInput({ inputPath: tempFilePath });

        // ---- Call Mindee API ----
        console.log('🚀 Sending to Mindee custom model...');
        const document = await mindeeClient.enqueueAndGetResult(
            mindee.product.Extraction,
            inputSource,
            productParams
        );

        // ---- Log the complete Mindee response for debugging ----
        console.log('📦 Full Mindee document:');
        console.log(JSON.stringify(document, null, 2).substring(0, 2000) + '...'); // truncate for readability

        // ---- Extract prediction object ----
        const prediction = document.inference?.prediction || {};
        console.log('🔍 Prediction keys found:', Object.keys(prediction));

        // ---- Log each prediction field's value for verification ----
        for (const key of Object.keys(prediction)) {
            const field = prediction[key];
            console.log(`   - ${key}:`, getValue(field) || '(complex object)');
        }

        // ========== MAP FIELDS TO YOUR EXACT OUTPUT STRUCTURE ==========

        // Vendor
        const vendorName = getValue(prediction.supplier_name) || 'Not Found';
        const vendorAddress = getAddressString(prediction.supplier_address);

        // Invoice metadata
        const invoiceNumber = getValue(prediction.invoice_number) || 'Not Found';
        const invoiceDate = getValue(prediction.date) || 'Not Found';
        const poNumber = getValue(prediction.po_number) || 'Not Found';
        const dueDate = getValue(prediction.due_date) || 'Not Found';

        // Addresses (Bill To & Ship To)
        const billTo = getAddressString(prediction.billing_address) ||
                       getAddressString(prediction.customer_address) || 'Not Found';
        const shipTo = getAddressString(prediction.shipping_address) || billTo;

        // Financials
        const subtotal = getNumber(prediction.total_net);
        const salesTax = getNumber(prediction.total_tax);
        const totalAmount = getNumber(prediction.total_amount);

        // Bank details
        const bankDetails = formatBankDetails(prediction.supplier_payment_details);

        // Terms (if your model provides it, otherwise static or from another field)
        const terms = 'Not Found'; // adjust if your model extracts terms & conditions

        // Line items
        const lineItems = [];
        const rawItems = prediction.line_items || [];
        if (Array.isArray(rawItems)) {
            rawItems.forEach(item => {
                const qty = getValue(item.quantity) || '';
                const description = getValue(item.description) || '';
                const unitPrice = getNumber(item.unit_price);
                const amount = getNumber(item.total_price || item.amount);
                lineItems.push({
                    qty: qty.toString(),
                    description: description,
                    unitPrice: unitPrice ? `$${unitPrice.toFixed(2)}` : '$0.00',
                    amount: amount ? `$${amount.toFixed(2)}` : '$0.00'
                });
            });
        }

        // Assemble final object
        const extractedData = {
            vendorName,
            vendorAddress,
            invoiceNumber,
            invoiceDate,
            poNumber,
            dueDate,
            billTo,
            shipTo,
            subtotal,
            salesTax,
            totalAmount,
            terms,
            bankDetails,
            lineItems: lineItems.length > 0 ? lineItems : null
        };

        // ---- Log what we are about to send to the frontend ----
        console.log('📤 Data sent to frontend:', JSON.stringify(extractedData, null, 2));

        // ---- Send response ----
        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('❌ Mindee processing error:', error);
        res.status(500).json({ error: 'Invoice processing failed', details: error.message });
    } finally {
        // ---- Clean up temp file ----
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            console.log(`🗑️ Temporary file deleted: ${tempFilePath}`);
        }
    }
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});