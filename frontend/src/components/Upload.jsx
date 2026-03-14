import { useState } from 'react';
import axios from 'axios';
import { UploadCloud, CheckCircle, AlertCircle, XCircle, FileText } from 'lucide-react';

export default function Upload() {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle'); 
    const [data, setData] = useState(null);
    const [missing, setMissing] = useState([]);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setStatus('idle');
            setData(null);
            setMissing([]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setStatus('uploading');
        const formData = new FormData();
        formData.append('invoiceFile', file);

        try {
            const response = await axios.post('http://localhost:5000/api/extract-invoice', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            setData(response.data.extractedData);
            setMissing(response.data.missingFields);
            setStatus('success');
        } catch (error) {
            console.error('Upload failed:', error);
            setStatus('error');
        }
    };

    return (
        <div className="max-w-4xl p-8 mx-auto mt-12 bg-white border shadow-lg border-slate-200 rounded-xl">
            <h2 className="mb-6 text-2xl font-bold text-slate-800">Invoice Reconciliation Engine</h2>
            
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg bg-slate-50 border-slate-300">
                <UploadCloud className="w-12 h-12 mb-4 text-slate-400" />
                <input type="file" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-2" />
            </div>

            <button onClick={handleUpload} disabled={!file || status === 'uploading'} className="w-full py-3 mt-4 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-400">
                {status === 'idle' ? 'Extract Data via AI' : status === 'uploading' ? 'Analyzing Document...' : 'Extraction Complete!'}
            </button>
            
            {status === 'success' && data && (
                <div className="grid grid-cols-1 gap-6 mt-8 md:grid-cols-2">
                    {/* SUCCESS PANEL */}
                    <div className="p-6 border rounded-lg bg-slate-50 border-slate-200">
                        <h3 className="flex items-center mb-4 font-bold text-slate-800 border-b pb-2">
                            <FileText className="w-5 h-5 mr-2 text-blue-600" /> Extracted Invoice Data
                        </h3>
                        <div className="space-y-3 text-sm">
                            <p><span className="font-semibold text-slate-600">Vendor:</span> {data.vendorName || 'N/A'}</p>
                            <p><span className="font-semibold text-slate-600">Invoice #:</span> {data.invoiceNumber || 'N/A'}</p>
                            <p><span className="font-semibold text-slate-600">P.O. #:</span> {data.poNumber || 'N/A'}</p>
                            <p><span className="font-semibold text-slate-600">Inv Date:</span> {data.invoiceDate || 'N/A'}</p>
                            <p><span className="font-semibold text-slate-600">Due Date:</span> {data.dueDate || 'N/A'}</p>
                            <p className="pt-2 mt-2 text-lg border-t border-slate-200">
                                <span className="font-bold text-slate-800">Total Amount:</span> 
                                <span className="float-right font-bold text-green-600">${data.totalAmount || '0.00'}</span>
                            </p>
                        </div>
                    </div>

                    {/* ALERTS & LINE ITEMS PANEL */}
                    <div className="space-y-6">
                        {missing.length > 0 && (
                            <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                                <h3 className="flex items-center mb-2 font-bold text-red-800">
                                    <AlertCircle className="w-5 h-5 mr-2" /> Missing Data Alerts
                                </h3>
                                <p className="text-sm text-red-700 mb-2">The AI could not confidently extract the following required fields. Manual review required:</p>
                                <ul className="pl-5 text-sm font-semibold text-red-600 list-disc">
                                    {missing.map((field, idx) => <li key={idx}>{field}</li>)}
                                </ul>
                            </div>
                        )}

                        {data.lineItems && (
                            <div className="p-4 border rounded-lg bg-slate-50 border-slate-200">
                                <h3 className="mb-2 font-bold text-slate-800">Extracted Line Items</h3>
                                <div className="text-xs">
                                    {data.lineItems.map((item, idx) => (
                                        <div key={idx} className="flex justify-between py-1 border-b border-slate-200 last:border-0">
                                            <span>{item.qty}x {item.description}</span>
                                            <span className="font-semibold">{item.amount}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}