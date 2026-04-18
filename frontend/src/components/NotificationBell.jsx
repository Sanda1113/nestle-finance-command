import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Bell, BellRing } from 'lucide-react';

const POLL_INTERVAL_MS = 5000;
const MAX_BACKOFF_MS = 60000;
const REQUEST_TIMEOUT_MS = 10000;

export default function NotificationBell({ email, role, onNavigate }) {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const isMountedRef = useRef(true);
    const isFetchingRef = useRef(false);
    const pollTimerRef = useRef(null);
    const retryDelayRef = useRef(POLL_INTERVAL_MS);

    const clearPollTimer = useCallback(() => {
        if (pollTimerRef.current) {
            clearTimeout(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    }, []);

    const scheduleNextPoll = useCallback((delayMs = POLL_INTERVAL_MS) => {
        clearPollTimer();
        if (!isMountedRef.current) return;
        const targetDelay = document.hidden ? Math.max(delayMs, 15000) : delayMs;
        pollTimerRef.current = setTimeout(() => {
            fetchNotifications();
        }, targetDelay);
    }, [clearPollTimer]);

    const fetchNotifications = useCallback(async () => {
        if (!email && !role) return;
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        try {
            const params = {};
            if (email) params.email = email;
            if (role) params.role = role;
            const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/sprint2/notifications', {
                params: {
                    ...params,
                    _ts: Date.now()
                },
                timeout: REQUEST_TIMEOUT_MS,
                headers: {
                    'Cache-Control': 'no-cache',
                    Pragma: 'no-cache'
                }
            });
            const data = res.data.notifications || [];
            if (isMountedRef.current) {
                setNotifications(data);
                setUnreadCount(data.filter(n => !n.is_read).length);
            }
            retryDelayRef.current = POLL_INTERVAL_MS;
            scheduleNextPoll(POLL_INTERVAL_MS);
        } catch {
            retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_BACKOFF_MS);
            scheduleNextPoll(retryDelayRef.current);
        } finally {
            isFetchingRef.current = false;
        }
    }, [email, role, scheduleNextPoll]);

    useEffect(() => {
        isMountedRef.current = true;
        retryDelayRef.current = POLL_INTERVAL_MS;
        fetchNotifications();
        const handleVisible = () => {
            if (!document.hidden) {
                retryDelayRef.current = POLL_INTERVAL_MS;
                fetchNotifications();
            }
        };
        window.addEventListener('focus', handleVisible);
        document.addEventListener('visibilitychange', handleVisible);
        return () => {
            isMountedRef.current = false;
            clearPollTimer();
            window.removeEventListener('focus', handleVisible);
            document.removeEventListener('visibilitychange', handleVisible);
        };
    }, [clearPollTimer, fetchNotifications]);

    const markAsRead = async (ids) => {
        try {
            await axios.post('https://nestle-finance-command-production.up.railway.app/api/sprint2/notifications/mark-read', { ids });
            retryDelayRef.current = POLL_INTERVAL_MS;
            fetchNotifications();
        } catch { /* ignore mark-read errors */ }
    };

    const handleNotificationClick = (notification) => {
        if (!notification.is_read) {
            markAsRead([notification.id]);
        }
        setIsOpen(false);
        if (onNavigate && notification.link) {
            onNavigate(notification.link);
        }
    };

    const markAllAsRead = () => {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length) markAsRead(unreadIds);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
                {unreadCount > 0 ? (
                    <>
                        <BellRing className="w-5 h-5 text-amber-400 animate-pulse" />
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                            {unreadCount}
                        </span>
                    </>
                ) : (
                    <Bell className="w-5 h-5" />
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                        <div className="p-3 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="font-bold text-white text-sm">Notifications</h3>
                            {unreadCount > 0 && (
                                <button onClick={markAllAsRead} className="text-xs text-blue-400 hover:text-blue-300">
                                    Mark all read
                                </button>
                            )}
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <p className="p-4 text-center text-slate-400 text-sm">No notifications</p>
                            ) : (
                                notifications.map(n => (
                                    <div
                                        key={n.id}
                                        onClick={() => handleNotificationClick(n)}
                                        className={`p-3 border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors ${!n.is_read ? 'bg-blue-900/20' : ''}`}
                                    >
                                        <p className="font-medium text-white text-sm">{n.title}</p>
                                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{n.message}</p>
                                        <p className="text-[10px] text-slate-500 mt-2">
                                            {new Date(n.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
