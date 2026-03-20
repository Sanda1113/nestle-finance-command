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

  // Helper component to render identical Document Cards cleanly
  const DocumentCard = ({ title, data, borderColor, themeColor, isApproved }) => {
    if (!data) {
      return (
        <div className={`bg-white rounded-2xl shadow-sm border-t-4 ${borderColor} overflow-hidden h-full flex flex-col`}>
           <div className="bg-slate-50 p-4 border-b border-slate-100">
            <h3 className="font-black text-slate-800 text-lg">{title}</h3>
          </div>
          <div className="p-6 text-sm text-slate-400 italic flex-grow">No data available.</div>
        </div>
      );
    }

    return (
      <div className={`bg-white rounded-2xl shadow-sm border-t-4 ${borderColor} overflow-hidden h-full flex flex-col`}>
        <div className="bg-slate-50 p-4 border-b border-slate-100">
          <h3 className="font-black text-slate-800 text-lg">{title}</h3>
        </div>
        
        <div className="p-6 flex-grow flex flex-col">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-y-4 gap-x-4 mb-6">
            <div>
              <p className="text-xs uppercase text-slate-400 font-bold mb-1">Vendor Name</p>
              <p className="font-semibold text-slate-800 truncate" title={data.vendorName}>{data.vendorName}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400 font-bold mb-1">Document #</p>
              <p className="font-semibold text-slate-800 truncate" title={data.invoiceNumber}>{data.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400 font-bold mb-1">Date</p>
              <p className="font-semibold text-slate-800">{data.invoiceDate}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400 font-bold mb-1">PO Reference</p>
              <p className={`font-semibold truncate ${data.poNumber !== 'Not Found' ? themeColor : 'text-amber-600 italic'}`}>
                {data.poNumber}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs uppercase text-slate-400 font-bold mb-1">Vendor Address</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap leading-tight">{data.vendorAddress}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs uppercase text-slate-400 font-bold mb-1">Bill To</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap leading-tight">{data.billTo}</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mb-6 flex-grow">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Line Items</h4>
            {data.lineItems && data.lineItems.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-2 font-bold w-12">Qty</th>
                      <th className="p-2 font-bold">Description</th>
                      <th className="p-2 font-bold text-right">Price</th>
                      <th className="p-2 font-bold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lineItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="p-2 text-slate-700">{item.qty}</td>
                        <td className="p-2 font-medium text-slate-800 max-w-[120px] truncate" title={item.description}>{item.description || '-'}</td>
                        <td className="p-2 text-right text-slate-600">{item.unitPrice}</td>
                        <td className="p-2 text-right font-bold text-slate-800">{item.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-100">No line items detected.</p>
            )}
          </div>

          {/* Bank & Terms */}
          <div className="space-y-3 mb-6 bg-slate-50 p-3 rounded-lg border border-slate-100">
            <div>
              <p className="text-xs uppercase text-slate-400 font-bold">Bank Details</p>
              <p className="text-xs font-medium text-slate-700 truncate" title={data.bankDetails}>{data.bankDetails}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400 font-bold">Terms & Conditions</p>
              <p className="text-xs font-medium text-slate-700">{data.terms}</p>
            </div>
          </div>

          {/* Financial Summary (Bottom pinned) */}
          <div className="mt-auto border-t border-slate-100 pt-4 space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span className="font-bold">Subtotal:</span>
              <span>${data.subtotal?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span className="font-bold">Sales Tax:</span>
              <span>${data.salesTax?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-black text-xl border-t border-slate-200 pt-2 mt-2">
              <span className="text-slate-800">TOTAL:</span>
              <span className={isApproved ? 'text-emerald-600' : themeColor}>
                ${data.totalAmount?.toFixed(2)}
              </span>
            </div>
          </div>
          
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto p-6">
      
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-800">Reconciliation Command Center</h1>
        <p className="text-slate-500 mt-1">Upload vendor documents for automated 3-way matching and discrepancy detection.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ================= LEFT COLUMN: CONTROL PANEL ================= */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          
          {/* Invoice Upload */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">1</span> 
              Upload Invoice
            </h3>
            <input 
              type="file" 
              onChange={(e) => handleFileChange(e, 'invoice')}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>

          {/* PO Upload */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">2</span> 
              Upload Purchase Order
            </h3>
            <input 
              type="file" 
              onChange={(e) => handleFileChange(e, 'po')}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
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
            {loading ? "Extracting Data..." : "Extract & Compare Data"}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}
        </div>

        {/* ================= RIGHT COLUMN: DASHBOARD ================= */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          
          {/* Status Widget */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Reconciliation Status</h2>
              <p className="text-slate-600 text-sm">System comparison of Invoice vs. Purchase Order</p>
            </div>
            <div>
              {matchStatus === 'Pending' && <span className="px-4 py-2 bg-slate-100 text-slate-600 font-black rounded-lg uppercase tracking-wide inline-block">Pending</span>}
              {matchStatus === 'Approved' && <span className="px-4 py-2 bg-emerald-100 text-emerald-700 font-black rounded-lg uppercase tracking-wide inline-block shadow-sm">✅ Approved Match</span>}
              {matchStatus === 'Rejected' && <span className="px-4 py-2 bg-red-100 text-red-700 font-black rounded-lg uppercase tracking-wide inline-block shadow-sm">❌ Discrepancy</span>}
              {matchStatus === 'Error' && <span className="px-4 py-2 bg-amber-100 text-amber-700 font-black rounded-lg uppercase tracking-wide inline-block">⚠️ System Error</span>}
            </div>
          </div>

          {/* Comparison View */}
          {(invoiceResult || poResult) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              <DocumentCard 
                title="Invoice Data" 
                data={invoiceResult} 
                borderColor="border-blue-500" 
                themeColor="text-blue-600"
                isApproved={matchStatus === 'Approved'}
              />
              <DocumentCard 
                title="Purchase Order Data" 
                data={poResult} 
                borderColor="border-purple-500" 
                themeColor="text-purple-600"
                isApproved={matchStatus === 'Approved'}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}