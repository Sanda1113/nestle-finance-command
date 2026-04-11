// frontend/src/components/Scanner.jsx
import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

function BarcodeScannerUI({ onScanSuccess, onClose }) {
    const scannerRef = useRef(null);
    const isMounted = useRef(true);
    const containerRef = useRef(null);

    useEffect(() => {
        isMounted.current = true;

        // Small delay to ensure the DOM element is rendered
        const timer = setTimeout(() => {
            if (!isMounted.current || !containerRef.current) return;

            try {
                const scanner = new Html5QrcodeScanner(
                    "reader",
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0,
                        showTorchButtonIfSupported: true,
                        rememberLastUsedCamera: true,
                        supportedScanTypes: [
                            Html5QrcodeScanner.SCAN_TYPE_CAMERA,
                            Html5QrcodeScanner.SCAN_TYPE_FILE
                        ]
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
                        // Ignore continuous "no code found" errors
                        // Only log real issues in development
                        if (process.env.NODE_ENV === 'development') {
                            if (!error?.includes?.('No MultiFormat Readers')) {
                                console.debug('Scanner debug:', error);
                            }
                        }
                    }
                );
            } catch (err) {
                console.error('Scanner initialization failed:', err);
                if (isMounted.current) {
                    alert('Could not access camera. Please check permissions or use file upload.');
                    onClose?.();
                }
            }
        }, 100);

        // Cleanup
        return () => {
            isMounted.current = false;
            clearTimeout(timer);
            if (scannerRef.current) {
                scannerRef.current.clear().catch((err) => {
                    console.warn('Scanner cleanup warning:', err);
                });
                scannerRef.current = null;
            }
        };
    }, [onScanSuccess, onClose]); // Stable dependencies expected

    return (
        <div ref={containerRef} className="bg-white dark:bg-slate-900 p-2 rounded-xl border-2 border-blue-500 overflow-hidden shadow-lg">
            <div id="reader" className="w-full text-slate-800 dark:text-slate-200" />

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