const express = require('express');
const cors = require('cors');
const multer = require('multer');

// Load .env in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send('✅ Nestle Finance Backend (Mindee REST API) is Awake!');
});

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        console.log('🚀 Sending to Mindee API...');

        // Build form data for native fetch
        const formData = new FormData();
        formData.append('document', new Blob([req.file.buffer]), req.file.originalname);

        // 1. CRITICAL FIX: Corrected URL to .net and /invoices/
        const response = await fetch('https://api.mindee.net/v1/products/mindee/invoices/v4/predict', {
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
        
        // 2. CRITICAL FIX: Corrected JSON path to reach the actual data
        const doc = result.document?.inference?.prediction;

        if (!doc) {
            throw new Error("Invalid response structure from Mindee");
        }

        // Helper to extract the 'value' from Mindee's wrapper objects
        const getField = (field) => field?.value ?? null;

        // 3. CRITICAL FIX: Mapped to Mindee's exact V4 field names
        const extractedData = {
            vendorName: getField(doc.supplier_name) || 'Unknown Vendor',
            vendorAddress: getField(doc.supplier_address) || 'Not Found',
            invoiceNumber: getField(doc.invoice_number) || 'Not Found',
            invoiceDate: getField(doc.date) || 'Not Found',
            poNumber: getField(doc.reference_numbers?.[0]) || 'Not Found',
            dueDate: getField(doc.due_date) || 'Not Found',
            billTo: getField(doc.customer_name) || 'Not Found',
            shipTo: getField(doc.shipping_address) || 'Not Found',
            
            // In the native REST API, line items are direct arrays, not wrapped in .value
            lineItems: (doc.line_items || []).map(item => ({
                qty: item.quantity?.toString() ?? '1',
                description: item.description ?? '',
                unitPrice: `$${item.unit_price ? item.unit_price.toFixed(2) : '0.00'}`,
                amount: `$${item.total_amount ? item.total_amount.toFixed(2) : '0.00'}`,
            })),
            
            subtotal: getField(doc.total_net) ?? 0,
            salesTax: getField(doc.total_tax) ?? 0,
            totalAmount: getField(doc.total_amount) ?? 0,
            terms: 'Check Due Date',
            bankDetails: 'Not Found',
        };

        console.log('✅ Mindee Extraction Successful!');
        res.json({ success: true, extractedData });
    } catch (error) {
        console.error('❌ Mindee error:', error);
        res.status(500).json({ error: 'Invoice processing failed', details: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Backend is LIVE on port ${port}`);
});