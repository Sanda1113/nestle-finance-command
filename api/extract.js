// api/extract.js
import multer from 'multer';
import Tesseract from 'tesseract.js';

const upload = multer({ storage: multer.memoryStorage() }).single('invoiceFile');

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // --- ADD THESE HEADERS FOR VERCEL ---
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  // ------------------------------------

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const runMiddleware = (req, res, fn) => new Promise((resolve, reject) => {
    fn(req, res, (result) => (result instanceof Error ? reject(result) : resolve(result)));
  });

  try {
    await runMiddleware(req, res, upload);
    const { data: { text } } = await Tesseract.recognize(req.file.buffer, 'eng');
    
    // Improved Regex for the John Smith demo
    const totalMatch = text.match(/\bTOTAL\b[\s$]*([\d,]+\.\d{2})/i);
    const invMatch = text.match(/(?:Invoice\s*#|INV)[\s:]*([A-Z0-9-]+)/i);

    res.status(200).json({ 
      success: true, 
      extractedData: { 
        totalAmount: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 0.00,
        invoiceNumber: invMatch ? invMatch[1] : "N/A"
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}