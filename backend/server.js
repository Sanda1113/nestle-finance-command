const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Tesseract = require('tesseract.js');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 5000;

// Initialize Supabase (Ready for the next MVP steps)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Middleware
app.use(cors()); // Allows Nehaa's frontend (port 5173) to talk to backend (port 5000)
app.use(express.json());

// Set up Multer to handle file uploads in memory
const upload = multer({ storage: multer.memoryStorage() });

// --- API ENDPOINT: AI OCR Extraction ---
app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('Document received. Starting AI OCR Scan...');

        // 1. Run Tesseract.js AI on the uploaded file
        const { data: { text } } = await Tesseract.recognize(
            req.file.buffer,
            'eng'
        );

        console.log('Scan complete. Parsing data...');

        // 2. REGEX: Extract PO Number (Looks for PO, PO#, Purchase Order)
        const poMatch = text.match(/(?:PO|Purchase\s*Order)\s*(?:#|No|Number|:)?\s*([A-Z0-9-]+)/i);
        const poNumber = poMatch ? poMatch[1].trim() : 'Not Found';

        // 3. REGEX: Extract Total Amount (Looks for Total, Amount Due, $)
        const totalMatch = text.match(/(?:Total|Amount\s*Due|Grand\s*Total)\s*(?::)?\s*(?:USD|\$)?\s*([\d,]+\.\d{2})/i);
        const totalAmount = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : null;

        // 4. Send the structured data back to React
        res.json({
            success: true,
            extractedData: {
                poNumber: poNumber,
                totalAmount: totalAmount
            }
        });

    } catch (error) {
        console.error('AI Processing Error:', error);
        res.status(500).json({ error: 'Failed to process document' });
    }
});

app.listen(port, () => {
    console.log(`🚀 FinanceCommand AI Backend running on http://localhost:${port}`);
});