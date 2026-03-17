const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mindee = require('mindee'); // CommonJS

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
    res.status(200).send('✅ Mindee Invoice Extractor is Live');
});

// Configure multer (memory storage, we'll write to disk later)
const upload = multer({ storage: multer.memoryStorage() });

// Main extraction endpoint
app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    let tempFilePath = null;
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // 1. Save the uploaded buffer to a temporary file
        const tempDir = os.tmpdir();
        const fileExt = path.extname(req.file.originalname) || '.pdf';
        tempFilePath = path.join(tempDir, `invoice_${Date.now()}${fileExt}`);
        fs.writeFileSync(tempFilePath, req.file.buffer);
        console.log(`Temporary file created: ${tempFilePath}`);

        // 2. Initialize Mindee client with your API key
        const apiKey = process.env.MINDEE_API_KEY; 
        if (!apiKey) {
            throw new Error('MINDEE_API_KEY environment variable not set');
        }
        const mindeeClient = new mindee.Client({ apiKey });

        // 3. Set up your custom model parameters
        const productParams = {
            modelId: 'b3467dd3-63d2-4914-9791-a2dfadfbfe9a',
            // You can enable these if needed:
            // rag: true,
            // rawText: true,
            // polygon: false,
            // confidence: true,
        };

        // 4. Create an input source from the file path
        const inputSource = new mindee.PathInput({ inputPath: tempFilePath });

        // 5. Send to Mindee and wait for the result
        console.log('Sending to Mindee...');
        const response = await mindeeClient.enqueueAndGetResult(
            mindee.product.Extraction,
            inputSource,
            productParams
        );
        console.log('Mindee response received');

        // 6. Extract fields from the response
        const fields = response.inference?.result?.fields || {};

        // 🔍 DEBUG: Log all available field names to the console
        console.log('🔥 Available fields from Mindee:');
        Object.keys(fields).forEach(key => {
            console.log(` - ${key}: ${fields[key]?.value}`);
        });

        // 7. Map Mindee fields to your desired output structure
        // ⚠️ IMPORTANT: Replace the field names below with the actual ones from your model
        const extractedData = {
            vendorName: fields.vendor_name?.value || 'Not Found',
            vendorAddress: fields.vendor_address?.value || 'Not Found',
            invoiceNumber: fields.invoice_number?.value || 'Not Found',
            invoiceDate: fields.invoice_date?.value || 'Not Found',
            poNumber: fields.po_number?.value || 'Not Found',
            dueDate: fields.due_date?.value || 'Not Found',
            billTo: fields.bill_to?.value || 'Not Found',
            shipTo: fields.ship_to?.value || 'Not Found',
            subtotal: parseFloat(fields.subtotal?.value) || 0.00,
            salesTax: parseFloat(fields.tax?.value) || 0.00,
            totalAmount: parseFloat(fields.total?.value) || 0.00,
            terms: fields.terms?.value || 'Not Found',
            bankDetails: fields.bank_details?.value || 'Not Found',
            lineItems: (fields.line_items?.values || []).map(item => ({
                qty: item.quantity?.value || '',
                description: item.description?.value || '',
                unitPrice: item.unit_price?.value ? `$${item.unit_price.value}` : '$0.00',
                amount: item.amount?.value ? `$${item.amount.value}` : '$0.00'
            }))
        };

        // 8. Send the extracted data back to the client
        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('❌ Mindee processing error:', error);
        res.status(500).json({ 
            error: 'Invoice processing failed', 
            details: error.message 
        });
    } finally {
        // 9. Clean up the temporary file
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            console.log(`Temporary file deleted: ${tempFilePath}`);
        }
    }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});