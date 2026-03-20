const express = require('express');
const cors = require('cors');
const multer = require('multer');

// Load .env in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send('✅ Nestle Finance Backend is Awake and Ready!');
});

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        // Build form data for Mindee API
        const formData = new FormData();
        formData.append('document', new Blob([req.file.buffer]), req.file.originalname);

        // Call Mindee Invoice API (v4)
        const response = await fetch('https://api.mindee.net/v2/products/mindee/invoice/v4/predict', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${process.env.MINDEE_V2_API_KEY}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mindee API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        const doc = result.document;

        const getField = (field) => field?.value ?? null;

        const extractedData = {
            vendorName: getField(doc.supplier) || 'Unknown Vendor',
            vendorAddress: getField(doc.supplier_address) || 'Not Found',
            invoiceNumber: getField(doc.invoice_number) || 'Not Found',
            invoiceDate: getField(doc.invoice_date) || 'Not Found',
            poNumber: getField(doc.purchase_order_number) || 'Not Found',
            dueDate: getField(doc.due_date) || 'Not Found',
            billTo: getField(doc.customer_name) || 'Not Found',
            shipTo: getField(doc.ship_to_address) || 'Not Found',
            lineItems: (doc.line_items || []).map(item => ({
                qty: item.quantity?.value ?? '1',
                description: item.description?.value ?? '',
                unitPrice: `$${item.unit_price?.value ?? '0.00'}`,
                amount: `$${item.total_amount?.value ?? '0.00'}`,
            })),
            subtotal: getField(doc.subtotal) ?? 0,
            salesTax: getField(doc.total_tax) ?? 0,
            totalAmount: getField(doc.total_amount) ?? 0,
            terms: getField(doc.payment_terms) || 'Not Found',
            bankDetails: 'Not Found',
        };

        res.json({ success: true, extractedData });
    } catch (error) {
        console.error('Mindee error:', error);
        res.status(500).json({ error: 'Invoice processing failed' });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend is LIVE on port ${PORT}`);
});