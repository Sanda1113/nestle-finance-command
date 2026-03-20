import { useState } from 'react';

export default function Upload() {
  // File states
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [poFile, setPoFile] = useState(null);
  
  // UI States: 'idle', 'pending', 'approved', 'rejected', 'error'
  const [matchStatus, setMatchStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleInvoiceChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setInvoiceFile(e.target.files[0]);
      resetStates();
    }
  };

  const handlePoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setPoFile(e.target.files[0]);
      resetStates();
    }
  };

  const resetStates = () => {
    setMatchStatus('idle');
    setErrorMessage('');
  };

  const handleExtractAndMatch = async () => {
    if (!invoiceFile || !poFile) {
      setMatchStatus('error');
      setErrorMessage("Please upload both an Invoice and a Purchase Order before processing.");
      return;
    }

    setMatchStatus('pending');
    setErrorMessage('');

    // SIMULATED BACKEND CALL (Since this is frontend/UI only)
    // Replace this setTimeout with your actual Axios call to your Railway backend
    setTimeout(() => {
      // For demonstration, randomly approving or rejecting
      const randomOutcome = Math.random() > 0.5 ? 'approved' : 'rejected';
      setMatchStatus(randomOutcome);
      
      // Example of how to trigger an error state:
      // setMatchStatus('error');
      // setErrorMessage('Failed to connect to the extraction engine.');
    }, 2500);
  };

  // Helper to render the dynamic widget on the right
  const renderStatusWidget = () => {
    const config = {
      idle: {
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        text: 'text-slate-500',
        icon: '📄',
        title: 'Awaiting Documents',
        desc: 'Upload both files on the left to begin the reconciliation process.'
      },
      pending: {
        bg: 'bg-blue-50',
        border: 'border-blue-400',
        text: 'text-blue-700',
        icon: '⏳',
        title: 'Processing...',
        desc: 'Extracting data and performing 3-way match. Please wait.'
      },
      approved: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-500',
        text: 'text-emerald-700',
        icon: '✅',
        title: 'Match Approved',
        desc: 'The Invoice and Purchase Order match perfectly. Ready for payment.'
      },
      rejected: {
        bg: 'bg-amber-50',
        border: 'border-amber-500',
        text: 'text-amber-700',
        icon: '⚠️',
        title: 'Match Rejected',
        desc: 'Discrepancies found between the Invoice and Purchase Order amounts or items.'
      },
      error: {
        bg: 'bg-red-50',
        border: 'border-red-500',
        text: 'text-red-700',
        icon: '❌',
        title: 'System Error',
        desc: errorMessage || 'An unexpected error occurred during processing.'
      }
    };

    const current = config[matchStatus];

    return (
      <div className={`h-full flex flex-col items-center justify-center p-8 rounded-2xl border-2 transition-all duration-300 ${current.bg} ${current.border}`}>
        <div className={`text-6xl mb-4 ${matchStatus === 'pending' ? 'animate-bounce' : ''}`}>
          {current.icon}
        </div>
        <h3 className={`text-2xl font-bold mb-2 ${current.text}`}>
          {current.title}
        </h3>
        <p className={`text-center font-medium ${current.text} opacity-80 max-w-xs`}>
          {current.desc}
        </p>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Supplier Portal</h1>
        <p className="text-slate-500">Upload your Invoice and corresponding Purchase Order for automated matching.</p>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Side: Upload Controls */}
        <div className="space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          
          {/* Invoice Upload */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              1. Upload Invoice
            </label>
            <div className={`p-4 rounded-xl border-2 border-dashed transition-colors ${invoiceFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}>
              <input
                type="file"
                onChange={handleInvoiceChange}
                accept=".pdf,.png,.jpg,.jpeg"
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
              />
              {invoiceFile && (
                <p className="mt-2 text-xs font-semibold text-emerald-600">
                  Attached: {invoiceFile.name}
                </p>
              )}
            </div>
          </div>

          {/* PO Upload */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              2. Upload Purchase Order (PO)
            </label>
            <div className={`p-4 rounded-xl border-2 border-dashed transition-colors ${poFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}>
              <input
                type="file"
                onChange={handlePoChange}
                accept=".pdf,.png,.jpg,.jpeg"
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-slate-800 file:text-white hover:file:bg-slate-900 cursor-pointer"
              />
              {poFile && (
                <p className="mt-2 text-xs font-semibold text-emerald-600">
                  Attached: {poFile.name}
                </p>
              )}
            </div>
          </div>

          {/* Extract Button */}
          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={handleExtractAndMatch}
              disabled={matchStatus === 'pending'}
              className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-md text-lg
                ${matchStatus === 'pending' 
                  ? 'bg-blue-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
                }`}
            >
              {matchStatus === 'pending' ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Extracting & Matching...
                </span>
              ) : "Extract Data & Verify"}
            </button>
          </div>

        </div>

        {/* Right Side: Status Widget */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px]">
          {renderStatusWidget()}
        </div>

      </div>
    </div>
  );
}