import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Edit2, CheckCircle2, Calendar as CalendarIcon, Clock, X } from 'lucide-react';
import axios from 'axios';

const formatCurrency = (amount, currencyCode = 'USD') => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount); }
    catch { return `${currencyCode} ${Number(amount).toFixed(2)}`; }
};

export default function DigitalCalendar({ payouts, onUpdatePayout, userRole, loading }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedPayout, setSelectedPayout] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [newDate, setNewDate] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

    const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    
    const handleYearChange = (e) => setCurrentDate(new Date(parseInt(e.target.value), currentMonth, 1));
    const handleMonthChange = (e) => setCurrentDate(new Date(currentYear, parseInt(e.target.value), 1));

    const handleEditClick = (payout) => {
        setSelectedPayout(payout);
        setNewDate(new Date(payout.due_date).toISOString().split('T')[0]);
        setIsEditModalOpen(true);
    };

    const handleUpdateDate = async () => {
        if (!selectedPayout || !newDate) return;
        setIsUpdating(true);
        try {
            const res = await axios.patch(`https://nestle-finance-command-production.up.railway.app/api/payouts/${selectedPayout.id}/date`, {
                newDate,
                updatedBy: userRole
            });
            if (res.data.success) {
                onUpdatePayout && onUpdatePayout();
                setIsEditModalOpen(false);
            }
        } catch (error) {
            alert('Failed to update payout date.');
        } finally {
            setIsUpdating(false);
        }
    };

    const days = [];
    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} className="p-2 border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 opacity-50 min-h-[100px]"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = new Date(currentYear, currentMonth, day).toDateString();
        const dayPayouts = payouts.filter(p => new Date(p.due_date).toDateString() === dateStr);
        
        const isToday = new Date().toDateString() === dateStr;

        days.push(
            <div key={day} className={`p-2 flex flex-col border border-slate-200 dark:border-slate-700 min-h-[120px] transition-colors ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-500' : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <div className="flex justify-between items-start mb-2">
                    <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-slate-700 dark:text-slate-300'}`}>
                        {day}
                    </span>
                    {dayPayouts.length > 0 && (
                        <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">
                            {dayPayouts.length}
                        </span>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide">
                    {dayPayouts.map(p => (
                        <div key={p.id} className={`group relative p-1.5 rounded border text-[10px] leading-tight flex flex-col gap-0.5 shadow-sm ${p.status === 'Paid' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-300' : p.status === 'Early Payment Requested' ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800/50 dark:text-purple-300' : 'bg-white border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'}`}>
                            <div className="font-bold truncate">{userRole === 'Finance' ? (p.vendor_name || p.supplier_email) : p.invoice_number}</div>
                            <div className="font-black">{formatCurrency(p.early_payment_amount || p.payout_amount)}</div>
                            
                            {userRole === 'Finance' && p.status !== 'Paid' && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleEditClick(p); }}
                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 bg-white dark:bg-slate-700 rounded shadow hover:bg-blue-50 dark:hover:bg-slate-600 text-blue-600 dark:text-blue-400 transition-all"
                                    title="Edit Payout Date"
                                >
                                    <Edit2 className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const yearOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i);

    return (
        <div className="bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={handlePrevMonth} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </button>
                    <div className="flex gap-2">
                        <select 
                            value={currentMonth} 
                            onChange={handleMonthChange}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                        <select 
                            value={currentYear} 
                            onChange={handleYearChange}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <button onClick={handleNextMonth} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-sm">
                        Today
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="p-4 flex-1">
                {loading ? (
                    <div className="h-64 flex items-center justify-center text-slate-400 animate-pulse font-bold">
                        Loading calendar data...
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-7 mb-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="text-center text-xs font-black uppercase text-slate-400 tracking-wider py-2">
                                    {day}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700 rounded-xl overflow-hidden shadow-inner">
                            {days}
                        </div>
                    </>
                )}
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && selectedPayout && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-blue-500" /> Edit Payout Date
                            </h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Invoice Number</label>
                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedPayout.invoice_number}</div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Supplier</label>
                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedPayout.vendor_name || selectedPayout.supplier_email}</div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount</label>
                                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedPayout.early_payment_amount || selectedPayout.payout_amount)}</div>
                            </div>
                            <div className="pt-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">New Payout Date</label>
                                <input 
                                    type="date" 
                                    value={newDate}
                                    onChange={(e) => setNewDate(e.target.value)}
                                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 dark:text-white"
                                />
                                <p className="text-xs text-slate-500 mt-2">
                                    Changing this date will notify the supplier via email and in-app notification.
                                </p>
                            </div>
                            <div className="mt-6 flex gap-3">
                                <button 
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleUpdateDate}
                                    disabled={isUpdating}
                                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2"
                                >
                                    {isUpdating ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    {isUpdating ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
