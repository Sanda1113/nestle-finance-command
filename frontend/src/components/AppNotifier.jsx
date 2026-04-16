// frontend/src/components/AppNotifier.jsx
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { BellRing, X } from 'lucide-react';
import { safePlayAudio } from '../utils/safeAudio';

export default function AppNotifier({ role }) {
    const [toasts, setToasts] = useState([]);
    const processedIds = useRef(new Set()); // Track IDs already shown
    const isInitialLoad = useRef(true); // Skip toasts on first fetch to prevent login spam

    const fetchNotifications = async () => {
        try {
            const res = await axios.get(`https://nestle-finance-command-production.up.railway.app/api/sprint2/notifications`, {
                params: { role }
            });
            const newNotifications = res.data.notifications || [];

            if (newNotifications.length > 0) {
                // Filter out notifications already processed
                const trulyNew = newNotifications.filter(n => !processedIds.current.has(n.id));

                // Always mark IDs as processed to avoid showing them later
                trulyNew.forEach(n => processedIds.current.add(n.id));

                if (trulyNew.length > 0) {
                    const idsToMark = trulyNew.map(n => n.id);
                    await axios.post('https://nestle-finance-command-production.up.railway.app/api/sprint2/notifications/mark-read', { ids: idsToMark });

                    // On initial load, silently consume existing notifications to prevent spam on login
                    if (!isInitialLoad.current) {
                        safePlayAudio('https://www.soundjay.com/buttons/sounds/button-09.mp3');
                        setToasts(prev => [...prev, ...trulyNew]);
                    }
                }
            }
        } catch {
            // Ignore background polling errors
        } finally {
            isInitialLoad.current = false;
        }
    };

    useEffect(() => {
        isInitialLoad.current = true; // Reset on role change
        processedIds.current = new Set();
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 5000);
        return () => clearInterval(interval);
    }, [role]);

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // Auto-remove toasts after 7 seconds
    useEffect(() => {
        if (toasts.length > 0) {
            const timer = setTimeout(() => {
                setToasts(prev => prev.slice(1));
            }, 7000);
            return () => clearTimeout(timer);
        }
    }, [toasts]);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-3 pointer-events-none">
            {toasts.map(toast => (
                <div key={toast.id} className="bg-white dark:bg-slate-900 border-l-4 border-blue-500 rounded-lg shadow-2xl p-4 w-80 flex items-start gap-3 animate-in slide-in-from-right-8 pointer-events-auto">
                    <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-2 rounded-full shrink-0">
                        <BellRing className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-black text-slate-800 dark:text-white">{toast.title || 'System Alert'}</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{toast.message}</p>
                    </div>
                    <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}