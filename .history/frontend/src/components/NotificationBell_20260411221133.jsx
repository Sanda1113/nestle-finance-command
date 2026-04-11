// frontend/src/components/NotificationBell.jsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Bell, BellRing } from 'lucide-react';

export default function NotificationBell({ email, role, onNavigate }) {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    const fetchNotifications = async () => {
        try {
            const params = email ? { email } : { role };
            const res = await axios.get('https://nestle-finance-command-production.up.railway.app/api/notifications', { params });
            const data = res.data.notifications || [];
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.is_read).length);
        } catch (err) { }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 10000);
        return () => clearInterval(interval);
    }, [email, role]);

    const markAsRead = async (ids) => {
        try {
            await axios.post('https://nestle-finance-command-production.up.railway.app/api/notifications/mark-read', { ids });
            fetchNotifications();
        } catch (err) { }
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