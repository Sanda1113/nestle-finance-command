import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Upload() {
  // File States
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [poFile, setPoFile] = useState(null);
  
  // Extraction States
  const [loading, setLoading] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState(null);
  const [poResult, setPoResult] = useState(null);
  const [error, setError] = useState(null);

  // Match Status State
  const [matchStatus, setMatchStatus] = useState('Pending'); // Pending, Approved, Rejected, Error

  // Automatically check for a match when both results arrive
  useEffect(() => {
    if (invoiceResult && poResult) {
      // Basic 3-Way Match Logic Demo: Checking if Totals match
      if (invoiceResult.totalAmount === poResult.totalAmount) {
        setMatchStatus('Approved');
      } else {
        setMatchStatus('Rejected');
      }
    }
  }, [invoiceResult, poResult]);

  const handleFileChange = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      if (type === 'invoice') setInvoiceFile(e.target.files[0]);
      if (type === 'po') setPoFile(e.target.files[0]);
      
      setError(null);
      setInvoiceResult(null);
      setPoResult(null);
      setMatchStatus('Pending');
    }
  };

  const handleUpload = async () => {
    if (!invoiceFile || !poFile) {
      setError("Please upload BOTH an Invoice and a Purchase Order to run a comparison.");
      return;
    }

    setLoading(true);
    setInvoiceResult(null);
    setPoResult(null);
    setError(null);
    setMatchStatus('Pending');

    const invoiceFormData = new FormData();
    invoiceFormData.append('invoiceFile', invoiceFile);

    const poFormData = new FormData();
    poFormData.append('invoiceFile', poFile); // Using the same field name for the current backend endpoint

    try {
      // Send BOTH files to the backend in parallel
      const [invoiceRes, poRes] = await Promise.all([
        axios.post('https://nestle-finance-command-production.up.railway.app/api/extract-invoice', invoiceFormData, { headers: { 'Content-Type': 'multipart/form-data' } }),
        axios.post('https://nestle-finance-command-production.up.railway.app/api/extract-invoice', poFormData, { headers: { 'Content-Type': 'multipart/form-data' } })
      ]);

      if (invoiceRes.data.success && poRes.data.success) {
        setInvoiceResult(invoiceRes.data.extractedData);
        setPoResult(poRes.data.extractedData);
      } else {
        throw new Error("One or both extractions failed to return successful data.");
      }
    } catch (err) {
      console.error("Upload Error:", err);
      setError("Failed to process documents. Ensure the backend is live and accepts both files.");
      setMatchStatus('Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-800">Reconciliation Command Center</h1>
        <p className="text-slate-500 mt-1">Upload vendor documents for automated 3-way matching and discrepancy detection.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ================= LEFT COLUMN: CONTROL PANEL ================= */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Invoice Upload */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">1</span> 
              Upload Invoice
            </h3>
            <input 
              type="file" 
              onChange={(e) => handleFileChange(e, 'invoice')}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>

          {/* PO Upload */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">2</span> 
              Upload Purchase Order
            </h3>
            <input 
              type="file" 
              onChange={(e) => handleFileChange(e, 'po')}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
            />
          </div>

          {/* Action Button */}
          <button 
            onClick={handleUpload}
            disabled={loading || !invoiceFile || !poFile}
            className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-md ${
              loading || !invoiceFile || !poFile ? 'bg-slate-300 cursor-not-allowed shadow-none' : 'bg-slate-800 hover:bg-black'
            }`}
          >
            {loading ? "Running AI Extraction..." : "Extract & Compare Data"}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}
        </div>

        {/* ================= RIGHT COLUMN: DASHBOARD ================= */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Status Widget */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Reconciliation Status</h2>
              <p className="text-slate-600 text-sm">System comparison of Invoice vs. Purchase Order</p>
            </div>
            <div>
              {matchStatus === 'Pending' && <span className="px-4 py-2 bg-slate-100 text-slate-600 font-black rounded-lg uppercase tracking-wide">Pending</span>}
              {matchStatus === 'Approved' && <span className="px-4 py-2 bg-emerald-100 text-emerald-700 font-black rounded-lg uppercase tracking-wide">✅ Approved Match</span>}
              {matchStatus === 'Rejected' && <span className="px-4 py-2 bg-red-100 text-red-700 font-black rounded-lg uppercase tracking-wide">❌ Discrepancy (Rejected)</span>}
              {matchStatus === 'Error' && <span className="px-4 py-2 bg-amber-100 text-amber-700 font-black rounded-lg uppercase tracking-wide">⚠️ System Error</span>}
            </div>
          </div>

          {/* Comparison View */}
          {(invoiceResult || poResult) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Invoice Data Column */}
              <div className="bg-white rounded-2xl shadow-sm border-t-4 border-blue-500 overflow-hidden">
                <div className="bg-slate-50 p-4 border-b border-slate-100">
                  <h3 className="font-black text-slate-800 text-lg">Invoice Details</h3>
                  <p className="text-xs text-slate-500">Extracted from vendor bill</p>
                </div>
                {invoiceResult ? (
                  <div className="p-6 space-y-6">
                    <div>
                      <p className="text-xs uppercase text-slate-400 font-bold">Vendor Name</p>
                      <p className="font-semibold text-slate-800">{invoiceResult.vendorName}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-400 font-bold">Document Number</p>
                      <p className="font-semibold text-slate-800">{invoiceResult.invoiceNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-400 font-bold">Date</p>
                      <p className="font-semibold text-slate-800">{invoiceResult.invoiceDate}</p>
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-xs uppercase text-slate-400 font-bold mb-1">Total Amount</p>
                      <p className="text-2xl font-black text-blue-600">${invoiceResult.totalAmount?.toFixed(2)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-sm text-slate-400 italic">No invoice data available.</div>
                )}
              </div>

              {/* PO Data Column */}
              <div className="bg-white rounded-2xl shadow-sm border-t-4 border-purple-500 overflow-hidden">
                <div className="bg-slate-50 p-4 border-b border-slate-100">
                  <h3 className="font-black text-slate-800 text-lg">Purchase Order Details</h3>
                  <p className="text-xs text-slate-500">Extracted from internal system document</p>
                </div>
                {poResult ? (
                  <div className="p-6 space-y-6">
                    <div>
                      <p className="text-xs uppercase text-slate-400 font-bold">Vendor Name</p>
                      <p className="font-semibold text-slate-800">{poResult.vendorName}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-400 font-bold">Document Number</p>
                      <p className="font-semibold text-slate-800">{poResult.poNumber !== 'Not Found' ? poResult.poNumber : poResult.invoiceNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-400 font-bold">Date</p>
                      <p className="font-semibold text-slate-800">{poResult.invoiceDate}</p>
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-xs uppercase text-slate-400 font-bold mb-1">Total Amount</p>
                      <p className={`text-2xl font-black ${matchStatus === 'Approved' ? 'text-emerald-600' : 'text-red-600'}`}>
                        ${poResult.totalAmount?.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-sm text-slate-400 italic">No PO data available.</div>
                )}
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}