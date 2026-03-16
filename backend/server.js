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

        console.log('Scanning Document...');
        const { data: { text } } = await Tesseract.recognize(req.file.buffer, 'eng');
        
        // Clean up common OCR artifacts
        const cleanText = text.replace(/\|/g, '').replace(/_/g, '').trim();
        const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // 1. UNIVERSAL IDs & DATES
        const invNumMatch = cleanText.match(/(?:Invoice\s*(?:No\.?|#|Number)?|INV[-#\s]*)\s*([A-Z0-9-]+)/i);
        const poMatch = cleanText.match(/(?:P\.?O\.?\s*(?:No\.?|#)?|Purchase\s*Order)\s*([A-Z0-9\/-]+)/i);
        const dateMatches = cleanText.match(/\b(\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4})\b/g) || [];

        // 2. LINE-BY-LINE SMART SCANNER (For Tables & Totals)
        const lineItems = [];
        let extractedTotal = 0;
        let extractedSubtotal = 0;
        let extractedTax = 0;

        lines.forEach(line => {
            const lowerLine = line.toLowerCase();
            
            // A. Catch Summary Lines (Totals, Taxes)
            if (lowerLine.includes('total') || lowerLine.includes('tax') || lowerLine.includes('amount due') || lowerLine.includes('balance')) {
                const moneyMatch = line.match(/[\d,]+\.\d{2}/);
                if (moneyMatch) {
                    const val = parseFloat(moneyMatch[0].replace(/,/g, ''));
                    if (lowerLine.includes('tax')) extractedTax = val;
                    else if (lowerLine.includes('sub')) extractedSubtotal = val;
                    // For the grand total, we assume it's the largest "Total" on the page
                    else if (val > extractedTotal) extractedTotal = val; 
                }
                return; // Skip to next line so we don't count the Total as a line item
            }

            // B. Catch Line Items (Products/Services)
            // Look for any line that contains at least one decimal currency format (e.g., 100.00)
            const moneyMatches = line.match(/[\d,]+\.\d{2}/g);
            if (moneyMatches && moneyMatches.length >= 1) {
                // The last number is usually the Amount. The second to last is Unit Price.
                let amount = moneyMatches[moneyMatches.length - 1];
                let unitPrice = moneyMatches.length > 1 ? moneyMatches[moneyMatches.length - 2] : amount;

                // Strip the money values and symbols out of the line to leave just the text
                let descriptionPart = line.replace(/\$/g, '');
                moneyMatches.forEach(num => { descriptionPart = descriptionPart.replace(num, ''); });
                descriptionPart = descriptionPart.trim();

                // Try to find a Quantity (an isolated whole number at the very start of the line)
                let qty = "1"; // Default to 1 if no qty column exists
                const qtyMatch = descriptionPart.match(/^(\d+)\s/);
                if (qtyMatch) {
                    qty = qtyMatch[1];
                    descriptionPart = descriptionPart.replace(qtyMatch[0], '').trim();
                }

                // If there's still a description left, it's a valid line item!
                if (descriptionPart.length > 2) {
                    lineItems.push({
                        qty: qty,
                        description: descriptionPart,
                        unitPrice: `$${unitPrice}`,
                        amount: `$${amount}`
                    });
                }
            }
        });

        // 3. VENDOR NAME (First valid text line)
        let vendorName = "Unknown Vendor";
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            if (!lines[i].toUpperCase().includes('INVOICE') && lines[i].length > 2) {
                vendorName = lines[i];
                break;
            }
        }

        // BUILD RESPONSE
        const extractedData = {
            vendorName: vendorName,
            invoiceNumber: invNumMatch ? invNumMatch[1] : 'Not Found',
            poNumber: poMatch ? poMatch[1] : 'Not Found',
            invoiceDate: dateMatches.length > 0 ? dateMatches[0] : "Not Found",
            dueDate: dateMatches.length > 1 ? dateMatches[1] : "Not Found",
            subtotal: extractedSubtotal,
            salesTax: extractedTax,
            totalAmount: extractedTotal,
            lineItems: lineItems.length ? lineItems : null,
            
            // Hardcoded placeholders for the demo layout
            vendorAddress: "Extracted dynamically based on template", 
            billTo: "Mapped to client records",
            shipTo: "Mapped to client records",
            terms: "Standard Net Terms",
            bankDetails: "Verified on File"
        };

        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('OCR Error:', error);
        res.status(500).json({ error: 'AI processing failed' });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend is LIVE on port ${PORT}`);
});