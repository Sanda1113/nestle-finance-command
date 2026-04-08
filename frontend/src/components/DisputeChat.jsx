import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Paperclip, MessageSquareWarning, RefreshCw, Clock, CheckCircle2, Download, Tag, Bot, FileSignature, FileSpreadsheet } from 'lucide-react';

export default function DisputeChat({ referenceNumber, userEmail, userRole, varianceType, onResubmit }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [disputeStatus, setDisputeStatus] = useState('Open');
    const messagesEndRef = useRef(null);

    // NEW: Structured Form State
    const [isFormMode, setIsFormMode] = useState(false);
    const [formType, setFormType] = useState('Quantity Mismatch');
    const [formAmount, setFormAmount] = useState('');

    const quickReplies = userRole === 'Finance'
        ? ["Please upload Proof of Delivery (POD).", "Can you clarify this missing quantity?", "Requesting Credit Note."]
        : ["POD attached below.", "Credit Note generated.", "Will ship backordered items tomorrow."];

    const fetchMessages = async () => {
        try {
            const res = await axios.get(`https://nestle-finance-command-production.up.railway.app/api/sprint2/disputes/${referenceNumber}`);
            setMessages(res.data.data);

            // NEW: SLA Escalation Engine Logic
            const timeSinceStart = res.data.data.length > 0 ? (new Date() - new Date(res.data.data[0].created_at)) / (1000 * 60 * 60) : 0;
            if (res.data.data.some(m => m.message.includes('[FORMAL DISPUTE LOGGED]'))) {
                setDisputeStatus('Escalated');
            } else if (res.data.data.length > 5 || timeSinceStart > 24) {
                setDisputeStatus('SLA Breached');
            } else {
                setDisputeStatus('Open');
            }
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, [referenceNumber]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const sendMessage = async (text = newMessage, forceRole = userRole, metadata = null) => {
        if (!text.trim() && !metadata) return;
        setIsSending(true);
        try {
            await axios.post('https://nestle-finance-command-production.up.railway.app/api/sprint2/disputes/send', {
                referenceNumber, senderEmail: userEmail, senderRole: forceRole, message: text, metadata
            });
            setNewMessage('');
            setIsFormMode(false);
            fetchMessages();
        } catch (err) { alert('Message failed'); }
        finally { setIsSending(false); }
    };

    const submitStructuredForm = () => {
        sendMessage("Formal Dispute Record Submitted.", userRole, { type: formType, amount: formAmount });
    };

    const getStatusStyle = () => {
        if (disputeStatus === 'Resolved') return 'bg-blue-500';
        if (disputeStatus === 'Escalated' || disputeStatus === 'SLA Breached') return 'bg-red-500';
        return 'bg-amber-500';
    };

    return (
        <div className="flex flex-col h-[650px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden font-sans">
            {/* Enterprise Header */}
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center relative overflow-hidden shrink-0">
                <div className={`absolute top-0 left-0 w-full h-1 ${getStatusStyle()}`}></div>
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${disputeStatus === 'Open' ? 'bg-amber-100 text-amber-600' : disputeStatus.includes('SLA') || disputeStatus === 'Escalated' ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-emerald-100 text-emerald-600'}`}>
                        {disputeStatus === 'Open' ? <MessageSquareWarning className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    </div>
                    <div>
                        <h4 className="font-black text-slate-800 dark:text-white tracking-tight">Resolution Hub</h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <span>REF: {referenceNumber}</span>
                            <span>•</span>
                            <span className={`flex items-center gap-1 ${disputeStatus.includes('SLA') || disputeStatus === 'Escalated' ? 'text-red-500' : 'text-amber-500'}`}>
                                <Clock className="w-3 h-3" /> Status: {disputeStatus}
                            </span>
                            {varianceType && (
                                <><span>•</span><span className="flex items-center gap-1 text-purple-500 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded"><Tag className="w-3 h-3" /> {varianceType}</span></>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    {userRole === 'Supplier' && onResubmit && (
                        <button onClick={onResubmit} className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-black uppercase rounded-lg transition-colors">
                            <RefreshCw className="w-4 h-4" /> Replace Docs
                        </button>
                    )}
                </div>
            </div>

            {/* AI Suggestion Banner */}
            {userRole === 'Finance' && disputeStatus === 'Open' && (
                <div className="bg-linear-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-b border-indigo-100 dark:border-indigo-900/50 p-3 px-5 flex items-start gap-3 shrink-0">
                    <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300">AI Intelligence Suggestion</p>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Based on variance type ({varianceType}), this is likely a minor tax rounding issue. Suggesting auto-approval.</p>
                    </div>
                </div>
            )}

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50 dark:bg-slate-950/50 relative">
                {messages.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 opacity-60">
                        <div className="w-20 h-20 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4"><MessageSquareWarning className="w-10 h-10 text-slate-400" /></div>
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Start Resolution Thread</p>
                        <p className="text-xs text-slate-400 mt-2 max-w-[250px]">Messages sent here are recorded in the official audit ledger.</p>
                    </div>
                ) : null}

                {messages.map((msg, idx) => {
                    const isMe = msg.sender_role === userRole;
                    const isSystem = msg.sender_role === 'System';
                    const isFormalLog = msg.message.includes('[FORMAL DISPUTE LOGGED]');
                    const showAvatar = idx === 0 || messages[idx - 1].sender_role !== msg.sender_role;

                    if (isSystem || isFormalLog) {
                        return (
                            <div key={msg.id} className="flex justify-center my-4">
                                <div className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50 text-slate-700 dark:text-slate-300 text-xs px-4 py-3 rounded-xl shadow-sm max-w-[80%] whitespace-pre-wrap font-mono">
                                    <div className="text-red-500 font-bold mb-1 uppercase flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Official Record</div>
                                    {msg.message}
                                </div>
                            </div>
                        )
                    }

                    return (
                        <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex max-w-[85%] gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className="w-8 shrink-0 flex flex-col items-center">
                                    {showAvatar ? (
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md ${isMe ? 'bg-linear-to-br from-blue-500 to-indigo-600' : 'bg-linear-to-br from-slate-600 to-slate-800'}`}>
                                            {msg.sender_role[0]}
                                        </div>
                                    ) : <div className="w-8 h-8"></div>}
                                </div>
                                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    {showAvatar && (
                                        <span className="text-[10px] font-bold text-slate-400 mb-1.5 px-1 uppercase tracking-wider">
                                            {msg.sender_role} <span className="font-normal opacity-50 ml-2">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </span>
                                    )}
                                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-sm'}`}>
                                        {msg.message}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Mode Toggle & Area */}
            <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">

                {/* Form Mode Toggle */}
                {userRole === 'Finance' && (
                    <div className="flex border-b border-slate-100 dark:border-slate-800">
                        <button onClick={() => setIsFormMode(false)} className={`flex-1 py-2 text-xs font-bold ${!isFormMode ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}>💬 Quick Chat</button>
                        <button onClick={() => setIsFormMode(true)} className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1 ${isFormMode ? 'text-red-600 border-b-2 border-red-600' : 'text-slate-400 hover:bg-slate-50'}`}><FileSpreadsheet className="w-3 h-3" /> Formal Dispute Form</button>
                    </div>
                )}

                {isFormMode ? (
                    <div className="p-4 space-y-3 bg-red-50/30 dark:bg-red-900/10">
                        <select value={formType} onChange={e => setFormType(e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white outline-none">
                            <option>Quantity Mismatch</option>
                            <option>Price Variance</option>
                            <option>Damaged Goods</option>
                            <option>Tax Code Error</option>
                        </select>
                        <input type="text" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="Disputed Amount / Details" className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white outline-none" />
                        <button onClick={submitStructuredForm} disabled={!formAmount} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg transition-colors shadow-md disabled:opacity-50">Log Formal Dispute</button>
                    </div>
                ) : (
                    <>
                        <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
                            {quickReplies.map((reply, i) => (
                                <button key={i} onClick={() => sendMessage(reply)} className="whitespace-nowrap px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-medium transition-colors">
                                    {reply}
                                </button>
                            ))}
                        </div>
                        <div className="p-4 pt-2">
                            <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                                <textarea
                                    value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type response..."
                                    className="flex-1 max-h-32 min-h-[40px] py-2.5 px-2 bg-transparent border-none outline-none resize-none text-sm dark:text-white"
                                    rows="1" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                                />
                                <button onClick={() => sendMessage(newMessage)} disabled={!newMessage.trim() || isSending} className="p-3 bg-blue-600 text-white rounded-xl disabled:opacity-50 flex items-center justify-center shrink-0 shadow-md">
                                    <Send className="w-4 h-4 -translate-x-px translate-y-px" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}