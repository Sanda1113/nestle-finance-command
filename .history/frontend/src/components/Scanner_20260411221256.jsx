import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function BarcodeScannerUI({ onScanSuccess, onClose }) {
    const scannerRef = useRef(null);

    useEffect(() => {
        if (!scannerRef.current) {
            scannerRef.current = new Html5QrcodeScanner(
                "reader",
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    showTorchButtonIfSupported: true
                },
                false
            );

            scannerRef.current.render(
                (decodedText) => {
                    if (scannerRef.current) {
                        scannerRef.current.clear();
                    }
                    onScanSuccess(decodedText);
                },
                (errorMessage) => {
                    // Ignore background scan errors
                }
            );
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
                scannerRef.current = null;
            }
        };
    }, [onScanSuccess]);

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
            <button onClick={onClose} className="absolute top-6 right-6 bg-slate-800 text-white p-3 rounded-full hover:bg-red-500 transition-colors shadow-lg z-50">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            <div className="flex flex-col items-center mb-4">
                <svg className="w-10 h-10 text-blue-500 mb-2 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v-4m-2 0h-2m12 0h-2m-6 0h-2m0 4h-2m0 4h-2m0 4h-2m12-4h2m-6-4h-2m0 4h-2m0-4h-2m0 4h-2" />
                </svg>
                <h2 className="text-white font-black text-xl tracking-tight text-center">Scan Barcode</h2>
                <p className="text-slate-400 text-sm mt-1">Position the barcode within the frame</p>
            </div>
            <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(59,130,246,0.2)] p-2">
                <div id="reader" className="w-full rounded-xl overflow-hidden"></div>
            </div>
            <style>{`
                #reader { border: none !important; }
                #reader button { background-color: #2563eb !important; color: white !important; border: none !important; padding: 10px 20px !important; border-radius: 8px !important; font-weight: bold !important; margin: 5px !important; cursor: pointer; }
                #reader__dashboard_section_swaplink { display: none !important; }
                #reader__scan_region { background: black; }
                #reader select { background-color: #1e293b !important; color: white !important; padding: 8px !important; border-radius: 8px !important; border: 1px solid #334155 !important; margin-bottom: 10px; }
            `}</style>
        </div>
    );
}