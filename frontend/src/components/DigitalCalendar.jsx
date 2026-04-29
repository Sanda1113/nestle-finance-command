import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import axios from 'axios';
import { Calendar as CalendarIcon, Edit2, CheckCircle2, Clock, X, Info } from 'lucide-react';

const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

const formatCurrency = (amount, currencyCode = 'USD') => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount); }
    catch { return `${currencyCode} ${Number(amount).toFixed(2)}`; }
};

export default function DigitalCalendar({ userRole, userEmail }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Dynamic Discounting State
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
    const [discountRate, setDiscountRate] = useState(2.5);

    const isFinance = userRole === 'Finance';

    const fetchEvents = useCallback(async () => {
        setLoading(true);
        try {
            const url = isFinance 
                ? 'https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts'
                : `https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts?email=${encodeURIComponent(userEmail)}`;
            const res = await axios.get(url);
            if (res.data.success) {
                const mappedEvents = res.data.data.map(p => ({
                    ...p,
                    start: new Date(p.start_date),
                    end: new Date(p.end_date || p.start_date),
                    title: p.title || `Payout`,
                }));
                setEvents(mappedEvents);
            }
        } catch (error) {
            console.error('Failed to fetch calendar events', error);
        } finally {
            setLoading(false);
        }
    }, [isFinance, userEmail]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    const onEventResize = useCallback(
        ({ event, start, end }) => {
            if (!isFinance) return;
            // Finance logic for resizing
            updateEventDate(event.id, start, end);
        },
        [isFinance]
    );

    const onEventDrop = useCallback(
        ({ event, start, end }) => {
            if (!isFinance) return;
            // Finance logic for drag drop
            updateEventDate(event.id, start, end);
        },
        [isFinance]
    );

    const updateEventDate = async (id, start, end) => {
        try {
            // Optimistic update
            setEvents(prev => prev.map(ev => ev.id === id ? { ...ev, start, end } : ev));
            
            await axios.patch(`https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts/${id}`, {
                start_date: start.toISOString(),
                end_date: end.toISOString(),
                updatedBy: userRole
            });
        } catch (error) {
            console.error('Failed to update event date', error);
            fetchEvents(); // rollback
        }
    };

    const handleSelectEvent = (event) => {
        setSelectedEvent(event);
        if (isFinance) {
            setIsModalOpen(true);
        } else {
            // Supplier specific logic (e.g., MVP 7 Dynamic Discounting)
            setIsDiscountModalOpen(true);
        }
    };

    // Calculate Dynamic Discount details
    const daysUntilPayout = useMemo(() => {
        if (!selectedEvent) return 0;
        const now = moment();
        const payoutDate = moment(selectedEvent.start);
        return Math.max(0, payoutDate.diff(now, 'days'));
    }, [selectedEvent]);

    const discountAmount = useMemo(() => {
        if (!selectedEvent) return 0;
        return (selectedEvent.amount * (discountRate / 100));
    }, [selectedEvent, discountRate]);

    const handleAcceptEarlyPayout = async () => {
        if (!selectedEvent) return;
        setIsUpdating(true);
        try {
            const newDate = new Date(); // Request payout today
            await axios.patch(`https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts/${selectedEvent.id}`, {
                start_date: newDate.toISOString(),
                end_date: newDate.toISOString(),
                updatedBy: userRole
            });
            await fetchEvents();
            setIsDiscountModalOpen(false);
            
            // Add a toast notification logic here or trigger global state refresh
            alert('Early payout requested successfully. Finance team notified.');
        } catch (error) {
            console.error('Failed to accept early payout', error);
            alert('Failed to request early payout');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 p-4">
            <style>
                {`
                    .rbc-calendar {
                        min-height: 600px;
                        font-family: inherit;
                    }
                    .rbc-event {
                        background-color: #3b82f6; /* blue-500 */
                        border-radius: 6px;
                        padding: 4px;
                        opacity: 0.9;
                        border: none;
                    }
                    .rbc-today {
                        background-color: #eff6ff; /* blue-50 */
                    }
                    .dark .rbc-today {
                        background-color: #1e3a8a; /* blue-900 */
                    }
                    .dark .rbc-month-view, .dark .rbc-time-view, .dark .rbc-header, .dark .rbc-day-bg, .dark .rbc-month-row {
                        border-color: #334155; /* slate-700 */
                    }
                    .dark .rbc-off-range-bg {
                        background-color: #0f172a; /* slate-900 */
                    }
                    .dark .rbc-btn-group button {
                        color: #cbd5e1; /* slate-300 */
                        border-color: #475569;
                    }
                    .dark .rbc-btn-group button:hover, .dark .rbc-btn-group button.rbc-active {
                        background-color: #334155;
                        color: white;
                    }
                `}
            </style>
            
            {loading && <div className="text-center text-slate-500 my-4 font-bold animate-pulse">Loading Calendar...</div>}
            
            {isFinance ? (
                <DnDCalendar
                    localizer={localizer}
                    events={events}
                    onEventDrop={onEventDrop}
                    onEventResize={onEventResize}
                    onSelectEvent={handleSelectEvent}
                    resizable
                    style={{ height: '70vh' }}
                    startAccessor="start"
                    endAccessor="end"
                    popup
                />
            ) : (
                <Calendar
                    localizer={localizer}
                    events={events}
                    onSelectEvent={handleSelectEvent}
                    style={{ height: '70vh' }}
                    startAccessor="start"
                    endAccessor="end"
                    popup
                />
            )}

            {/* Supplier Early Payout Modal (MVP 7) */}
            {isDiscountModalOpen && selectedEvent && !isFinance && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-500" /> Early Payout Offer
                            </h3>
                            <button onClick={() => setIsDiscountModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl flex items-start gap-3 border border-blue-200 dark:border-blue-800/50">
                                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                                <div className="text-sm font-medium">
                                    This payment of <strong>{formatCurrency(selectedEvent.amount)}</strong> is scheduled in <strong>{daysUntilPayout} days</strong>. You can choose to get paid today for a small fee.
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Adjust Early Payout Rate</label>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="range" 
                                        min="1" max="5" step="0.1" 
                                        value={discountRate}
                                        onChange={(e) => setDiscountRate(Number(e.target.value))}
                                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400 min-w-[3rem] text-right">{discountRate.toFixed(1)}%</span>
                                </div>
                            </div>
                            
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-medium">Original Invoice Value</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(selectedEvent.amount)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-rose-500 font-medium">Early Payment Fee ({discountRate}%)</span>
                                    <span className="font-bold text-rose-600 dark:text-rose-400">-{formatCurrency(discountAmount)}</span>
                                </div>
                                <div className="h-px bg-slate-200 dark:bg-slate-700 my-2"></div>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">You Receive Today</span>
                                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedEvent.amount - discountAmount)}</span>
                                </div>
                            </div>

                            <div className="mt-6 flex gap-3">
                                <button 
                                    onClick={() => setIsDiscountModalOpen(false)}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors"
                                >
                                    Keep Original Date
                                </button>
                                <button 
                                    onClick={handleAcceptEarlyPayout}
                                    disabled={isUpdating}
                                    className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2 shadow-md"
                                >
                                    {isUpdating ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    {isUpdating ? 'Processing...' : 'Accept Early Payout'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Finance View Edit Modal */}
            {isModalOpen && selectedEvent && isFinance && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-blue-500" /> Payout Details
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedEvent.title}</div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Supplier Email</label>
                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedEvent.supplier_email}</div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount</label>
                                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedEvent.amount)}</div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{moment(selectedEvent.start).format('MMMM Do YYYY')}</div>
                            </div>
                            <div className="text-xs text-slate-500 mt-4 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                💡 Tip: You can drag and drop this event directly on the calendar to reschedule it. The supplier will automatically receive an email and in-app notification.
                            </div>
                            <div className="mt-6">
                                <button 
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
