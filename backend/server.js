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

        const { data: { text } } = await Tesseract.recognize(req.file.buffer, 'eng');
        
        // --- IMPROVED PARSING LOGIC ---
        
        // 1. Cleaner Vendor Name (Take the first line and remove the word "INVOICE")
        let vendorName = text.trim().split('\n')[0].replace(/INVOICE/gi, '').trim();

        // 2. Smarter Invoice Number (Looks for codes like INT-001 or just digits after #)
        const invMatch = text.match(/(?:Invoice\s*#|INV|No\.)[\s:]*([A-Z0-9-]+)/i);
        
        // 3. PO Number (The one in your image 2412/2019 has a slash)
        const poMatch = text.match(/(?:P\.O\.#|P\.O\.|PO)[\s:]*([A-Z0-9\/]+)/i);

        // 4. Total Amount (Handles the $ sign and commas)
        const totalMatch = text.match(/TOTAL[\s$]*([\d,]+\.\d{2})/i);

        // 5. Line Items (Improved to catch "Labor 3hrs" etc)
        const lineItems = [];
        const lines = text.split('\n');
        lines.forEach(line => {
            const row = line.match(/^(\d+)\s+(.+?)\s+([\d,.]+)\s+([\d,.]+)$/);
            if (row) {
                lineItems.push({
                    qty: row[1],
                    description: row[2].trim(),
                    unitPrice: `$${row[3]}`,
                    amount: `$${row[4]}`
                });
            }
        });

        const extractedData = {
            vendorName: vendorName || "Unknown Vendor",
            invoiceNumber: invMatch ? invMatch[1] : "Not Found",
            poNumber: poMatch ? poMatch[1] : "Not Found",
            totalAmount: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 0.00,
            lineItems: lineItems.length > 0 ? lineItems : null
        };

        res.json({ success: true, extractedData });

    } catch (error) {
        res.status(500).json({ error: 'AI processing failed' });
    }
});

// 4. CRITICAL: Force Express to bind to Railway's external network
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Backend is LIVE and listening on port ${PORT}`);
});