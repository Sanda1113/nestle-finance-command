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

        const { data: { text } } = await Tesseract.recognize(req.file.buffer, 'eng');

        // ----- VENDOR INFO -----
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        const vendorName = lines[0]?.replace(/INVOICE/i, '').trim() || 'Unknown Vendor';

        // Vendor address: lines after vendor name until we hit "Bill To"
        let vendorAddress = '';
        let startIdx = 1;
        while (startIdx < lines.length && !lines[startIdx].includes('Bill To')) {
            vendorAddress += lines[startIdx] + ' ';
            startIdx++;
        }
        vendorAddress = vendorAddress.trim() || 'Not Found';

        // ----- INVOICE METADATA -----
        const invNumMatch = text.match(/(?:Invoice\s*#|INV|No\.)[\s:]*([A-Z0-9-]+)/i);
        const invDateMatch = text.match(/Invoice\s*Date[\s:]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i);
        const poMatch = text.match(/(?:P\.?O\.?#|PO)[\s:]*([A-Z0-9\/\-]+)/i);
        const dueDateMatch = text.match(/Due\s*Date[\s:]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i);

        // ----- ADDRESS BLOCKS (Bill To, Ship To) -----
        const billToRegex = /Bill\s*To\s*([\s\S]*?)(?=Ship\s*To)/i;
        const shipToRegex = /Ship\s*To\s*([\s\S]*?)(?=QTY|\||Item|Description)/i;

        const billToMatch = text.match(billToRegex);
        const shipToMatch = text.match(shipToRegex);

        const billTo = billToMatch ? billToMatch[1].replace(/\s+/g, ' ').trim() : 'Not Found';
        const shipTo = shipToMatch ? shipToMatch[1].replace(/\s+/g, ' ').trim() : 'Not Found';

        // ----- LINE ITEMS -----
        const lineItems = [];
        const itemRegex = /^(\d+)\s+(.+?)\s+(\d+\.\d{2})\s+(\d+\.\d{2})$/;
        lines.forEach(line => {
            const match = line.match(itemRegex);
            if (match) {
                lineItems.push({
                    qty: match[1],
                    description: match[2].trim(),
                    unitPrice: `$${match[3]}`,
                    amount: `$${match[4]}`
                });
            }
        });

        // ----- SUBTOTAL, TAX, TOTAL -----
        const subtotalMatch = text.match(/Subtotal[\s$]*([\d,]+\.\d{2})/i);
        const taxMatch = text.match(/Sales\s*Tax\s*[\d\.]+%\s*([\d,]+\.\d{2})/i);
        const totalMatch = text.match(/TOTAL[\s$]*([\d,]+\.\d{2})/i);

        // ----- TERMS & BANK -----
        const termsMatch = text.match(/Terms\s*&\s*Conditions\s*([\s\S]*?)(?=Name\s*of\s*Bank)/i);
        const bankMatch = text.match(/(Name\s*of\s*Bank[\s\S]*)/i);

        const terms = termsMatch ? termsMatch[1].replace(/\s+/g, ' ').trim() : 'Not Found';
        const bankDetails = bankMatch ? bankMatch[1].replace(/\s+/g, ' ').trim() : 'Not Found';

        // ----- BUILD RESPONSE -----
        const extractedData = {
            vendorName,
            vendorAddress,
            invoiceNumber: invNumMatch ? invNumMatch[1] : 'Not Found',
            invoiceDate: invDateMatch ? invDateMatch[1] : 'Not Found',
            poNumber: poMatch ? poMatch[1] : 'Not Found',
            dueDate: dueDateMatch ? dueDateMatch[1] : 'Not Found',
            billTo,
            shipTo,
            lineItems: lineItems.length ? lineItems : null,
            subtotal: subtotalMatch ? parseFloat(subtotalMatch[1].replace(/,/g, '')) : 0.00,
            salesTax: taxMatch ? parseFloat(taxMatch[1].replace(/,/g, '')) : 0.00,
            totalAmount: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 0.00,
            terms,
            bankDetails
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