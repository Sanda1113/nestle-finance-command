// frontend/src/components/Scanner.jsx
import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

function BarcodeScannerUI({ onScanSuccess, onClose }) {
    const scannerRef = useRef(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;

        // Wait for the DOM element to be available
        const timer = setTimeout(() => {
            if (!isMounted.current) return;

            try {
                // Create scanner instance
                const scanner = new Html5QrcodeScanner(
                    "reader",
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0,
                        showTorchButtonIfSupported: true,
                        rememberLastUsedCamera: true,
                    },
                    false // verbose
                );

                scannerRef.current = scanner;

                scanner.render(
                    (decodedText) => {
                        // Success – stop scanning and close
                        if (scannerRef.current) {
                            scannerRef.current.clear().catch(() => { });
                        }
                        if (isMounted.current) {
                            onScanSuccess(decodedText);
                        }
                    },
                    (error) => {
                        // Ignore continuous scanning errors
                    }
                );
            } catch (err) {
                console.error("Scanner initialization failed:", err);
                // Fallback: notify parent that scanner failed
                if (onClose) onClose();
            }
        }, 100);

        // Cleanup
        return () => {
            isMounted.current = false;
            clearTimeout(timer);
            if (scannerRef.current) {
                scannerRef.current.clear().catch((err) => {
                    console.warn("Scanner cleanup error:", err);
                });
                scannerRef.current = null;
            }
        };
    }, [onScanSuccess, onClose]);

    return (
        <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border-2 border-blue-500 overflow-hidden shadow-lg">
            <div id="reader" className="w-full text-slate-800 dark:text-slate-200"></div>

            <style>{`
                #reader {
                    border: none !important;
                    border-radius: 0.5rem;
                    overflow: hidden;
                }
                #reader__scan_region {
                    background: black;
                }
                #reader__dashboard_section_csr span {
                    color: inherit !important;
                }
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
                #reader button:hover {
                    background-color: #1d4ed8 !important;
                }
                #reader select {
                    background-color: #1e293b !important;
                    color: white !important;
                    padding: 8px !important;
                    border-radius: 8px !important;
                    border: 1px solid #334155 !important;
                    margin-bottom: 10px;
                }
                #reader__camera_selection {
                    margin-bottom: 8px;
                }
                #reader__dashboard_section_swaplink {
                    color: #60a5fa !important;
                    text-decoration: underline;
                    font-size: 0.875rem;
                }
            `}</style>
        </div>
    );
}

export default BarcodeScannerUI;