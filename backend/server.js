const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send('✅ Nestle Finance Backend (Gemini Edition) is Awake and Ready!');
});

// Store image in memory buffer so we can pass it directly to Gemini
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini with your provided API key
const genAI = new GoogleGenerativeAI("AIzaSyCges7kUXpqG69X7mKU3jxIiGJTbjgaTfE");

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        console.log('Sending Invoice to Gemini Vision AI...');

        // 1. Switch to the universally available 1.0 Vision model
        const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            }
        };

        // 2. The Prompt (Told strictly to return raw JSON and NO markdown)
        const prompt = `
        You are an expert financial data extraction AI. 
        Analyze this invoice image and extract the following information.
        You MUST return ONLY a raw JSON object. Do not include formatting blocks like \`\`\`json.
        If a field is missing, return "Not Found".
        Format money as raw numbers (e.g., 204.75).
        
        {
            "vendorName": "Company Name",
            "vendorAddress": "Full vendor address",
            "invoiceNumber": "Invoice ID",
            "invoiceDate": "Date of invoice",
            "poNumber": "Purchase Order Number if present",
            "dueDate": "Due date if present",
            "billTo": "Full Bill To address/name",
            "shipTo": "Full Ship To address/name",
            "subtotal": 0.00,
            "salesTax": 0.00,
            "totalAmount": 0.00,
            "terms": "Payment terms",
            "bankDetails": "Any banking/payment routing info",
            "lineItems": [
                {
                    "qty": "Quantity",
                    "description": "Item description",
                    "unitPrice": "Price per unit",
                    "amount": "Total line amount"
                }
            ]
        }
        `;

        const result = await model.generateContent([prompt, imagePart]);
        let responseText = result.response.text();
        
        // 3. Clean up the response just in case Gemini adds markdown anyway
        responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        const extractedData = JSON.parse(responseText);
        
        console.log('Gemini Extraction Successful!');
        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({ error: 'Failed to process document via Gemini AI' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Gemini Backend is LIVE on port ${port}`);
});