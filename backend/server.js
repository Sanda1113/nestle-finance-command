// backend/server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Tesseract = require('tesseract.js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// API ENDPOINT: AI OCR Extraction
app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        
        console.log('File received. Running AI OCR...');
        const { data: { text } } = await Tesseract.recognize(req.file.buffer, 'eng');
        
        res.json({ success: true, rawText: text });
    } catch (error) {
        console.error('OCR Error:', error);
        res.status(500).json({ error: 'Failed to process document' });
    }
});

app.listen(port, () => console.log(`Backend running on http://localhost:${port}`));