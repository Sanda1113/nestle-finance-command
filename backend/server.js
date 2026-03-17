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
    res.status(200).send('✅ Nestle Finance Backend (Mindee IDP) is Awake!');
});

const upload = multer({ storage: multer.memoryStorage() });

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
        const inputSource = new mindee.PathInput({ inputPath: tempFilePath });

        console.log('Processing via Mindee IDP...');
        
        // 🚀 CRITICAL FIX: Use the pre-trained InvoiceV4 model, NOT the custom model ID
        const apiResponse = await mindeeClient.enqueueAndGetResult(
            mindee.product.InvoiceV4,
            inputSource
        );
        
        // 🚀 The V5 SDK automatically formats off-the-shelf models perfectly
        const prediction = apiResponse.document.inference.prediction;

        const customerName = prediction.customerName?.value || "";
        const customerAddress = prediction.customerAddress?.value || "";
        const billTo = [customerName, customerAddress].filter(Boolean).join(', ') || 'Not Found';
        
        const bankData = prediction.supplierPaymentDetails?.[0];
        let bankDetails = 'Not Found';
        if (bankData) {
            bankDetails = `Account: ${bankData.accountNumber || 'N/A'}, Routing: ${bankData.routingNumber || 'N/A'}`;
        }

        const extractedData = {
            vendorName: prediction.supplierName?.value || 'Not Found',
            vendorAddress: prediction.supplierAddress?.value || 'Not Found',
            invoiceNumber: prediction.invoiceNumber?.value || 'Not Found',
            invoiceDate: prediction.date?.value || 'Not Found',
            // Mindee stores PO numbers in referenceNumbers
            poNumber: prediction.referenceNumbers?.map(ref => ref.value).join(', ') || 'Not Found',
            dueDate: prediction.dueDate?.value || 'Not Found',
            billTo: billTo,
            shipTo: prediction.shippingAddress?.value || billTo,
            subtotal: prediction.totalNet?.value || 0.00,
            salesTax: prediction.totalTax?.value || 0.00,
            totalAmount: prediction.totalAmount?.value || 0.00,
            terms: 'Check Due Date',
            bankDetails: bankDetails,
            
            // Map Line Items
            lineItems: prediction.lineItems?.length > 0 ? prediction.lineItems.map(item => ({
                qty: item.quantity || '1',
                description: item.description || 'Item',
                unitPrice: `$${(item.unitPrice || 0).toFixed(2)}`,
                amount: `$${(item.totalAmount || 0).toFixed(2)}`
            })) : null
        };

        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('❌ Mindee IDP processing error:', error);
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