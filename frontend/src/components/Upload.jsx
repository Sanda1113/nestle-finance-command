import { useState } from 'react';
import axios from 'axios';
import { UploadCloud, CheckCircle, AlertCircle } from 'lucide-react';

export default function Upload() {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [result, setResult] = useState('');

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setStatus('idle');
            setResult('');
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setStatus('uploading');
        
        const formData = new FormData();
        formData.append('invoiceFile', file);

        try {
            // Sends the PDF to Subath's Node.js server
            const response = await axios.post('http://localhost:5000/api/extract-invoice', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            // Format the extracted data beautifully
            const data = response.data.extractedData;
            setResult(`PO Number: ${data.poNumber}\nTotal Amount: $${data.totalAmount}`);
            setStatus('success');
        } catch (error) {
            console.error('Upload failed:', error);
            setStatus('error');
        }
    };

    return (
        <div className="max-w-2xl p-8 mx-auto mt-12 bg-white border shadow-lg border-slate-200 rounded-xl">
            <h2 className="mb-6 text-2xl font-bold text-slate-800">Submit Invoice for Reconciliation</h2>
            
            <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg bg-slate-50 border-slate-300">
                <UploadCloud className="w-12 h-12 mb-4 text-slate-400" />
                <input 
                    type="file" 
                    accept=".pdf,.png,.jpg" 
                    onChange={handleFileChange} 
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-2"
                />
                <p className="text-xs text-slate-500">Supported formats: PDF, JPG, PNG (Max 10MB)</p>
            </div>

            <button 
                onClick={handleUpload}
                disabled={!file || status === 'uploading'}
                className="w-full py-3 mt-6 font-bold text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
            >
                {status === 'idle' && 'Run AI Data Extraction'}
                {status === 'uploading' && 'AI is reading document...'}
                {status === 'success' && 'Extraction Complete!'}
                {status === 'error' && 'Retry Upload'}
            </button>
            
            {status === 'success' && (
                <div className="p-4 mt-6 border rounded-lg bg-green-50 border-green-200">
                    <div className="flex items-center mb-2 font-bold text-green-800">
                        <CheckCircle className="w-5 h-5 mr-2" /> Extracted Data:
                    </div>
                    <p className="text-lg font-mono text-green-900 whitespace-pre-wrap">{result}</p>
                </div>
            )}

            {status === 'error' && (
                <div className="flex items-center p-4 mt-6 text-red-800 border rounded-lg bg-red-50 border-red-200">
                    <AlertCircle className="w-5 h-5 mr-2" /> 
                    <p className="text-sm">Error connecting to backend. Is Subath's server running?</p>
                </div>
            )}
        </div>
    );
}