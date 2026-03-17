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
 * Deeply extract the raw address string from any Mindee address field.
 * The schema says address fields have a nested "address" object that contains the raw string.
 * But we try multiple possible paths to be safe.
 */
const extractRawAddress = (addrField) => {
    if (!addrField) return null;

    // If it's an array (unlikely for single address), take first
    if (Array.isArray(addrField)) {
        addrField = addrField[0];
        if (!addrField) return null;
    }

    // Try the most common pattern: addrField.address.value
    if (addrField.address) {
        if (addrField.address.value) return addrField.address.value;
        if (addrField.address.content) return addrField.address.content;
        if (typeof addrField.address === 'string') return addrField.address;
    }

    // Try direct value/content (some addresses may be flat)
    if (addrField.value) return addrField.value;
    if (addrField.content) return addrField.content;

    // If it's a plain string
    if (typeof addrField === 'string') return addrField;

    // Log the structure we couldn't handle
    console.log('⚠️ Unhandled address structure:', JSON.stringify(addrField).slice(0, 300));
    return null;
};

const getAddressString = (addrField) => {
    const raw = extractRawAddress(addrField);
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

        // ---- CRITICAL: fields live inside rawHttp ----
        const fields = document.rawHttp?.inference?.result?.fields || {};
        console.log('🔍 Fields keys found:', Object.keys(fields));

        // ---- DEBUG: print raw address fields and line items ----
        console.log('🧪 supplier_address raw:', JSON.stringify(fields.supplier_address));
        console.log('🧪 billing_address raw:', JSON.stringify(fields.billing_address));
        console.log('🧪 shipping_address raw:', JSON.stringify(fields.shipping_address));
        console.log('🧪 customer_address raw:', JSON.stringify(fields.customer_address));

        // Log line items if present
        if (Array.isArray(fields.line_items)) {
            console.log(`🧪 line_items array length: ${fields.line_items.length}`);
            if (fields.line_items.length > 0) {
                console.log('🧪 First line item raw:', JSON.stringify(fields.line_items[0]));
            }
        } else {
            console.log('🧪 line_items is not an array:', fields.line_items);
        }

        // ========== MAP FIELDS TO YOUR EXACT OUTPUT STRUCTURE ==========

        // Vendor
        const vendorName = getValue(fields.supplier_name) || 'Not Found';
        const vendorAddress = getAddressString(fields.supplier_address);

        // Invoice metadata
        const invoiceNumber = getValue(fields.invoice_number) || 'Not Found';
        const invoiceDate = getValue(fields.date) || 'Not Found';
        const poNumber = getValue(fields.po_number) || 'Not Found';
        const dueDate = getValue(fields.due_date) || 'Not Found';

        // Addresses
        const billTo = getAddressString(fields.billing_address) ||
                       getAddressString(fields.customer_address) || 'Not Found';
        const shipTo = getAddressString(fields.shipping_address) || billTo;

        // Financials
        const subtotal = getNumber(fields.total_net);
        const salesTax = getNumber(fields.total_tax);
        const totalAmount = getNumber(fields.total_amount);

        // Bank details
        const bankDetails = formatBankDetails(fields.supplier_payment_details);

        // Terms (if your model provides it, otherwise static)
        const terms = 'Not Found'; // adjust if your model extracts terms & conditions

        // Line items (product details)
        const lineItems = [];
        const rawItems = fields.line_items || [];
        if (Array.isArray(rawItems)) {
            rawItems.forEach(item => {
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