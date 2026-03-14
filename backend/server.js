// backend/server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Tesseract = require('tesseract.js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors()); 
app.use(express.json());

// Set up Multer to handle file uploads in memory
const upload = multer({ storage: multer.memoryStorage() });

// --- API ENDPOINT: Advanced AI OCR Ingestion ---
app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        console.log('Document received. Starting AI OCR Scan...');

        const { data: { text } } = await Tesseract.recognize(req.file.buffer, 'eng');
        console.log('Scan complete. Parsing complex data...');

        // 1. ADVANCED REGEX PARSING
        const vendorNameMatch = text.trim().split('\n')[0]; 
        const invMatch = text.match(/(?:Invoice\s*#|Invoice\s*No\.?|INV)[\s:]*([A-Z0-9-]+)/i);
        const poMatch = text.match(/(?:P\.O\.#|P\.O\.|PO\s*#|Purchase\s*Order)[\s:]*([A-Z0-9\/-]+)/i);
        const invDateMatch = text.match(/Invoice\s*Date[\s:]*([\d\/-]+)/i);
        const dueDateMatch = text.match(/Due\s*Date[\s:]*([\d\/-]+)/i);
        
        // Explicitly looks for TOTAL as a whole word to ignore Subtotal
        const totalMatch = text.match(/\bTOTAL\b[\s$]*([\d,]+\.\d{2})/i);

        // 2. EXTRACT TABLE LINE ITEMS
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

        // 3. COMPILE RESULTS 
        const extractedData = {
            vendorName: vendorNameMatch || null,
            invoiceNumber: invMatch ? invMatch[1].trim() : null,
            poNumber: poMatch ? poMatch[1].trim() : null,
            invoiceDate: invDateMatch ? invDateMatch[1].trim() : null,
            dueDate: dueDateMatch ? dueDateMatch[1].trim() : null,
            totalAmount: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : null,
            lineItems: lineItems.length > 0 ? lineItems : null
        };

        const missingFields = Object.keys(extractedData).filter(key => extractedData[key] === null);

        // 4. SEND RESPONSE
        res.json({
            success: true,
            extractedData,
            missingFields,
            rawText: text 
        });

    } catch (error) {
        console.error('AI Processing Error:', error);
        res.status(500).json({ error: 'Failed to process document' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`🚀 FinanceCommand AI Backend running on http://localhost:${port}`);
});