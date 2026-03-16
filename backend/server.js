const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Tesseract = require('tesseract.js');

const app = express();
// Railway dynamically assigns a PORT. We MUST use process.env.PORT.
const port = process.env.PORT || 5000; 

// 1. Bulletproof CORS policy
app.use(cors({
    origin: '*', // Allows Vercel to connect
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 2. Health Check Route (To test if it's awake)
app.get('/', (req, res) => {
    res.status(200).send('✅ Nestle Finance Backend is Awake and Ready!');
});

// Setup File Uploads
const upload = multer({ storage: multer.memoryStorage() });

// 3. The AI Extraction Endpoint
app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        console.log('Starting AI OCR Scan...');
        const { data: { text } } = await Tesseract.recognize(req.file.buffer, 'eng');
        console.log('Scan complete. Parsing data...');

        // Advanced Regex Parsing
        const vendorNameMatch = text.trim().split('\n')[0]; 
        const invMatch = text.match(/(?:Invoice\s*#|Invoice\s*No\.?|INV)[\s:]*([A-Z0-9-]+)/i);
        const poMatch = text.match(/(?:P\.O\.#|P\.O\.|PO\s*#|Purchase\s*Order)[\s:]*([A-Z0-9\/-]+)/i);
        const totalMatch = text.match(/\bTOTAL\b[\s$]*([\d,]+\.\d{2})/i);

        // Parse out the line items
        const lineItems = [];
        const lineItemRegex = /(?:^|\n)(\d+)\s+([A-Za-z0-9\s\-_]+?)\s+(\d+\.\d{2})\s+(\d+\.\d{2})/g;
        let match;
        while ((match = lineItemRegex.exec(text)) !== null) {
            lineItems.push({
                qty: match[1],
                description: match[2].trim(),
                unitPrice: `$${match[3]}`,
                amount: `$${match[4]}`
            });
        }

        const extractedData = {
            vendorName: vendorNameMatch || "Unknown",
            invoiceNumber: invMatch ? invMatch[1].trim() : "Not Found",
            poNumber: poMatch ? poMatch[1].trim() : "Not Found",
            totalAmount: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 0.00,
            lineItems: lineItems.length > 0 ? lineItems : null
        };

        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('AI Processing Error:', error);
        res.status(500).json({ error: 'Failed to process document' });
    }
});

// 4. CRITICAL: Force Express to bind to Railway's external network
app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Backend running on port ${port}`);
});