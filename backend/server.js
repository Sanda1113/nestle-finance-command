const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send('✅ Nestle Finance Backend (Mindee Enterprise AI) is Awake and Ready!');
});

const upload = multer({ storage: multer.memoryStorage() });

// 🚀 Your Official Mindee API Key
const MINDEE_API_KEY = "md_3eCFB-xbKwVxP5WZTL6gwJbHU8VV0exqi_RZYaZygzc";

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        console.log('Sending Invoice to Mindee AI...');

        const formData = new FormData();
        formData.append('document', req.file.buffer, {
            filename: req.file.originalname || 'invoice.png',
            contentType: req.file.mimetype || 'image/png',
        });

        // Calling the Official Mindee Invoice V4 Endpoint
        const response = await axios.post(
            'https://api.mindee.net/v1/products/mindee/invoices/v4/predict',
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Token ${MINDEE_API_KEY}`
                }
            }
        );

        // Extracting the data based exactly on your schema
        const prediction = response.data.document.inference.prediction;

        // --- SMART MAPPING LOGIC ---
        
        // Handle Addresses (Mindee stores them as nested objects)
        const vendorAddress = prediction.supplier_address?.address || prediction.supplier_address?.value || "Not Found";
        const customerName = prediction.customer_name?.value || "";
        const customerAddress = prediction.customer_address?.address || prediction.customer_address?.value || "";
        const billTo = [customerName, customerAddress].filter(Boolean).join(", ") || "Not Found";
        const shipTo = prediction.shipping_address?.address || prediction.shipping_address?.value || billTo;

        // Handle Bank Details
        const bankData = prediction.supplier_payment_details?.[0];
        let bankDetails = "Not Found";
        if (bankData) {
            bankDetails = `Account: ${bankData.account_number || 'N/A'}, Routing: ${bankData.routing_number || 'N/A'}`;
        }

        // --- BUILD FRONTEND RESPONSE ---
        const extractedData = {
            vendorName: prediction.supplier_name?.value || "Unknown Vendor",
            vendorAddress: vendorAddress,
            invoiceNumber: prediction.invoice_number?.value || "Not Found",
            invoiceDate: prediction.date?.value || "Not Found",
            poNumber: prediction.po_number?.value || prediction.reference_numbers?.[0]?.value || "Not Found",
            dueDate: prediction.due_date?.value || "Not Found",
            billTo: billTo,
            shipTo: shipTo,
            subtotal: prediction.total_net?.value || 0.00,
            salesTax: prediction.total_tax?.value || 0.00,
            totalAmount: prediction.total_amount?.value || 0.00,
            terms: "Check Due Date", // Generic fallback
            bankDetails: bankDetails,
            
            // Map Line Items safely
            lineItems: prediction.line_items?.length > 0 ? prediction.line_items.map(item => ({
                qty: item.quantity?.toString() || "1",
                description: item.description || "Item",
                unitPrice: `$${item.unit_price ? item.unit_price.toFixed(2) : "0.00"}`,
                amount: `$${item.total_price ? item.total_price.toFixed(2) : "0.00"}`
            })) : null
        };

        console.log('Mindee Extraction Successful! Sending to Frontend...');
        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('Mindee API Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to process document via Mindee AI' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Mindee Backend is LIVE on port ${port}`);
});