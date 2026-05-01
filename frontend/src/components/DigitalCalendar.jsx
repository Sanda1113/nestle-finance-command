import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import axios from 'axios';
import { Calendar as CalendarIcon, Clock, X, CheckCircle2, AlertCircle, DollarSign, Bell } from 'lucide-react';

const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

const formatCurrency = (amount, currencyCode = 'USD') => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount); }
    catch { return `${currencyCode} ${Number(amount).toFixed(2)}`; }
};

const STATUS_CONFIG = {
    'Paid':          { bg: '#10b981', light: 'bg-emerald-900/40 text-emerald-400 border-emerald-700/50', label: '✅ Paid', icon: '💰' },
    'Hold':          { bg: '#f59e0b', light: 'bg-amber-900/40 text-amber-400 border-amber-700/50',   label: '⏸️ On Hold', icon: '⏸️' },
    'Renegotiated':  { bg: '#8b5cf6', light: 'bg-purple-900/40 text-purple-400 border-purple-700/50', label: '⚡ Early Payout', icon: '⚡' },
    'Scheduled':     { bg: '#3b82f6', light: 'bg-blue-900/40 text-blue-400 border-blue-700/50',       label: '📅 Scheduled', icon: '📅' },
    'Pending Finance': { bg: '#64748b', light: 'bg-slate-700/40 text-slate-300 border-slate-600/50', label: '⏳ Pending', icon: '⏳' },
};
const getStatusCfg = (status) => STATUS_CONFIG[status] || STATUS_CONFIG['Scheduled'];

