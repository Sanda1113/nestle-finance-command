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

// Helper to extract address string from address field
const getAddressString = (addressField) => {
    if (!addressField) return 'Not Found';
    // The raw address is stored in the 'address' subfield
    const rawAddress = addressField.address?.value || addressField.address?.content || addressField.address;
    if (rawAddress) return rawAddress;
    // fallback to any string representation
    return addressField.value || addressField.content || 'Not Found';
};

// Helper to format bank details from supplier_payment_details array
const formatBankDetails = (paymentDetailsArray) => {
    if (!paymentDetailsArray || !Array.isArray(paymentDetailsArray) || paymentDetailsArray.length === 0) {
        return 'Not Found';
    }
    const details = paymentDetailsArray[0]; // take the first if multiple
    const parts = [];
    if (details.account_number?.value) parts.push(`Account: ${details.account_number.value}`);
    if (details.routing_number?.value) parts.push(`Routing: ${details.routing_number.value}`);
    if (details.iban?.value) parts.push(`IBAN: ${details.iban.value}`);
    if (details.swift?.value) parts.push(`SWIFT: ${details.swift.value}`);
    return parts.join(', ') || 'Not Found';
};

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    let tempFilePath = null;
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        // Save temp file
        const tempDir = os.tmpdir();
        const fileExt = path.extname(req.file.originalname) || '.pdf';
        tempFilePath = path.join(tempDir, `invoice_${Date.now()}${fileExt}`);
        fs.writeFileSync(tempFilePath, req.file.buffer);

        const apiKey = process.env.MINDEE_API_KEY;
        if (!apiKey) throw new Error('MINDEE_API_KEY environment variable not set');

        const mindeeClient = new mindee.Client({ apiKey });

        const productParams = {
            modelId: 'b3467dd3-63d2-4914-9791-a2dfadfbfe9a',
        };

        const inputSource = new mindee.PathInput({ inputPath: tempFilePath });

        console.log('Sending to Mindee Custom Model...');
        // CORRECT: enqueueAndGetResult returns the Document directly
        const document = await mindeeClient.enqueueAndGetResult(
            mindee.product.Extraction,
            inputSource,
            productParams
        );

        // The extracted fields are in document.inference.prediction
        const prediction = document.inference?.prediction || {};
        console.log('🔥 Prediction keys found:', Object.keys(prediction));

        // Helper to safely get a scalar field value
        const getValue = (field) => field?.value || field?.content || null;

        // --- Vendor / Supplier Info ---
        const vendorName = getValue(prediction.supplier_name) || 'Not Found';
        const vendorAddress = getAddressString(prediction.supplier_address) || 'Not Found';

        // --- Invoice Metadata ---
        const invoiceNumber = getValue(prediction.invoice_number) || 'Not Found';
        const invoiceDate = getValue(prediction.date) || 'Not Found';
        const poNumber = getValue(prediction.po_number) || 'Not Found';
        const dueDate = getValue(prediction.due_date) || 'Not Found';

        // --- Customer Addresses (Bill To / Ship To) ---
        const billTo = getAddressString(prediction.billing_address) || 'Not Found';
        const shipTo = getAddressString(prediction.shipping_address) || 'Not Found';

        // --- Financial Totals ---
        const subtotal = parseFloat(getValue(prediction.total_net)) || 0.00;
        const salesTax = parseFloat(getValue(prediction.total_tax)) || 0.00;
        const totalAmount = parseFloat(getValue(prediction.total_amount)) || 0.00;

        // --- Bank Details ---
        const bankDetails = formatBankDetails(prediction.supplier_payment_details);

        // --- Line Items ---
        const lineItems = [];
        const rawLineItems = prediction.line_items || [];
        if (Array.isArray(rawLineItems)) {
            rawLineItems.forEach(item => {
                lineItems.push({
                    qty: getValue(item.quantity) || '',
                    description: getValue(item.description) || '',
                    unitPrice: getValue(item.unit_price) ? `$${parseFloat(getValue(item.unit_price)).toFixed(2)}` : '$0.00',
                    amount: getValue(item.total_price) ? `$${parseFloat(getValue(item.total_price)).toFixed(2)}` : '$0.00'
                });
            });
        }

        // Build final output exactly as your frontend expects
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
            terms: 'Not Found', // You can adjust if your model extracts terms
            bankDetails,
            lineItems: lineItems.length > 0 ? lineItems : null
        };

        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('❌ Mindee processing error:', error);
        res.status(500).json({ error: 'Invoice processing failed', details: error.message });
    } finally {
        // Clean up temporary file
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});