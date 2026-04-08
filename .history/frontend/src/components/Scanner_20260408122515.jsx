import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

function BarcodeScannerUI({ onScanSuccess }) {
    const scannerRef = useRef(null);

    useEffect(() => {
        // Prevent double initialization in React Strict Mode
        if (!scannerRef.current) {
            // Initialize the production-ready scanner UI
            scannerRef.current = new Html5QrcodeScanner(
                "reader",
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    showTorchButtonIfSupported: true // Adds a flashlight button for warehouses!
                },
                false // verbose mode off
            );

            scannerRef.current.render(
                (decodedText) => {
                    // Stop scanning immediately after a successful read
                    if (scannerRef.current) {
                        scannerRef.current.clear();
                    }
                    onScanSuccess(decodedText);
                },
                (errorMessage) => {
                    // Ignore background scan errors (it fires constantly until it finds a code)
                }
            );
        }

        // CRITICAL: Cleanup function to release the camera when the user closes the scanner
        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(error => {
                    console.error("Failed to clear scanner. ", error);
                });
                scannerRef.current = null;
            }
        };
    }, [onScanSuccess]);

    return (
        <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border-2 border-blue-500 overflow-hidden shadow-lg">
            <div id="reader" className="w-full text-slate-800 dark:text-slate-200"></div>

            {/* CSS to make the built-in UI look good with your Tailwind theme */}
            <style>{`
                #reader { border: none !important; border-radius: 0.5rem; overflow: hidden; }
                #reader__scan_region { background: black; }
                #reader__dashboard_section_csr span { color: inherit !important; }
                #reader button { 
                    background-color: #2563eb !important; 
                    color: white !important; 
                    border: none !important; 
                    padding: 8px 16px !important; 
                    border-radius: 8px !important; 
                    font-weight: bold !important; 
                    margin: 5px !important;
                    cursor: pointer;
                }
                #reader select {
                    background-color: #1e293b !important;
                    color: white !important;
                    padding: 8px !important;
                    border-radius: 8px !important;
                    border: 1px solid #334155 !important;
                    margin-bottom: 10px;
                }
            `}</style>
        </div>
    );
}