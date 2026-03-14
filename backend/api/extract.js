import multer from 'multer';
import Tesseract from 'tesseract.js';

const upload = multer({ storage: multer.memoryStorage() }).single('invoiceFile');

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const runMiddleware = (req, res, fn) => new Promise((resolve, reject) => {
    fn(req, res, (result) => (result instanceof Error ? reject(result) : resolve(result)));
  });

  try {
    await runMiddleware(req, res, upload);
    const { data: { text } } = await Tesseract.recognize(req.file.buffer, 'eng');
    
    // Extract the Total for the demo
    const totalMatch = text.match(/\bTOTAL\b[\s$]*([\d,]+\.\d{2})/i);
    
    res.status(200).json({ 
      success: true, 
      extractedData: { totalAmount: totalMatch ? totalMatch[1] : "Field not found" },
      rawText: text 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}