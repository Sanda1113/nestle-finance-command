import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import axios from 'axios';
import { supabase } from '../utils/supabaseClient';
import {
    Calendar as CalendarIcon,
    Clock,
    X,
    CheckCircle2,
    AlertCircle,
    DollarSign,
    Bell,
    ChevronLeft,
    ChevronRight,
    Filter,
    Zap,
    Download,
    CreditCard,
    Shield,
    ShieldCheck
} from 'lucide-react';

const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

const formatCurrency = (amount, currencyCode = 'USD') => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount); }
    catch { return `${currencyCode} ${Number(amount).toFixed(2)}`; }
};

const getStatusCfg = (status) => {
    switch (status) {
        case 'Paid': return { bg: 'from-emerald-400/90 to-teal-600/90', icon: '✅', glow: 'shadow-[0_0_20px_rgba(52,211,153,0.3)]', label: 'Paid' };
        case 'Scheduled': return { bg: 'from-blue-400/90 to-indigo-600/90', icon: '📅', glow: 'shadow-[0_0_20px_rgba(96,165,250,0.3)]', label: 'Scheduled' };
        case 'Staged': return { bg: 'from-blue-400/90 to-indigo-600/90', icon: '⏳', glow: 'shadow-[0_0_20px_rgba(96,165,250,0.3)]', label: 'To be paid' };
        case 'Hold': return { bg: 'from-amber-400/90 to-orange-600/90', icon: '⏸️', glow: 'shadow-[0_0_20px_rgba(251,191,36,0.3)]', label: 'On Hold' };
        case 'Early Payment Requested': return { bg: 'from-purple-400/90 to-pink-600/90', icon: '⚡', glow: 'shadow-[0_0_20px_rgba(192,132,252,0.3)]', label: 'Early Payout' };
        case 'Pending Finance': return { bg: 'from-blue-400/90 to-indigo-600/90', icon: '⏳', glow: 'shadow-[0_0_20px_rgba(96,165,250,0.3)]', label: 'To be paid' };
        default: return { bg: 'from-slate-400/90 to-slate-600/90', icon: '⏳', glow: 'shadow-[0_0_20px_rgba(148,163,184,0.3)]', label: 'To be paid' };
    }
};

