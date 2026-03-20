import { useState } from 'react';
import axios from 'axios';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // States for the upcoming 3-Way Match feature
  const [verifying, setVerifying] = useState(false);
  const [matchStatus, setMatchStatus] = useState('Pending'); // Pending, Success, Error

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      // Reset states when a new file is chosen
      setResult(null);
      setMatchStatus('Pending');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);
    setMatchStatus('Pending');

    const formData = new FormData();
    formData.append('invoiceFile', file);

    try {
      const response = await axios.post(
        'https://nestle-finance-command-production.up.railway.app/api/extract-invoice',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

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

  const handleVerify = () => {
    // We will replace this with the real Supabase call next!
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setMatchStatus('Success');
    }, 1500);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header & Upload Section */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Invoice Reconciliation Engine</h1>
        <p className="text-slate-500 mb-6">Upload your vendor invoice to perform AI-powered 3-way matching.</p>

        <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
          <input
            type="file"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
          />
          <button
            onClick={handleUpload}
            disabled={loading || !file}
            className={`px-8 py-2.5 rounded-lg font-bold text-white transition-all whitespace-nowrap w-full sm:w-auto shadow-sm ${loading || !file ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900'
              }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : "Extract Data"}
          </button>
        </div>
        {error && <p className="mt-4 text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg border border-red-100">⚠️ {error}</p>}
      </div>

      {/* Results Dashboard */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">

          {/* Main Info Card */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-md border-t-4 border-blue-600">
            <h3 className="text-xl font-black text-slate-800 mb-6 border-b pb-2">Extracted Details</h3>

            {/* Top Metadata Grid */}
            <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-8">
              <div>
                <p className="text-xs uppercase text-slate-400 font-bold mb-1">Vendor Name</p>
                <p className="font-bold text-slate-800 text-lg">{result.vendorName}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400 font-bold mb-1">Invoice #</p>
                <p className="font-semibold text-slate-800">{result.invoiceNumber}</p>
              </div>

              <div>
                <p className="text-xs uppercase text-slate-400 font-bold mb-1">Vendor Address</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{result.vendorAddress}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400 font-bold mb-1">Invoice Date</p>
                <p className="font-semibold text-slate-800">{result.invoiceDate}</p>
              </div>

              <div>
                <p className="text-xs uppercase text-slate-400 font-bold mb-1">Bill To</p>
                <p className="text-sm text-slate-600 pr-4 whitespace-pre-wrap">{result.billTo}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400 font-bold mb-1">Purchase Order (PO)</p>
                <p className={`font-semibold ${result.poNumber !== "Not Found" ? 'text-blue-700' : 'text-amber-600 italic'
                  }`}>
                  {result.poNumber}
                </p>
              </div>
            </div>

            {/* Line Items Table */}
            {result.lineItems && result.lineItems.length > 0 ? (
              <div className="mt-6 border-t border-slate-100 pt-6">
                <h4 className="text-sm font-bold text-slate-600 mb-3 uppercase tracking-wider">Line Items</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <th className="p-3 font-bold">Qty</th>
                        <th className="p-3 font-bold">Description</th>
                        <th className="p-3 font-bold text-right">Unit Price</th>
                        <th className="p-3 font-bold text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.lineItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-slate-700">{item.qty}</td>
                          <td className="p-3 font-medium text-slate-800">{item.description || '-'}</td>
                          <td className="p-3 text-right text-slate-600">{item.unitPrice}</td>
                          <td className="p-3 text-right font-bold text-slate-800">{item.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="mt-6 border-t pt-6">
                <p className="text-sm text-slate-400 italic">No line items detected on this document.</p>
              </div>
            )}

            {/* Financial Summary */}
            <div className="mt-8 flex justify-end">
              <div className="w-full sm:w-1/2 space-y-3 bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                <div className="flex justify-between text-sm text-slate-600">
                  <span className="font-bold">Subtotal:</span>
                  <span>${result.subtotal?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span className="font-bold">Sales Tax:</span>
                  <span>${result.salesTax?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-xl text-blue-700 border-t border-blue-200 pt-3 mt-2">
                  <span>TOTAL AMOUNT:</span>
                  <span>${result.totalAmount?.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Reconciliation Status Card */}
          <div className={`bg-white p-6 rounded-2xl shadow-md border-t-4 h-fit sticky top-6 transition-colors duration-300 ${matchStatus === 'Success' ? 'border-emerald-500' : 'border-amber-500'
            }`}>
            <h3 className="text-lg font-bold text-slate-700 mb-4">Match Status</h3>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600">3-Way Match:</span>

                {matchStatus === 'Pending' && (
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-black rounded-full uppercase tracking-wide animate-pulse">
                    Pending
                  </span>
                )}
                {matchStatus === 'Success' && (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-black rounded-full uppercase tracking-wide">
                    Verified
                  </span>
                )}
              </div>

              <div className="p-4 bg-slate-50 rounded-lg text-xs text-slate-500 leading-relaxed border border-slate-100">
                {matchStatus === 'Pending'
                  ? "Matches invoice amount against SAP PO and Goods Received Note (GRN) in the database."
                  : "Invoice total perfectly matches the Purchase Order and Goods Received Note."}
              </div>

              <button
                onClick={handleVerify}
                disabled={verifying || matchStatus === 'Success'}
                className={`w-full py-3 text-white rounded-xl font-bold transition shadow-sm ${matchStatus === 'Success'
                    ? 'bg-emerald-500 cursor-not-allowed'
                    : 'bg-slate-800 hover:bg-black'
                  }`}
              >
                {verifying ? "Checking Database..." : matchStatus === 'Success' ? "✓ Match Confirmed" : "Verify with Database"}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}