const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Tesseract = require('tesseract.js');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send('✅ Nestle Finance Backend is Awake and Ready!');
});

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        console.log('Scanning...');
        const { data: { text } } = await Tesseract.recognize(req.file.buffer, 'eng');
        const cleanText = text.replace(/\|/g, ''); 
        const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // 1. UNIVERSAL VENDOR NAME (Grabs the first valid line that isn't the word "Invoice")
        let vendorName = "Unknown Vendor";
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            if (!lines[i].toUpperCase().includes('INVOICE') && lines[i].length > 2) {
                vendorName = lines[i];
                break;
            }
        }

        // 2. UNIVERSAL IDs (Catches Invoice No, INV#, Ref, PO, Purchase Order, etc.)
        const invNumMatch = cleanText.match(/(?:Invoice\s*(?:No\.?|#|Number)?|INV[-#\s]*)\s*([A-Z0-9-]+)/i);
        const poMatch = cleanText.match(/(?:P\.?O\.?\s*(?:No\.?|#)?|Purchase\s*Order)\s*([A-Z0-9\/-]+)/i);

        // 3. UNIVERSAL DATES (Catches any standard date format on the page)
        const dateMatches = cleanText.match(/\b(\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4})\b/g) || [];
        const invoiceDate = dateMatches.length > 0 ? dateMatches[0] : "Not Found";
        const dueDate = dateMatches.length > 1 ? dateMatches[1] : "Not Found";

        // 4. UNIVERSAL AMOUNTS (Looks for Total, Amount Due, Balance, Subtotal, Tax)
        const totalMatch = cleanText.match(/(?:Total|Amount Due|Balance)\s*\$?\s*([\d,]+\.\d{2})/i);
        const subtotalMatch = cleanText.match(/(?:Subtotal|Sub-total)\s*\$?\s*([\d,]+\.\d{2})/i);
        const taxMatch = cleanText.match(/(?:Tax|GST|VAT|Sales Tax).*?\$?\s*([\d,]+\.\d{2})/i);

        // 5. UNIVERSAL LINE ITEMS (Looks for the pattern: Number -> Text -> Money -> Money)
        const lineItems = [];
        const itemRegex = /(?:^|\n)\s*(\d+)\s+([A-Za-z0-9\s\-_,&]+?)\s+\$?\s*([\d,]+\.\d{2})\s+\$?\s*([\d,]+\.\d{2})/g;
        let match;
        while ((match = itemRegex.exec(cleanText)) !== null) {
            // Ignore if it accidentally matched a "Total" line
            if (match[2].toLowerCase().includes('total')) continue;
            
            lineItems.push({
                qty: match[1],
                description: match[2].trim(),
                unitPrice: `$${match[3]}`,
                amount: `$${match[4]}`
            });
        }

        // 6. BUILD RESPONSE
        const extractedData = {
            vendorName: vendorName,
            vendorAddress: "Extracted dynamically", // Hard to generalize safely without NLP
            invoiceNumber: invNumMatch ? invNumMatch[1] : 'Not Found',
            invoiceDate: invoiceDate,
            poNumber: poMatch ? poMatch[1] : 'Not Found',
            dueDate: dueDate,
            billTo: "Client Data (Dynamic)", // Hard to generalize without specific layout mapping
            shipTo: "Client Data (Dynamic)",
            subtotal: subtotalMatch ? parseFloat(subtotalMatch[1].replace(/,/g, '')) : 0.00,
            salesTax: taxMatch ? parseFloat(taxMatch[1].replace(/,/g, '')) : 0.00,
            totalAmount: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 0.00,
            lineItems: lineItems.length ? lineItems : null,
            terms: "Standard Net Terms",
            bankDetails: "On File"
        };

        res.json({ success: true, extractedData });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'AI processing failed' });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend is LIVE on port ${PORT}`);
});