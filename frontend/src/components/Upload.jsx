import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Upload() {
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);

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

  // Handle Dark Mode Toggle
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Automatically check for a match when both results arrive
  useEffect(() => {
    if (invoiceResult && poResult) {
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
    poFormData.append('invoiceFile', poFile);

    try {
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

  // Helper component for identical Document Cards
  const DocumentCard = ({ title, data, borderColor, themeColor, isApproved }) => {
    if (!data) return null;

    return (
      <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border-t-4 ${borderColor} overflow-hidden h-full flex flex-col transition-colors`}>
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-100 dark:border-slate-800 transition-colors">
          <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">{title}</h3>
        </div>

        <div className="p-6 flex-grow flex flex-col">
          <div className="grid grid-cols-2 gap-y-4 gap-x-4 mb-6">
            <div>
              <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Vendor Name</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={data.vendorName}>{data.vendorName}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Document #</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={data.invoiceNumber}>{data.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Date</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{data.invoiceDate}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">PO Reference</p>
              <p className={`font-semibold truncate ${data.poNumber !== 'Not Found' ? themeColor : 'text-amber-600 dark:text-amber-500 italic'}`}>
                {data.poNumber}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Vendor Address</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-tight">{data.vendorAddress}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Bill To</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-tight">{data.billTo}</p>
            </div>
          </div>

          <div className="mb-6 flex-grow">
            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Line Items</h4>
            {data.lineItems && data.lineItems.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 transition-colors">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 transition-colors">
                    <tr>
                      <th className="p-2 font-bold w-12">Qty</th>
                      <th className="p-2 font-bold">Description</th>
                      <th className="p-2 font-bold text-right">Price</th>
                      <th className="p-2 font-bold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lineItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-2 text-slate-700 dark:text-slate-400">{item.qty}</td>
                        <td className="p-2 font-medium text-slate-800 dark:text-slate-300 max-w-[120px] truncate" title={item.description}>{item.description || '-'}</td>
                        <td className="p-2 text-right text-slate-600 dark:text-slate-400">{item.unitPrice}</td>
                        <td className="p-2 text-right font-bold text-slate-800 dark:text-slate-200">{item.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 transition-colors">No line items detected.</p>
            )}
          </div>

          <div className="space-y-3 mb-6 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 transition-colors">
            <div>
              <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold">Bank Details</p>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate" title={data.bankDetails}>{data.bankDetails}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold">Terms & Conditions</p>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{data.terms}</p>
            </div>
          </div>

          <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2 transition-colors">
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
              <span className="font-bold">Subtotal:</span>
              <span>${data.subtotal?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
              <span className="font-bold">Sales Tax:</span>
              <span>${data.salesTax?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-black text-xl border-t border-slate-200 dark:border-slate-700 pt-2 mt-2 transition-colors">
              <span className="text-slate-800 dark:text-slate-100">TOTAL:</span>
              <span className={isApproved ? 'text-emerald-600 dark:text-emerald-400' : themeColor}>
                ${data.totalAmount?.toFixed(2)}
              </span>
            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 pb-12">
      <div className="max-w-[1400px] mx-auto p-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 pt-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 transition-colors">Reconciliation Command Center</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 transition-colors">Upload vendor documents for automated 3-way matching and discrepancy detection.</p>
          </div>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full font-bold text-slate-600 dark:text-slate-300 shadow-sm hover:shadow transition-all"
          >
            {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>

        {/* Top Grid: Controls & Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">

          {/* Left Column: Control Panel */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-6">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
              <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 px-2 py-1 rounded text-xs">1</span>
                Upload Invoice
              </h3>
              <input
                type="file"
                onChange={(e) => handleFileChange(e, 'invoice')}
                className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-400 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50 cursor-pointer transition-colors"
              />
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
              <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 px-2 py-1 rounded text-xs">2</span>
                Upload Purchase Order
              </h3>
              <input
                type="file"
                onChange={(e) => handleFileChange(e, 'po')}
                className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-purple-50 dark:file:bg-purple-900/30 file:text-purple-700 dark:file:text-purple-400 hover:file:bg-purple-100 dark:hover:file:bg-purple-900/50 cursor-pointer transition-colors"
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={loading || !invoiceFile || !poFile}
              className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-md ${loading || !invoiceFile || !poFile ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none text-slate-500 dark:text-slate-500' : 'bg-slate-800 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-500'
                }`}
            >
              {loading ? "Extracting Data..." : "Extract & Compare Data"}
            </button>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm font-medium transition-colors">
                {error}
              </div>
            )}
          </div>

          {/* Right Column: Dashboard */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
              <div>
                <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Reconciliation Status</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm">System comparison of Invoice vs. Purchase Order</p>
              </div>
              <div className="flex items-center gap-3">
                {matchStatus === 'Pending' && <span className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black rounded-lg uppercase tracking-wide inline-block transition-colors">Pending</span>}
                {matchStatus === 'Approved' && <span className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-black rounded-lg uppercase tracking-wide inline-block shadow-sm transition-colors">✅ Approved Match</span>}
                {matchStatus === 'Rejected' && <span className="px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-black rounded-lg uppercase tracking-wide inline-block shadow-sm transition-colors">❌ Discrepancy</span>}
                {matchStatus === 'Error' && <span className="px-4 py-2 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-black rounded-lg uppercase tracking-wide inline-block transition-colors">⚠️ System Error</span>}
              </div>
            </div>

            {(invoiceResult || poResult) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                <DocumentCard
                  title="Invoice Data"
                  data={invoiceResult}
                  borderColor="border-blue-500"
                  themeColor="text-blue-600 dark:text-blue-400"
                  isApproved={matchStatus === 'Approved'}
                />
                <DocumentCard
                  title="Purchase Order Data"
                  data={poResult}
                  borderColor="border-purple-500"
                  themeColor="text-purple-600 dark:text-purple-400"
                  isApproved={matchStatus === 'Approved'}
                />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}