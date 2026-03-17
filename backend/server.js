const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send('✅ Gemini Invoice Extractor is Live');
});

const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini with environment variable
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('❌ GEMINI_API_KEY is not set');
} else {
    console.log('✅ GEMINI_API_KEY is set (length: ' + apiKey.length + ')');
}
const genAI = new GoogleGenerativeAI(apiKey);

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Convert image to base64
        const imageBase64 = req.file.buffer.toString('base64');

        // Prompt for structured extraction
        const prompt = `
You are an expert at extracting structured data from invoices.
Extract the following fields from this invoice image and return them in **valid JSON only** (no extra text, no markdown):

{
  "vendorName": "string",
  "vendorAddress": "string",
  "invoiceNumber": "string",
  "invoiceDate": "string (YYYY-MM-DD)",
  "poNumber": "string",
  "dueDate": "string (YYYY-MM-DD)",
  "billTo": "string (full address)",
  "shipTo": "string (full address)",
  "subtotal": number,
  "salesTax": number,
  "totalAmount": number,
  "terms": "string",
  "bankDetails": "string",
  "lineItems": [
    {
      "qty": "string or number",
      "description": "string",
      "unitPrice": number,
      "amount": number
    }
  ]
}

If a field is not found, use null. Use the exact field names.
`;

        // Use gemini-pro (stable, widely available)
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        // Note: gemini-pro does not support image input directly.
        // We need to use gemini-pro-vision for images. But gemini-pro-vision might be available as "gemini-pro-vision".
        // Let's check: The error earlier was with gemini-1.5-flash, which does support images.
        // Actually, gemini-pro is text-only, so it won't work with images. We need a vision model.
        // The correct model for images is "gemini-pro-vision" (older) or "gemini-1.5-flash" (newer).
        // Since gemini-1.5-flash gave 404, maybe it's not enabled for this API key. Let's try "gemini-pro-vision".
        // We'll change to "gemini-pro-vision".

        const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: req.file.mimetype,
                    data: imageBase64
                }
            }
        ]);

        const responseText = result.response.text();

        // Clean response (remove markdown code fences if present)
        let jsonStr = responseText.replace(/```json\n?|```/g, '').trim();
        const extractedData = JSON.parse(jsonStr);

        // Ensure numbers are parsed correctly
        if (extractedData.subtotal) extractedData.subtotal = parseFloat(extractedData.subtotal);
        if (extractedData.salesTax) extractedData.salesTax = parseFloat(extractedData.salesTax);
        if (extractedData.totalAmount) extractedData.totalAmount = parseFloat(extractedData.totalAmount);
        if (extractedData.lineItems) {
            extractedData.lineItems = extractedData.lineItems.map(item => ({
                ...item,
                qty: item.qty?.toString() || '',
                unitPrice: parseFloat(item.unitPrice) || 0,
                amount: parseFloat(item.amount) || 0
            }));
        }

        // Replace nulls with "Not Found" for string fields
        const finalData = {
            vendorName: extractedData.vendorName || 'Not Found',
            vendorAddress: extractedData.vendorAddress || 'Not Found',
            invoiceNumber: extractedData.invoiceNumber || 'Not Found',
            invoiceDate: extractedData.invoiceDate || 'Not Found',
            poNumber: extractedData.poNumber || 'Not Found',
            dueDate: extractedData.dueDate || 'Not Found',
            billTo: extractedData.billTo || 'Not Found',
            shipTo: extractedData.shipTo || 'Not Found',
            subtotal: extractedData.subtotal || 0,
            salesTax: extractedData.salesTax || 0,
            totalAmount: extractedData.totalAmount || 0,
            terms: extractedData.terms || 'Not Found',
            bankDetails: extractedData.bankDetails || 'Not Found',
            lineItems: extractedData.lineItems && extractedData.lineItems.length > 0 ? extractedData.lineItems : null
        };

        res.json({ success: true, extractedData: finalData });

    } catch (error) {
        console.error('❌ Gemini error:', error);
        res.status(500).json({ error: 'Invoice processing failed', details: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});