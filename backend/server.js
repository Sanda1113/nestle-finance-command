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

const getAddressString = (addressObj) => {
    if (!addressObj) return 'Not Found';
    return addressObj.value || addressObj.address || addressObj.content || 'Not Found';
};

const formatBankDetails = (paymentDetailsArray) => {
    // Handle V5 SDK Array structure
    const details = Array.isArray(paymentDetailsArray) ? paymentDetailsArray[0] : paymentDetailsArray?.values?.[0];
    if (!details) return 'Not Found';
    
    const parts = [];
    if (details.account_number) parts.push(`Account: ${details.account_number}`);
    if (details.routing_number) parts.push(`Routing: ${details.routing_number}`);
    if (details.iban) parts.push(`IBAN: ${details.iban}`);
    if (details.swift) parts.push(`SWIFT: ${details.swift}`);
    return parts.join(', ') || 'Not Found';
};

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    let tempFilePath = null;
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const tempDir = os.tmpdir();
        const fileExt = path.extname(req.file.originalname) || '.pdf';
        tempFilePath = path.join(tempDir, `invoice_${Date.now()}${fileExt}`);
        fs.writeFileSync(tempFilePath, req.file.buffer);

        const apiKey = process.env.MINDEE_API_KEY; 
        if (!apiKey) throw new Error('MINDEE_API_KEY environment variable not set');
        
        const mindeeClient = new mindee.Client({ apiKey });

        const productParams = {
            modelId: 'b3467dd3-63d2-4914-9791-a2dfadfbfe9a'
        };

        const inputSource = new mindee.PathInput({ inputPath: tempFilePath });

        console.log('Sending to Mindee Custom Model...');
        const response = await mindeeClient.enqueueAndGetResult(
            mindee.product.Extraction,
            inputSource,
            productParams
        );
        
        // 🚀 THE CRITICAL FIX: The correct V5 Object Path
        const prediction = response.document?.inference?.prediction || {};
        
        // Custom models sometimes store data directly on prediction, or inside a fields object
        const fields = prediction.fields || prediction || {};

        console.log('🔥 Raw Prediction Keys Found:', Object.keys(fields));

        // Helper to grab values safely regardless of how the custom model wraps it
        const getVal = (field) => field?.value || field?.content || field || null;
        const getNum = (field) => parseFloat(getVal(field)) || 0.00;

        const customerName = getVal(fields.customer_name);
        const customerAddress = getAddressString(fields.customer_address);
        const billTo = [customerName, customerAddress].filter(Boolean).join(', ') || 'Not Found';

        // Map Line Items Safely
        const rawLineItems = fields.line_items?.values || fields.line_items?.elements || fields.line_items || [];
        const mappedLineItems = rawLineItems.map(item => ({
            qty: getVal(item.quantity) || '1',
            description: getVal(item.description) || 'Item',
            unitPrice: `$${getNum(item.unit_price).toFixed(2)}`,
            amount: `$${getNum(item.total_price || item.amount).toFixed(2)}`
        }));

        const extractedData = {
            vendorName: getVal(fields.supplier_name) || 'Not Found',
            vendorAddress: getAddressString(fields.supplier_address),
            invoiceNumber: getVal(fields.invoice_number) || 'Not Found',
            invoiceDate: getVal(fields.date) || 'Not Found',
            poNumber: getVal(fields.po_number) || 'Not Found',
            dueDate: getVal(fields.due_date) || 'Not Found',
            billTo: billTo,
            shipTo: getAddressString(fields.shipping_address) || billTo,
            subtotal: getNum(fields.total_net),
            salesTax: getNum(fields.total_tax),
            totalAmount: getNum(fields.total_amount),
            terms: 'Check Due Date',
            bankDetails: formatBankDetails(fields.supplier_payment_details),
            lineItems: mappedLineItems.length > 0 ? mappedLineItems : null
        };

        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('❌ Mindee processing error:', error);
        res.status(500).json({ error: 'Invoice processing failed', details: error.message });
    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});