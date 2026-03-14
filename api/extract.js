import multer from 'multer';
import Tesseract from 'tesseract.js';

// Vercel helper for file uploads
const upload = multer({ storage: multer.memoryStorage() }).single('invoiceFile');

export const config = {
  api: { bodyParser: false }, // Let multer handle the body
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Promisify Multer
  const runMiddleware = (req, res, fn) => new Promise((resolve, reject) => {
    fn(req, res, (result) => (result instanceof Error ? reject(result) : resolve(result)));
  });

  try {
    await runMiddleware(req, res, upload);
    
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Run AI OCR
    const { data: { text } } = await Tesseract.recognize(req.file.buffer, 'eng');

    // Advanced Regex Parsing
    const vendorNameMatch = text.trim().split('\n')[0]; 
    const invMatch = text.match(/(?:Invoice\s*#|Invoice\s*No\.?|INV)[\s:]*([A-Z0-9-]+)/i);
    const poMatch = text.match(/(?:P\.O\.#|P\.O\.|PO\s*#|Purchase\s*Order)[\s:]*([A-Z0-9\/-]+)/i);
    const totalMatch = text.match(/\bTOTAL\b[\s$]*([\d,]+\.\d{2})/i);

    const extractedData = {
      vendorName: vendorNameMatch || "Unknown",
      invoiceNumber: invMatch ? invMatch[1].trim() : "Not Found",
      poNumber: poMatch ? poMatch[1].trim() : "Not Found",
      totalAmount: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 0.00,
    };

    res.status(200).json({ success: true, extractedData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}