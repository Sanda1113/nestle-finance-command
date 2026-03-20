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
      const response = await axios.post(
        'https://nestle-finance-command-production.up.railway.app/api/extract-invoice',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (response.data.success) {
        const extracted = response.data.extractedData;
        
        // MOCKING PO DATA: In a real scenario, you would use 'extracted.poNumber' 
        // to make a GET request to your database/SAP system here.
        const simulatedPO = {
          poNumber: extracted.poNumber !== "Not Found" ? extracted.poNumber : "PO-804921",
          vendorName: extracted.vendorName !== "Unknown Vendor" ? extracted.vendorName : "Expected Vendor LLC",
          poDate: "2024-02-15",
          expectedAmount: extracted.totalAmount || 0.00,
          status: "Approved",
          buyer: "Nestle Procurement",
        };

        setResult({
          invoice: extracted,
          po: simulatedPO
        });
      }
    } catch (err) {
      console.error("Upload Error:", err);
      setError("Failed to process invoice. Ensure the Railway backend is live.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header Section */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Invoice Reconciliation Engine</h1>
        <p className="text-slate-500">Upload your vendor invoice to perform AI-powered 3-way matching.</p>
        
        <div className="mt-6 flex items-center gap-4">
          <input 
            type="file" 
            onChange={handleFileChange}
            className="block w-full max-w-md text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button 
            onClick={handleUpload}
            disabled={loading}
            className={`px-6 py-2 rounded-lg font-bold text-white transition whitespace-nowrap ${
              loading ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? "AI Scanning..." : "Extract Data"}
          </button>
        </div>
        {error && <p className="mt-4 text-red-500 text-sm font-medium">⚠️ {error}</p>}
      </div>

      {/* Results Dashboard */}
      {result && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-in fade-in duration-500">
          
          {/* Document Comparison Section (Takes up 3 columns) */}
          <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* CARD 1: EXTRACTED INVOICE */}
            <div className="bg-white p-6 rounded-2xl shadow-md border-t-4 border-blue-600 flex flex-col">
              <div className="flex justify-between items-start mb-6 border-b pb-2">
                <h3 className="text-xl font-black text-slate-800">Scanned Invoice</h3>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wider">AI Extracted</span>
              </div>
              
              <div className="space-y-4 flex-grow">
                <div>
                  <p className="text-xs uppercase text-slate-400 font-bold mb-1">Vendor Name</p>
                  <p className="font-bold text-slate-800">{result.invoice.vendorName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400 font-bold mb-1">Invoice #</p>
                  <p className="font-semibold text-slate-800">{result.invoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400 font-bold mb-1">Extracted PO #</p>
                  <p className={`font-semibold ${result.invoice.poNumber !== "Not Found" ? 'text-slate-800' : 'text-red-500'}`}>
                    {result.invoice.poNumber}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-xs uppercase text-slate-400 font-bold mb-1">Billed Amount</p>
                <p className="text-3xl font-black text-blue-700">${result.invoice.totalAmount?.toFixed(2) || "0.00"}</p>
              </div>
            </div>

            {/* CARD 2: SYSTEM PURCHASE ORDER */}
            <div className="bg-white p-6 rounded-2xl shadow-md border-t-4 border-emerald-500 flex flex-col">
              <div className="flex justify-between items-start mb-6 border-b pb-2">
                <h3 className="text-xl font-black text-slate-800">System PO</h3>
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wider">Database Record</span>
              </div>
              
              <div className="space-y-4 flex-grow">
                <div>
                  <p className="text-xs uppercase text-slate-400 font-bold mb-1">Vendor Name</p>
                  <p className="font-bold text-slate-800">{result.po.vendorName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400 font-bold mb-1">PO Status</p>
                  <p className="font-semibold text-emerald-600">{result.po.status}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400 font-bold mb-1">System PO #</p>
                  <p className="font-semibold text-slate-800">{result.po.poNumber}</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-xs uppercase text-slate-400 font-bold mb-1">Expected Amount</p>
                <p className="text-3xl font-black text-emerald-600">${result.po.expectedAmount?.toFixed(2) || "0.00"}</p>
              </div>
            </div>

            {/* Line Items Table (Spans across the bottom of the two cards) */}
            {result.invoice.lineItems && result.invoice.lineItems.length > 0 && (
              <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-md">
                <h4 className="text-lg font-bold text-slate-800 mb-4">Extracted Line Items</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <th className="p-3 font-semibold">Qty</th>
                        <th className="p-3 font-semibold">Description</th>
                        <th className="p-3 font-semibold text-right">Unit Price</th>
                        <th className="p-3 font-semibold text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.invoice.lineItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 text-slate-700">{item.qty}</td>
                          <td className="p-3 font-medium text-slate-800">{item.description}</td>
                          <td className="p-3 text-right text-slate-600">{item.unitPrice}</td>
                          <td className="p-3 text-right font-bold text-slate-800">{item.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Reconciliation Status Card (Right Sidebar) */}
          <div className="bg-slate-800 p-6 rounded-2xl shadow-md h-fit sticky top-6 text-white">
            <h3 className="text-lg font-bold mb-6 border-b border-slate-600 pb-2">Reconciliation</h3>
            
            <div className="space-y-6">
              {/* Match Logic Visualization */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Amount Match</span>
                  {result.invoice.totalAmount === result.po.expectedAmount ? (
                    <span className="text-emerald-400 font-bold">Matched</span>
                  ) : (
                    <span className="text-red-400 font-bold">Mismatch</span>
                  )}
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className={`h-2 rounded-full ${result.invoice.totalAmount === result.po.expectedAmount ? 'bg-emerald-500 w-full' : 'bg-red-500 w-1/2'}`}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">PO Verification</span>
                  {result.invoice.poNumber !== "Not Found" ? (
                    <span className="text-emerald-400 font-bold">Verified</span>
                  ) : (
                    <span className="text-amber-400 font-bold">Missing PO</span>
                  )}
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className={`h-2 rounded-full ${result.invoice.poNumber !== "Not Found" ? 'bg-emerald-500 w-full' : 'bg-amber-500 w-3/4'}`}></div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 mt-4 border-t border-slate-600">
                <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition shadow-sm">
                  Approve & Post to SAP
                </button>
                <button className="w-full py-3 mt-2 bg-transparent border border-slate-500 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition">
                  Flag for Review
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}