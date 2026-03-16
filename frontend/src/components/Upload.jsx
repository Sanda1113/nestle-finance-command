// frontend/src/components/Upload.jsx
import { useState } from 'react';
import axios from 'axios';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('invoiceFile', file);

    try {
      // 🚀 CRITICAL UPDATE: Pointing to the live Railway Backend
      const response = await axios.post('https://nestle-finance-command-production.up.railway.app/api/extract-invoice', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        setResult(response.data.extractedData);
      }
    } catch (err) {
      console.error("Upload Error:", err);
      setError("Failed to process invoice. Ensure the Railway backend is live.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header Section */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Invoice Reconciliation Engine</h1>
        <p className="text-slate-500">Upload your vendor invoice to perform AI-powered 3-way matching.</p>
        
        <div className="mt-6 flex items-center gap-4">
          <input 
            type="file" 
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button 
            onClick={handleUpload}
            disabled={loading}
            className={`px-6 py-2 rounded-lg font-bold text-white transition ${loading ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? "AI Scanning..." : "Extract Data"}
          </button>
        </div>
        {error && <p className="mt-4 text-red-500 text-sm font-medium">⚠️ {error}</p>}
      </div>

      {/* Results Dashboard */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-500">
          
          {/* Main Info Card */}
          <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-md border-t-4 border-blue-600">
            <h3 className="text-lg font-bold text-slate-700 mb-4 border-bottom pb-2">Extracted Details</h3>
            <div className="grid grid-cols-2 gap-y-4">
              <div>
                <p className="text-xs uppercase text-slate-400 font-bold">Vendor Name</p>
                <p className="font-semibold text-slate-800">{result.vendorName || "Unknown"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400 font-bold">Invoice #</p>
                <p className="font-semibold text-slate-800">{result.invoiceNumber || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400 font-bold">Purchase Order (PO)</p>
                <p className={`font-semibold ${result.poNumber && result.poNumber !== "Not Found" ? 'text-slate-800' : 'text-orange-500 italic'}`}>
                  {result.poNumber || "Missing PO Number"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400 font-bold">Total Amount</p>
                <p className="text-2xl font-black text-blue-700">${result.totalAmount?.toFixed(2) || "0.00"}</p>
              </div>
            </div>

            {/* Line Items Table */}
            {result.lineItems && (
              <div className="mt-8">
                <h4 className="text-sm font-bold text-slate-600 mb-3">Line Items Detected:</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500">
                        <th className="p-2">Qty</th>
                        <th className="p-2">Description</th>
                        <th className="p-2">Unit Price</th>
                        <th className="p-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.lineItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="p-2">{item.qty}</td>
                          <td className="p-2 font-medium">{item.description}</td>
                          <td className="p-2">{item.unitPrice}</td>
                          <td className="p-2 font-bold">{item.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Reconciliation Status Card */}
          <div className="bg-white p-6 rounded-2xl shadow-md border-t-4 border-amber-500 h-fit">
            <h3 className="text-lg font-bold text-slate-700 mb-4">Match Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>3-Way Match:</span>
                <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded">PENDING</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg text-xs text-slate-500 leading-relaxed">
                Matches invoice amount against SAP PO and Goods Received Note (GRN).
              </div>
              <button className="w-full py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-black transition">
                Submit to Finance
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}