export default function DigitalCalendar({ userRole, userEmail }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [holdDate, setHoldDate] = useState('');
    const [discountRate, setDiscountRate] = useState(2.5);
    const [view, setView] = useState('month');
    const [currentDate, setCurrentDate] = useState(new Date());

    const isFinance = userRole === 'Finance';

    // ── Upcoming reminders (next 7 days) ──────────────────────────
    const upcomingReminders = useMemo(() => {
        const now = moment();
        return events
            .filter(e => {
                const days = moment(e.start).diff(now, 'days');
                return days >= 0 && days <= 7 && e.status !== 'Paid';
            })
            .sort((a, b) => moment(a.start).valueOf() - moment(b.start).valueOf());
    }, [events]);

    // ── Event style (Google Calendar-like chips) ──────────────────
    const eventStyleGetter = (event) => {
        const cfg = getStatusCfg(event.status);
        return {
            style: {
                backgroundColor: cfg.bg,
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                fontSize: '12px',
                fontWeight: '600',
                padding: '2px 6px',
                opacity: 0.95,
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }
        };
    };

    const fetchEvents = useCallback(async () => {
        setLoading(true);
        try {
            const url = isFinance
                ? 'https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts'
                : `https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts?email=${encodeURIComponent(userEmail)}`;
            const res = await axios.get(url);
            if (res.data.success) {
                const mapped = (res.data.data || []).map(p => ({
                    ...p,
                    start: new Date(p.start_date),
                    end:   new Date(p.end_date || p.start_date),
                    title: `${getStatusCfg(p.status).icon} ${p.title || 'Payout'}`,
                    status: p.status,
                    amount: p.final_amount || p.base_amount || 0,
                }));
                setEvents(mapped);
            }
        } catch (err) {
            console.error('Failed to fetch calendar events', err);
        } finally {
            setLoading(false);
        }
    }, [isFinance, userEmail]);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    const updateEventDate = async (id, start, end) => {
        setEvents(prev => prev.map(ev => ev.id === id ? { ...ev, start, end } : ev));
        try {
            await axios.patch(`https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts/${id}`, {
                start_date: start.toISOString(),
                end_date: end.toISOString(),
                updatedBy: userRole
            });
        } catch (err) {
            console.error('Failed to update event date', err);
            fetchEvents();
        }
    };

    const onEventDrop = useCallback(({ event, start, end }) => {
        if (!isFinance) return;
        updateEventDate(event.id, start, end);
    }, [isFinance]);

    const onEventResize = useCallback(({ event, start, end }) => {
        if (!isFinance) return;
        updateEventDate(event.id, start, end);
    }, [isFinance]);

    const handleSelectEvent = (event) => setSelectedEvent(event);

    const daysUntilPayout = useMemo(() => {
        if (!selectedEvent) return 0;
        return Math.max(0, moment(selectedEvent.start).diff(moment(), 'days'));
    }, [selectedEvent]);

    const discountAmount = useMemo(() => {
        if (!selectedEvent) return 0;
        return (selectedEvent.amount || 0) * (discountRate / 100);
    }, [selectedEvent, discountRate]);

    const handleApproveTransfer = async () => {
        if (!selectedEvent) return;
        setIsUpdating(true);
        try {
            const res = await axios.post(`https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts/${selectedEvent.id}/disburse`, {
                supplier_email: selectedEvent.supplier_email,
                final_amount: selectedEvent.amount,
                mock_supplier_account: 'SUPP-ACC-12345'
            });
            alert('✅ Transfer approved! TXN ID: ' + res.data.transactionId);
            fetchEvents();
            setSelectedEvent(null);
        } catch (err) {
            alert('❌ Failed to process transfer');
        } finally { setIsUpdating(false); }
    };

    const handleHoldPayment = async () => {
        if (!selectedEvent || !holdDate) { alert('Please select a hold date'); return; }
        setIsUpdating(true);
        try {
            await axios.patch(`https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts/${selectedEvent.id}/hold`, {
                hold_until_date: new Date(holdDate).toISOString()
            });
            fetchEvents();
            setSelectedEvent(null);
        } catch { alert('Failed to hold payment'); }
        finally { setIsUpdating(false); setHoldDate(''); }
    };

    const handleAcceptEarlyPayout = async () => {
        if (!selectedEvent) return;
        setIsUpdating(true);
        try {
            await axios.patch(`https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts/${selectedEvent.id}/discount`, {
                early_date: new Date().toISOString(),
                new_amount: selectedEvent.amount - discountAmount
            });
            await fetchEvents();
            setSelectedEvent(null);
            alert('⚡ Early payout requested! Finance has been notified.');
        } catch { alert('Failed to request early payout'); }
        finally { setIsUpdating(false); }
    };

    const CalComponent = isFinance ? DnDCalendar : Calendar;

    return (
        <div className="space-y-4">

            {/* ── Reminder Strip ─────────────────────────────────── */}
            {upcomingReminders.length > 0 && (
                <div className="bg-slate-900 border border-amber-700/40 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Bell className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-bold text-amber-300">Upcoming Payments – Next 7 Days</span>
                    </div>
                    <div className="space-y-2">
                        {upcomingReminders.map(ev => {
                            const days = moment(ev.start).diff(moment(), 'days');
                            const cfg = getStatusCfg(ev.status);
                            return (
                                <div key={ev.id} onClick={() => setSelectedEvent(ev)}
                                    className="flex items-center justify-between bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-800 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">{cfg.icon}</span>
                                        <div>
                                            <p className="text-xs font-bold text-slate-200">{ev.title?.replace(/^[^\s]+\s/, '')}</p>
                                            <p className="text-[10px] text-slate-400">{moment(ev.start).format('ddd, MMM D YYYY')} · {ev.supplier_email || ''}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-emerald-400">{formatCurrency(ev.amount)}</p>
                                        <p className={`text-[10px] font-bold ${days === 0 ? 'text-red-400' : days <= 2 ? 'text-amber-400' : 'text-slate-400'}`}>
                                            {days === 0 ? '🔴 Due Today' : `${days}d remaining`}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Calendar + Detail Panel ────────────────────────── */}
            <div className={`flex gap-4 ${selectedEvent ? 'items-start' : ''}`}>

                {/* Calendar */}
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <style>{`
                        .rbc-calendar { min-height: 580px; font-family: inherit; background: transparent; }
                        .rbc-toolbar { padding: 12px 16px; border-bottom: 1px solid #334155; }
                        .rbc-toolbar button { color: #94a3b8; border-color: #475569; background: transparent; border-radius: 8px; padding: 4px 10px; font-size: 12px; font-weight: 600; }
                        .rbc-toolbar button:hover, .rbc-toolbar button.rbc-active { background: #334155 !important; color: white !important; border-color: #475569 !important; }
                        .rbc-toolbar-label { color: white; font-weight: 800; font-size: 15px; }
                        .rbc-header { padding: 8px; background: #1e293b; border-color: #334155 !important; color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
                        .rbc-month-view, .rbc-time-view, .rbc-day-bg, .rbc-month-row { border-color: #334155 !important; }
                        .rbc-today { background-color: #1e3a8a !important; }
                        .rbc-off-range-bg { background-color: #0f172a !important; }
                        .rbc-event { border-radius: 6px !important; border: none !important; }
                        .rbc-event:focus { outline: 2px solid #6366f1; }
                        .rbc-show-more { color: #818cf8; font-size: 11px; font-weight: 700; }
                        .rbc-date-cell { color: #cbd5e1; font-size: 12px; padding: 4px 6px; }
                        .rbc-date-cell.rbc-now { color: #60a5fa; font-weight: 800; }
                    `}</style>

                    {loading && (
                        <div className="text-center text-slate-400 py-6 text-sm animate-pulse">Loading Calendar…</div>
                    )}

                    {!loading && events.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <CalendarIcon className="w-12 h-12 mb-3 opacity-30" />
                            <p className="font-bold text-sm">No scheduled payments yet</p>
                            <p className="text-xs mt-1">Payouts appear here after Finance stages them</p>
                        </div>
                    )}

                    {!loading && events.length > 0 && (
                        <CalComponent
                            localizer={localizer}
                            events={events}
                            view={view}
                            onView={setView}
                            date={currentDate}
                            onNavigate={setCurrentDate}
                            onEventDrop={isFinance ? onEventDrop : undefined}
                            onEventResize={isFinance ? onEventResize : undefined}
                            resizable={isFinance}
                            onSelectEvent={handleSelectEvent}
                            eventPropGetter={eventStyleGetter}
                            startAccessor="start"
                            endAccessor="end"
                            popup
                            style={{ height: '70vh' }}
                            tooltipAccessor={(e) => `${e.title?.replace(/^[^\s]+\s/, '')} — ${formatCurrency(e.amount)} — ${e.status}`}
                        />
                    )}
                </div>

                {/* Event Detail Panel */}
                {selectedEvent && (
                    <div className="w-80 shrink-0 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-right-4 duration-200">
                        {/* Header */}
                        <div className={`p-4 border-b border-slate-800 flex justify-between items-start`}
                            style={{ background: getStatusCfg(selectedEvent.status).bg + '22' }}>
                            <div>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusCfg(selectedEvent.status).light} mb-2`}>
                                    {getStatusCfg(selectedEvent.status).label}
                                </span>
                                <h3 className="font-black text-white text-sm leading-tight">{selectedEvent.title?.replace(/^[^\s]+\s/, '')}</h3>
                            </div>
                            <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-white transition-colors ml-2 shrink-0">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Details */}
                        <div className="p-4 space-y-3 text-xs">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500 font-medium flex items-center gap-1"><DollarSign className="w-3 h-3" /> Amount</span>
                                <span className="text-xl font-black text-emerald-400">{formatCurrency(selectedEvent.amount)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500 font-medium flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> Payout Date</span>
                                <span className="text-slate-200 font-bold">{moment(selectedEvent.start).format('MMM D, YYYY')}</span>
                            </div>
                            {selectedEvent.supplier_email && (
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Supplier</span>
                                    <span className="text-slate-300 font-semibold truncate max-w-[160px]">{selectedEvent.supplier_email}</span>
                                </div>
                            )}
                            {/* Countdown reminder */}
                            {selectedEvent.status !== 'Paid' && (
                                <div className={`flex items-center gap-2 rounded-xl p-3 border ${
                                    daysUntilPayout === 0 ? 'bg-red-900/30 border-red-700/50 text-red-300' :
                                    daysUntilPayout <= 3 ? 'bg-amber-900/30 border-amber-700/50 text-amber-300' :
                                    'bg-blue-900/20 border-blue-700/30 text-blue-300'
                                }`}>
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span className="font-bold">
                                        {daysUntilPayout === 0 ? '🔴 Due Today' : `⏰ ${daysUntilPayout} day${daysUntilPayout !== 1 ? 's' : ''} until payout`}
                                    </span>
                                </div>
                            )}
                            {selectedEvent.hold_until_date && (
                                <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-3 text-amber-300 text-xs font-semibold">
                                    ⏸️ Held until: {moment(selectedEvent.hold_until_date).format('MMM D, YYYY')}
                                </div>
                            )}
                            {selectedEvent.bank_transaction_ref && (
                                <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-3 text-emerald-300 text-xs">
                                    <span className="font-bold block mb-0.5">Transaction Reference</span>
                                    <span className="font-mono">{selectedEvent.bank_transaction_ref}</span>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="p-4 border-t border-slate-800 space-y-2">
                            {/* Finance actions */}
                            {isFinance && selectedEvent.status !== 'Paid' && (
                                <>
                                    <button onClick={handleApproveTransfer} disabled={isUpdating}
                                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50">
                                        <CheckCircle2 className="w-4 h-4" />
                                        {isUpdating ? 'Processing…' : 'Approve Transfer'}
                                    </button>
                                    <div className="flex gap-2">
                                        <input type="date" value={holdDate} onChange={(e) => setHoldDate(e.target.value)}
                                            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-amber-500" />
                                        <button onClick={handleHoldPayment} disabled={isUpdating || !holdDate}
                                            className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50">
                                            Hold
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-500 text-center">💡 Drag event on calendar to reschedule</p>
                                </>
                            )}

                            {/* Supplier actions */}
                            {!isFinance && selectedEvent.status !== 'Paid' && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Early Payout Rate: {discountRate.toFixed(1)}%</label>
                                        <input type="range" min="1" max="5" step="0.1" value={discountRate}
                                            onChange={(e) => setDiscountRate(Number(e.target.value))}
                                            className="w-full h-1.5 accent-indigo-500 cursor-pointer" />
                                        <div className="bg-slate-800 rounded-xl p-3 text-xs space-y-1 border border-slate-700">
                                            <div className="flex justify-between"><span className="text-slate-400">Original</span><span className="font-bold text-slate-200">{formatCurrency(selectedEvent.amount)}</span></div>
                                            <div className="flex justify-between"><span className="text-rose-400">Fee ({discountRate}%)</span><span className="font-bold text-rose-400">−{formatCurrency(discountAmount)}</span></div>
                                            <div className="flex justify-between border-t border-slate-700 pt-1 mt-1"><span className="font-bold text-slate-300">You Receive</span><span className="font-black text-emerald-400 text-base">{formatCurrency(selectedEvent.amount - discountAmount)}</span></div>
                                        </div>
                                        <button onClick={handleAcceptEarlyPayout} disabled={isUpdating}
                                            className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5" />
                                            {isUpdating ? 'Processing…' : 'Accept Early Payout'}
                                        </button>
                                    </div>
                                </>
                            )}

                            {selectedEvent.status === 'Paid' && (
                                <div className="text-center text-emerald-400 font-bold text-sm py-2">
                                    💰 Payment Disbursed
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Legend ────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-3 text-xs justify-end">
                {Object.entries(STATUS_CONFIG).map(([k, cfg]) => (
                    <span key={k} className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm inline-block" style={{ background: cfg.bg }} />
                        <span className="text-slate-400">{cfg.label}</span>
                    </span>
                ))}
            </div>
        </div>
    );
}
