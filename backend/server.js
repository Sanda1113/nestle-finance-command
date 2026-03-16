const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Tesseract = require('tesseract.js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// CRITICAL: Open CORS so Vercel can talk to Render
app.use(cors({
    origin: '*', // Allows any frontend link to connect
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Setup Multer for handling file uploads in memory
const upload = multer({ storage: multer.memoryStorage() });

// The AI Extraction Endpoint
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
        const invDateMatch = text.match(/Invoice\s*Date[\s:]*([\d\/-]+)/i);
        const dueDateMatch = text.match(/Due\s*Date[\s:]*([\d\/-]+)/i);
        const totalMatch = text.match(/\bTOTAL\b[\s$]*([\d,]+\.\d{2})/i);

        // Line Items Parsing
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
            invoiceDate: invDateMatch ? invDateMatch[1].trim() : "Not Found",
            dueDate: dueDateMatch ? dueDateMatch[1].trim() : "Not Found",
            totalAmount: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 0.00,
            lineItems: lineItems.length > 0 ? lineItems : null
        };

        res.json({ success: true, extractedData, missingFields: [] });

    } catch (error) {
        console.error('AI Processing Error:', error);
        res.status(500).json({ error: 'Failed to process document' });
    }
});

// Start the server
app.listen(port, () => console.log(`🚀 Backend running on port ${port}`));