const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mindee = require('mindee');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

// Note this message so we know when Railway has successfully updated!
app.get('/', (req, res) => {
    res.status(200).send('✅ Nestle Finance Backend (Mindee SDK Edition) is Awake!');
});

const upload = multer({ storage: multer.memoryStorage() });

// 🚀 PASTE YOUR NEW "OFF-THE-SHELF" INVOICE KEY HERE
const mindeeClient = new mindee.Client({ apiKey: "md_rzdzT3Hg0p1dT_R4k1K0LKrd4_orzdDvvBafvfKSM6Q" });

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        console.log('Sending Invoice to Mindee SDK...');

        // 1. Load the image buffer
        const inputSource = mindeeClient.docFromBuffer(req.file.buffer, req.file.originalname || 'invoice.png');

        // 2. Call the Official pre-trained Invoice V4 model
        const apiResponse = await mindeeClient.parse(mindee.product.InvoiceV4, inputSource);
        const prediction = apiResponse.document.inference.prediction;

        // 3. Map Addresses & Banks
        const vendorAddress = prediction.supplierAddress?.value || "Not Found";
        const customerName = prediction.customerName?.value || "";
        const customerAddress = prediction.customerAddress?.value || "";
        const billTo = [customerName, customerAddress].filter(Boolean).join(", ") || "Not Found";
        const shipTo = prediction.shippingAddress?.value || billTo;

        const bankData = prediction.supplierPaymentDetails?.[0];
        let bankDetails = "Not Found";
        if (bankData) {
            bankDetails = `Account: ${bankData.accountNumber || 'N/A'}, Routing: ${bankData.routingNumber || 'N/A'}`;
        }

        // 4. Build the final JSON
        const extractedData = {
            vendorName: prediction.supplierName?.value || "Unknown Vendor",
            vendorAddress: vendorAddress,
            invoiceNumber: prediction.invoiceNumber?.value || "Not Found",
            invoiceDate: prediction.date?.value || "Not Found",
            poNumber: prediction.referenceNumbers?.[0]?.value || "Not Found",
            dueDate: prediction.dueDate?.value || "Not Found",
            billTo: billTo,
            shipTo: shipTo,
            subtotal: prediction.totalNet?.value || 0.00,
            salesTax: prediction.totalTax?.value || 0.00,
            totalAmount: prediction.totalAmount?.value || 0.00,
            terms: "Check Due Date",
            bankDetails: bankDetails,

            // Map Line Items safely
            lineItems: prediction.lineItems?.length > 0 ? prediction.lineItems.map(item => ({
                qty: item.quantity?.toString() || "1",
                description: item.description || "Item",
                unitPrice: `$${item.unitPrice ? item.unitPrice.toFixed(2) : "0.00"}`,
                amount: `$${item.totalAmount ? item.totalAmount.toFixed(2) : "0.00"}`
            })) : null
        };

        console.log('Mindee Extraction Successful! Sending to Frontend...');
        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('Mindee SDK Error:', error);
        res.status(500).json({ error: 'Failed to process document via Mindee SDK' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Mindee SDK Backend is LIVE on port ${port}`);
});