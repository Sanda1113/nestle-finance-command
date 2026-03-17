const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mindee = require('mindee'); // CommonJS

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send('✅ Mindee Backend is Live');
});

// Setup multer for memory storage (we'll write to disk later)
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    let tempFilePath = null;
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        // Save buffer to a temporary file
        const tempDir = os.tmpdir();
        const fileExt = path.extname(req.file.originalname) || '.pdf';
        tempFilePath = path.join(tempDir, `invoice_${Date.now()}${fileExt}`);
        fs.writeFileSync(tempFilePath, req.file.buffer);

        // Initialize Mindee client
        const mindeeClient = new mindee.Client({
            apiKey: process.env.MINDEE_API_KEY || 'md_lPH7RpDY5697-MEGkStodEwXzSSIRpi7EZPKxP_u4No' // replace with env var
        });

        // Define product parameters (your custom model)
        const productParams = {
            modelId: 'b3467dd3-63d2-4914-9791-a2dfadfbfe9a',
            rag: undefined,
            rawText: undefined,
            polygon: undefined,
            confidence: undefined,
        };

        // Load file and send to Mindee
        const inputSource = new mindee.PathInput({ inputPath: tempFilePath });
        const response = await mindeeClient.enqueueAndGetResult(
            mindee.product.Extraction,
            inputSource,
            productParams
        );

        // Clean up temp file
        fs.unlinkSync(tempFilePath);
        tempFilePath = null;

        // Extract fields from Mindee response
        const fields = response.inference?.result?.fields || {};

        // Helper to safely get field value
        const getFieldValue = (fieldName) => fields[fieldName]?.value || 'Not Found';

        // Build the exact structure you want
        const extractedData = {
            vendorName: getFieldValue('vendor_name'),
            vendorAddress: getFieldValue('vendor_address'),
            invoiceNumber: getFieldValue('invoice_number'),
            invoiceDate: getFieldValue('invoice_date'),
            poNumber: getFieldValue('po_number'),
            dueDate: getFieldValue('due_date'),
            billTo: getFieldValue('bill_to'),
            shipTo: getFieldValue('ship_to'),
            subtotal: parseFloat(getFieldValue('subtotal')) || 0.00,
            salesTax: parseFloat(getFieldValue('tax')) || 0.00,
            totalAmount: parseFloat(getFieldValue('total')) || 0.00,
            terms: getFieldValue('terms'),
            bankDetails: getFieldValue('bank_details'),
            lineItems: (fields.line_items?.values || []).map(item => ({
                qty: item.quantity?.value || '',
                description: item.description?.value || '',
                unitPrice: `$${item.unit_price?.value || '0.00'}`,
                amount: `$${item.amount?.value || '0.00'}`
            }))
        };

        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('Mindee error:', error);
        // Clean up temp file if error occurred
        if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        res.status(500).json({ error: 'Mindee processing failed', details: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend live on port ${PORT}`);
});