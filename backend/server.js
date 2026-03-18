const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send('✅ Nestle Finance Backend is Awake and Ready!');
});

const upload = multer({ storage: multer.memoryStorage() });

// Initialize Document AI client (uses ADC automatically)
const client = new DocumentProcessorServiceClient({
    apiEndpoint: 'us-documentai.googleapis.com', // matches the processor region
});

// Processor details from your project
const projectId = 'nestle-finance-command';
const location = 'us';
const processorId = '6af1dd384a1381e5';
const processorName = projects/${projectId}/locations/${location}/processors/${processorId};

app.post('/api/extract-invoice', upload.single('invoiceFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        // Prepare the request for Document AI
        const request = {
            name: processorName,
            rawDocument: {
                content: req.file.buffer.toString('base64'),
                mimeType: req.file.mimetype,
            },
        };

        // Call the Document AI API
        const [result] = await client.processDocument(request);
        const { document } = result;

        // Helper to get first value of an entity type
        const getEntity = (type) => {
            const entity = document.entities.find(e => e.type === type);
            return entity ? entity.mentionText || entity.normalizedValue?.text || '' : null;
        };

        // Extract address blocks (can be multi-line)
        const getAddress = (type) => {
            const entity = document.entities.find(e => e.type === type);
            return entity ? entity.mentionText.replace(/\n/g, ' ').trim() : 'Not Found';
        };

        // Map Document AI entities to our response structure
        const extractedData = {
            // Vendor
            vendorName: getEntity('supplier_name') || 'Unknown Vendor',
            vendorAddress: getAddress('supplier_address') || 'Not Found',

            // Invoice metadata
            invoiceNumber: getEntity('invoice_id') || 'Not Found',
            invoiceDate: getEntity('invoice_date') || 'Not Found',
            poNumber: getEntity('purchase_order') || 'Not Found',
            dueDate: getEntity('payment_terms_due_date') || 'Not Found',

            // Customer addresses
            billTo: getAddress('customer_name') + ' ' + (getAddress('customer_address') || '') || 'Not Found',
            shipTo: getAddress('ship_to_address') || 'Not Found', // may need concatenation

            // Line items
            lineItems: (document.entities.filter(e => e.type === 'line_item') || []).map(item => {
                const props = item.properties || [];
                const qty = props.find(p => p.type === 'line_item/quantity')?.mentionText || '1';
                const desc = props.find(p => p.type === 'line_item/description')?.mentionText || '';
                const unitPrice = props.find(p => p.type === 'line_item/unit_price')?.mentionText || '0.00';
                const amount = props.find(p => p.type === 'line_item/amount')?.mentionText || '0.00';
                return {
                    qty,
                    description: desc,
                    unitPrice: unitPrice.startsWith('$') ? unitPrice : $${unitPrice},
                    amount: amount.startsWith('$') ? amount : $${amount},
                };
            }),

            // Totals
            subtotal: parseFloat(getEntity('subtotal')?.replace(/[$,]/g, '') || '0'),
            salesTax: parseFloat(getEntity('tax_amount')?.replace(/[$,]/g, '') || '0'),
            totalAmount: parseFloat(getEntity('total_amount')?.replace(/[$,]/g, '') || '0'),

            // Terms & bank – may not be standard entities; fallback to raw text search if needed
            terms: getEntity('payment_terms') || 'Not Found',
            bankDetails: 'Not Found', // Document AI doesn't extract bank details by default; could add custom processor or OCR fallback
        };

        // Optionally, if you need bank details, you could fallback to raw OCR:
        // const rawText = document.text;
        // const bankMatch = rawText.match(/(Name\s*of\s*Bank[\s\S]*)/i);
        // extractedData.bankDetails = bankMatch ? bankMatch[1].replace(/\s+/g, ' ').trim() : 'Not Found';

        res.json({ success: true, extractedData });

    } catch (error) {
        console.error('Document AI error:', error);
        res.status(500).json({ error: 'Invoice processing failed' });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(🚀 Backend is LIVE on port ${PORT});
});