const CustomToolbar = (toolbar) => {
    const goToBack = () => toolbar.onNavigate('PREV');
    const goToNext = () => toolbar.onNavigate('NEXT');
    const goToToday = () => toolbar.onNavigate('TODAY');
    const dailyBurn = 2450.75;
    const currentDate = toolbar.date;

    return (
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 bg-white/5 p-6 rounded-3xl border border-white/5 backdrop-blur-md">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <button onClick={goToBack} className="p-3 text-slate-400 hover:text-white hover:bg-white/10 rounded-2xl border border-white/5 transition-all group shadow-inner">
                        <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <button onClick={goToToday} className="px-6 py-3 text-sm font-black text-white hover:bg-white/10 rounded-2xl border border-white/5 transition-all shadow-inner uppercase tracking-widest">Today</button>
                    <button onClick={goToNext} className="p-3 text-slate-400 hover:text-white hover:bg-white/10 rounded-2xl border border-white/5 transition-all group shadow-inner">
                        <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
                <div className="text-left">
                    <h2 className="text-2xl font-black text-white capitalize tracking-tighter mb-1">{toolbar.label}</h2>
                    <div className="flex gap-2">
                        <select
                            value={currentDate.getMonth()}
                            onChange={(e) => {
                                const newDate = new Date(currentDate);
                                newDate.setMonth(parseInt(e.target.value));
                                toolbar.onNavigate('DATE', newDate);
                            }}
                            className="bg-white/5 border border-white/10 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 py-1 outline-none hover:bg-white/10 transition-colors"
                        >
                            {moment.months().map((m, i) => <option key={i} value={i} className="bg-slate-900">{m}</option>)}
                        </select>
                        <select
                            value={currentDate.getFullYear()}
                            onChange={(e) => {
                                const newDate = new Date(currentDate);
                                newDate.setFullYear(parseInt(e.target.value));
                                toolbar.onNavigate('DATE', newDate);
                            }}
                            className="bg-white/5 border border-white/10 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 py-1 outline-none hover:bg-white/10 transition-colors"
                        >
                            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="hidden xl:flex items-center gap-8 px-8 border-x border-white/10">
                <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Treasury Outflow</p>
                    <p className="text-xl font-black text-rose-500">{formatCurrency(dailyBurn)}</p>
                </div>
                <div className="w-px h-10 bg-white/10"></div>
                <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Disbursement SLA</p>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                        <span className="text-sm font-black text-emerald-400">99.8%</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-2xl border border-white/5">
                {['month', 'week', 'day', 'agenda'].map((v) => (
                    <button
                        key={v}
                        onClick={() => toolbar.onView(v)}
                        className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${toolbar.view === v ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                    >
                        {v}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default function DigitalCalendar({ userRole, userEmail, refreshTrigger, trustTier = 2, onAcceptEarlyPayout }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [eventTrustProfile, setEventTrustProfile] = useState(null);
    const [holdDate, setHoldDate] = useState('');
    const [discountRate, setDiscountRate] = useState(2.5);
    const [view, setView] = useState('month');
    const [currentDate, setCurrentDate] = useState(new Date());

    const isFinance = userRole === 'Finance';

    const upcomingReminders = useMemo(() => {
        const now = moment();
        return events
            .filter(e => {
                const days = moment(e.start).diff(now, 'days');
                return days >= 0 && days <= 14 && e.status !== 'Paid';
            })
            .sort((a, b) => moment(a.start).valueOf() - moment(b.start).valueOf())
            .slice(0, 5);
    }, [events]);

    const eventStyleGetter = (event) => {
        const cfg = getStatusCfg(event.status);
        const isOverdue = moment(event.start).isBefore(moment(), 'day') && event.status !== 'Paid';
        return {
            className: `bg-gradient-to-br ${cfg.bg} backdrop-blur-md border border-white/10 rounded-xl shadow-lg ${cfg.glow} hover:scale-[1.02] active:scale-95 transition-all duration-300 ${isOverdue ? 'ring-2 ring-rose-500 animate-pulse' : ''}`,
            style: {
                fontSize: '10px',
                fontWeight: '900',
                padding: '6px 10px',
                color: 'white',
                minHeight: '28px',
                display: 'flex',
                alignItems: 'center',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                letterSpacing: '0.025em',
                cursor: isFinance ? 'grab' : 'pointer'
            }
        };
    };

    const fetchEvents = useCallback(async () => {
        const cleanEmail = userEmail?.trim();
        if (!isFinance && !cleanEmail) {
            console.warn('[DigitalCalendar] Skipping fetch: cleanEmail is missing for Supplier');
            return;
        }

        setLoading(true);
        try {
            const url = 'https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts';
            const params = isFinance ? {} : { email: cleanEmail };

            const res = await axios.get(url, { params });
            if (res.data.success) {
                const mapped = (res.data.data || []).map(p => ({
                    ...p,
                    id: p.id,
                    start: new Date(p.start_date),
                    end: new Date(p.end_date || p.start_date),
                    allDay: false,
                    title: `${getStatusCfg(p.status).icon} ${p.title || 'Payout'}`,
                    status: p.status,
                    amount: p.final_amount || p.base_amount || 0,
                }));
                setEvents(mapped);
            }
        } catch (err) {
            console.error('[DigitalCalendar] Fetch Error:', err.message);
        } finally {
            setLoading(false);
        }
    }, [isFinance, userEmail]);

    useEffect(() => {
        fetchEvents();

        const channel = supabase
            .channel('digital_calendar_sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'payout_schedules' },
                () => {
                    fetchEvents();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchEvents]);

    useEffect(() => {
        fetchEvents();
    }, [refreshTrigger, fetchEvents]);

    useEffect(() => {
        if (!selectedEvent || !isFinance) {
            setEventTrustProfile(null);
            return;
        }
        const fetchTrust = async () => {
            try {
                const res = await axios.get(`https://nestle-finance-command-production.up.railway.app/api/sprint2/trust-profile?email=${encodeURIComponent(selectedEvent.supplier_email)}`);
                if (res.data.success) setEventTrustProfile(res.data.data);
            } catch { setEventTrustProfile(null); }
        };
        fetchTrust();
    }, [selectedEvent, isFinance]);

    const updateEventDate = useCallback(async (id, start, end) => {
        // Optimistic UI update
        setEvents(prev => prev.map(ev => String(ev.id) === String(id) ? { ...ev, start, end } : ev));

        try {
            await axios.patch(`https://nestle-finance-command-production.up.railway.app/api/sprint2/payouts/${id}`, {
                start_date: start.toISOString(),
                end_date: end.toISOString(),
                updatedBy: userRole
            });
        } catch (err) {
            console.error('Failed to update event date', err);
            // Revert on error
            fetchEvents();
        }
    }, [userRole, fetchEvents]);

    const onEventDrop = useCallback(({ event, start, end }) => {
        if (!isFinance) return;
        updateEventDate(event.id, start, end);
    }, [isFinance, updateEventDate]);

    const onEventResize = useCallback(({ event, start, end }) => {
        if (!isFinance) return;
        updateEventDate(event.id, start, end);
    }, [isFinance, updateEventDate]);

    const handleSelectEvent = useCallback((event) => setSelectedEvent(event), []);

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
                requestedDate: new Date().toISOString(),
                discountRate: discountRate / 100,
                finalAmount: selectedEvent.amount - discountAmount
            });

            // 🔥 NOTIFY FINANCE
            await supabase.from('app_notifications').insert({
                role: 'Finance',
                title: '⚡ Early Payout Accepted',
                message: `Supplier ${userEmail} accepted an early payout offer for ${formatCurrency(selectedEvent.amount - discountAmount)}. Please review in Treasury.`,
                type: 'payout_accepted',
                link: '/portal?tab=treasury',
                is_read: false,
                created_at: new Date().toISOString()
            });

            await fetchEvents();
            setSelectedEvent(null);
            alert('⚡ Liquidity successfully accelerated! Your funds are being transferred.');
        } catch (error) {
            const msg = error.response?.data?.error || 'Failed to request early payout';
            alert('❌ ' + msg);
        }
        finally { setIsUpdating(false); }
    };

    const CalComponent = isFinance ? DnDCalendar : Calendar;

    return (
        <div className="flex flex-col lg:flex-row gap-6 p-1">

            {/* Sidebar with Insights & Reminders */}
            <div className="w-full lg:w-80 shrink-0 space-y-6">

                {/* Liquidity Stats Card */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
                            <Zap className="w-5 h-5 text-emerald-400" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Real-time Forecast</span>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Liquidity</p>
                            <p className="text-3xl font-black text-white">{formatCurrency(events.reduce((s, e) => s + (e.status !== 'Paid' ? e.amount : 0), 0))}</p>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 w-3/4 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-indigo-400">75% Scheduled</span>
                            <span className="text-slate-500">25% On Hold</span>
                        </div>
                    </div>
                </div>

                {/* Upcoming Payments Strip */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="px-6 py-5 border-b border-slate-800/50 flex items-center justify-between bg-slate-800/30">
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-amber-400" />
                            <span className="text-sm font-black text-white">Reminders</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">Next 14d</span>
                    </div>
                    <div className="p-3 space-y-2">
                        {upcomingReminders.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-8 italic">No urgent payments found.</p>
                        ) : (
                            upcomingReminders.map(ev => {
                                const days = moment(ev.start).diff(moment(), 'days');
                                const cfg = getStatusCfg(ev.status);
                                return (
                                    <div key={ev.id} onClick={() => setSelectedEvent(ev)}
                                        className="group relative flex items-center justify-between bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/30 rounded-2xl px-4 py-3 cursor-pointer transition-all duration-300">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.bg} flex items-center justify-center text-lg shadow-lg ${cfg.glow}`}>
                                                {cfg.icon}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-white line-clamp-1">{ev.title?.replace(/^[^\s]+\s/, '')}</p>
                                                <p className="text-[10px] font-bold text-slate-500">{moment(ev.start).format('ddd, MMM D')}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-emerald-400">{formatCurrency(ev.amount)}</p>
                                            <p className={`text-[9px] font-bold uppercase tracking-tighter ${days === 0 ? 'text-rose-500' : days <= 2 ? 'text-amber-500' : 'text-slate-500'}`}>
                                                {days === 0 ? 'Due Today' : `${days}d left`}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Legend Card */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 shadow-2xl">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Status Legend</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {['Scheduled', 'Paid', 'Hold', 'Early Payment Requested'].map((k) => {
                            const cfg = getStatusCfg(k);
                            return (
                                <div key={k} className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${cfg.bg} shadow-lg ${cfg.glow}`}></div>
                                    <span className="text-[10px] font-bold text-slate-300">{cfg.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Main Calendar Section */}
            <div className="flex-1 min-w-0">
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <style>{`
                        .rbc-calendar { 
                            min-height: 750px; 
                            font-family: inherit; 
                            background: transparent; 
                        }
                        .rbc-month-view, .rbc-time-view, .rbc-day-bg, .rbc-month-row { 
                            border-color: rgba(51, 65, 85, 0.5) !important; 
                        }
                        .rbc-header { 
                            padding: 12px; 
                            background: rgba(30, 41, 59, 0.8); 
                            border-color: rgba(51, 65, 85, 0.5) !important; 
                            color: #64748b; 
                            font-size: 10px; 
                            font-weight: 900; 
                            text-transform: uppercase; 
                            letter-spacing: 0.1em; 
                        }
                        .rbc-today { 
                            background-color: rgba(99, 102, 241, 0.1) !important; 
                        }
                        .rbc-off-range-bg { 
                            background-color: rgba(15, 23, 42, 0.4) !important; 
                        }
                        .rbc-event { 
                            border-radius: 8px !important; 
                            border: none !important; 
                            box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
                        }
                        .rbc-date-cell { 
                            color: #94a3b8; 
                            font-size: 13px; 
                            font-weight: 700;
                            padding: 8px 12px; 
                        }
                        .rbc-date-cell.rbc-now { 
                            color: #60a5fa; 
                        }
                        .rbc-show-more { 
                            color: #6366f1; 
                            font-size: 10px; 
                            font-weight: 900; 
                            text-transform: uppercase;
                        }
                        .rbc-month-row { overflow: visible; }
                        .rbc-month-view .rbc-month-row {
                            min-height: 100px;
                        }
                        .rbc-day-bg {
                            transition: background-color 0.2s;
                        }
                        .rbc-day-bg:hover {
                            background-color: rgba(99, 102, 241, 0.05) !important;
                        }
                    `}</style>

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
                        selectable={isFinance}
                        draggableAccessor={() => isFinance}
                        resizableAccessor={() => isFinance}
                        allDayAccessor={() => false}
                        onSelectEvent={handleSelectEvent}
                        eventPropGetter={eventStyleGetter}
                        components={{
                            toolbar: (props) => <CustomToolbar {...props} setCurrentDate={setCurrentDate} />
                        }}
                        startAccessor="start"
                        endAccessor="end"
                        popup
                        style={{ height: '80vh' }}
                    />
                </div>
            </div>

            {/* Event Detail Overlay (Glassmorphic Slide-in) */}
            {selectedEvent && (
                <div className="fixed inset-0 z-[150] flex items-center justify-end p-6 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="absolute inset-0" onClick={() => setSelectedEvent(null)}></div>
                    <div className="relative w-full max-w-md h-full bg-slate-900 border border-slate-800 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col animate-in slide-in-from-right-10 duration-500">

                        {/* Detail Header */}
                        <div className={`p-8 bg-gradient-to-br ${getStatusCfg(selectedEvent.status).bg} relative overflow-hidden`}>
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                            <div className="relative z-10 flex justify-between items-start">
                                <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 text-2xl">
                                    {getStatusCfg(selectedEvent.status).icon}
                                </div>
                                <button onClick={() => setSelectedEvent(null)} className="p-2 bg-black/20 hover:bg-black/40 rounded-xl text-white transition-all">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="relative z-10 mt-6">
                                <span className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em]">Transaction Details</span>
                                <h3 className="text-2xl font-black text-white mt-1 leading-tight">{selectedEvent.title?.replace(/^[^\s]+\s/, '')}</h3>
                                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/30">
                                    <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                                    <span className="text-[10px] font-black text-white uppercase tracking-wider">{getStatusCfg(selectedEvent.status).label}</span>
                                </div>
                            </div>
                        </div>

                        {/* Detail Content */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">

                            {/* Primary Info Cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-3xl">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Payout Value</p>
                                    <p className="text-xl font-black text-emerald-400">{formatCurrency(selectedEvent.amount)}</p>
                                </div>
                                <div className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-3xl">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Scheduled Date</p>
                                    <p className="text-xl font-black text-white">{moment(selectedEvent.start).format('MMM D, YYYY')}</p>
                                </div>
                            </div>

                            {/* Additional Metadata */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-slate-800/20 rounded-2xl border border-slate-700/30">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400"><CreditCard className="w-4 h-4" /></div>
                                        <span className="text-xs font-bold text-slate-400">Supplier Recipient</span>
                                    </div>
                                    <span className="text-xs font-black text-slate-200">{selectedEvent.supplier_email}</span>
                                </div>

                                {isFinance && eventTrustProfile && (
                                    <div className="flex items-center justify-between p-4 bg-slate-800/20 rounded-2xl border border-slate-700/30">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl ${eventTrustProfile.trust_tier === 1 ? 'bg-emerald-500/10 text-emerald-400' : eventTrustProfile.trust_tier === 2 ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
                                                {eventTrustProfile.trust_tier === 1 ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                                            </div>
                                            <span className="text-xs font-bold text-slate-400">Trust Tier: {eventTrustProfile.trust_tier === 1 ? 'Strategic' : eventTrustProfile.trust_tier === 2 ? 'Standard' : 'High Risk'}</span>
                                        </div>
                                        <span className="text-xs font-black text-slate-200">Accuracy: {eventTrustProfile.accuracy_score || 0}%</span>
                                    </div>
                                )}

                                {selectedEvent.status !== 'Paid' && (
                                    <div className={`flex items-center gap-4 p-5 rounded-[2rem] border ${daysUntilPayout === 0 ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                                            daysUntilPayout <= 3 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                                                'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                        }`}>
                                        <div className="p-3 bg-white/10 rounded-2xl"><Clock className="w-6 h-6" /></div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Payout Counter</p>
                                            <p className="text-lg font-black">{daysUntilPayout === 0 ? 'Payable Today' : `${daysUntilPayout} Business Days Left`}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Advanced Actions */}
                            <div className="pt-4 space-y-4">
                                {isFinance && selectedEvent.status !== 'Paid' && (
                                    <div className="space-y-3">
                                        <button onClick={handleApproveTransfer} disabled={isUpdating}
                                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all shadow-[0_10px_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 group">
                                            <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                            {isUpdating ? 'Executing Payment...' : 'Disburse Funds'}
                                        </button>
                                        <div className="flex gap-2">
                                            <div className="flex-1 bg-slate-800/80 rounded-2xl border border-slate-700 p-1 flex items-center pr-3">
                                                <input type="date" value={holdDate} onChange={(e) => setHoldDate(e.target.value)}
                                                    className="bg-transparent border-0 text-white text-xs font-bold w-full p-2 outline-none" />
                                            </div>
                                            <button onClick={handleHoldPayment} disabled={isUpdating || !holdDate}
                                                className="px-6 py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-2xl transition-all">
                                                Hold Payment
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {!isFinance && selectedEvent.status === 'Scheduled' && (
                                    <div className={`bg-indigo-600/10 border border-indigo-500/20 rounded-[2.5rem] p-6 space-y-6 ${trustTier === 3 ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Zap className="w-4 h-4 text-indigo-400" />
                                                <span className="text-xs font-black text-white uppercase tracking-widest">
                                                    {trustTier === 1 ? 'Strategic Liquidity Slider' : trustTier === 2 ? 'Standard Review Request' : 'Payouts Restricted'}
                                                </span>
                                            </div>
                                            {trustTier === 1 && <span className="text-xs font-black text-indigo-400 bg-indigo-500/20 px-3 py-1 rounded-full">{discountRate.toFixed(1)}% Rate</span>}
                                        </div>

                                        {trustTier === 1 && (
                                            <input type="range" min="1" max="5" step="0.1" value={discountRate}
                                                onChange={(e) => setDiscountRate(Number(e.target.value))}
                                                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500" />
                                        )}

                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs font-bold text-slate-500"><span>Gross Amount</span><span>{formatCurrency(selectedEvent.amount)}</span></div>
                                            {trustTier === 1 && <div className="flex justify-between text-xs font-bold text-rose-500"><span>Service Fee</span><span>-{formatCurrency(discountAmount)}</span></div>}
                                            <div className="h-px bg-slate-700/50 my-4"></div>
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                                                        {trustTier === 1 ? 'Instant Disbursement' : trustTier === 2 ? 'Subject to Review' : 'Contact Risk Support'}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-indigo-400">
                                                        {trustTier === 1 ? `Est. Arrival: ${moment().add(30, 'minutes').format('MMM D, h:mm A')}` : trustTier === 2 ? 'Review: 1–2 Business Days' : 'Action Required'}
                                                    </span>
                                                </div>
                                                <span className="text-3xl font-black text-emerald-400">{formatCurrency(trustTier === 1 ? selectedEvent.amount - discountAmount : selectedEvent.amount)}</span>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={() => {
                                                if (onAcceptEarlyPayout) {
                                                    onAcceptEarlyPayout(selectedEvent.id, selectedEvent.amount);
                                                    setSelectedEvent(null);
                                                } else {
                                                    handleAcceptEarlyPayout();
                                                }
                                            }} 
                                            disabled={isUpdating}
                                            className={`w-full py-4 ${trustTier === 3 ? 'bg-slate-700' : 'bg-indigo-600 hover:bg-indigo-500'} text-white font-black rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2`}
                                        >
                                            {trustTier === 1 ? <Download className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                            {isUpdating ? 'Processing...' : trustTier === 1 ? 'Accept Instant Offer' : trustTier === 2 ? 'Request Early Payout' : 'Locked'}
                                        </button>
                                    </div>
                                )}

                                {!isFinance && selectedEvent.status === 'Hold' && (
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6 text-center">
                                        <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <AlertCircle className="w-8 h-8 text-amber-400" />
                                        </div>
                                        <p className="text-xl font-black text-white">Payment On Hold</p>
                                        <p className="text-xs font-bold text-amber-500 mt-2">
                                            Nestlé Finance has placed a temporary hold on this payment until {moment(selectedEvent.hold_until_date || selectedEvent.start).format('MMM D, YYYY')}.
                                        </p>
                                    </div>
                                )}

                                {!isFinance && selectedEvent.status === 'Renegotiated' && (
                                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-3xl p-6 text-center">
                                        <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Zap className="w-8 h-8 text-purple-400" />
                                        </div>
                                        <p className="text-xl font-black text-white">Early Payout Accepted</p>
                                        <p className="text-xs font-bold text-purple-400 mt-2">
                                            You accepted an early payout offer. Funds will arrive on {moment(selectedEvent.start).format('MMM D, YYYY')}.
                                        </p>
                                    </div>
                                )}

                                {selectedEvent.status === 'Paid' && (
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 text-center">
                                        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                        </div>
                                        <p className="text-xl font-black text-white">Payment Completed</p>
                                        <p className="text-xs font-bold text-slate-500 mt-2 line-clamp-1">Ref: {selectedEvent.bank_transaction_ref || 'TRX-998234-AX'}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}