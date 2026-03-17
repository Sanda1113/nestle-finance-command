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

// Helper to safely get nested address string
const getAddressString = (addressObj) => {
    return addressObj?.address || 'Not Found';
};

// Helper to format bank details
const formatBankDetails = (paymentDetailsArray) => {
    if (!paymentDetailsArray || paymentDetailsArray.length === 0) return 'Not Found';
    const details = paymentDetailsArray[0]; // take first if multiple
    const parts = [];
    if (details.account_number) parts.push(`Account: ${details.account_number}`);
    if (details.routing_number) parts.push(`Routing: ${details.routing_number}`);
    if (details.iban) parts.push(`IBAN: ${details.iban}`);
    if (details.swift) parts.push(`SWIFT: ${details.swift}`);
    return parts.join(', ') || 'Not Found';
};

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
            // Enable these if needed:
            // rag: true,
            // rawText: true,
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

        // 🔍 DEBUG: Log all available field names and values
        console.log('🔥 Available fields from Mindee:');
        Object.keys(fields).forEach(key => {
            const field = fields[key];
            if (field && field.value !== undefined) {
                console.log(` - ${key}: ${field.value}`);
            } else if (Array.isArray(field)) {
                console.log(` - ${key}: [array with ${field.length} items]`);
            } else {
                console.log(` - ${key}: (complex object)`);
            }
        });

        // 7. Map Mindee fields to your desired output structure
        const extractedData = {
            // Vendor (supplier) info
            vendorName: fields.supplier_name?.value || 'Not Found',
            vendorAddress: getAddressString(fields.supplier_address),

            // Invoice details
            invoiceNumber: fields.invoice_number?.value || 'Not Found',
            invoiceDate: fields.date?.value || 'Not Found',
            poNumber: fields.po_number?.value || 'Not Found',
            dueDate: fields.due_date?.value || 'Not Found',

            // Customer addresses (Bill To / Ship To)
            billTo: getAddressString(fields.billing_address) || 
                    (fields.customer_address ? getAddressString(fields.customer_address) : 'Not Found'),
            shipTo: getAddressString(fields.shipping_address) || 'Not Found',

            // Financial totals
            subtotal: parseFloat(fields.total_net?.value) || 0.00,
            salesTax: parseFloat(fields.total_tax?.value) || 0.00,
            totalAmount: parseFloat(fields.total_amount?.value) || 0.00,

            // Terms & bank details
            terms: 'Not Found', // Not present in schema, could be extracted from raw text if needed
            bankDetails: formatBankDetails(fields.supplier_payment_details),

            // Line items
            lineItems: (fields.line_items || []).map(item => ({
                qty: item.quantity?.value || '',
                description: item.description?.value || '',
                unitPrice: item.unit_price?.value ? `$${item.unit_price.value}` : '$0.00',
                amount: item.total_price?.value ? `$${item.total_price.value}` : '$0.00'
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