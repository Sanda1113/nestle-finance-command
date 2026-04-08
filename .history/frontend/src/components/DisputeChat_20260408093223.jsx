import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Paperclip, MessageSquareWarning, RefreshCw, Clock, CheckCircle2, Download, Tag, Bot, FileSignature } from 'lucide-react';

export default function DisputeChat({ referenceNumber, userEmail, userRole, varianceType, onResubmit }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [disputeStatus, setDisputeStatus] = useState('Open');
    const messagesEndRef = useRef(null);

    const quickReplies = userRole === 'Finance'
        ? ["Please upload Proof of Delivery (POD).", "Can you clarify this missing quantity?", "Requesting Credit Note for shortage."]
        : ["POD attached below.", "Credit Note generated.", "Will ship backordered items tomorrow."];

    const fetchMessages = async () => {
        try {
            const res = await axios.get(`https://nestle-finance-command-production.up.railway.app/api/sprint2/disputes/${referenceNumber}`);
            setMessages(res.data.data);
            if (res.data.data.length > 4) setDisputeStatus('Pending Approval');
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, [referenceNumber]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const sendMessage = async (text = newMessage, forceRole = userRole) => {
        if (!text.trim()) return;
        setIsSending(true);
        try {
            await axios.post('https://nestle-finance-command-production.up.railway.app/api/sprint2/disputes/send', {
                referenceNumber, senderEmail: userEmail, senderRole: forceRole, message: text
            });
            setNewMessage('');
            fetchMessages();
        } catch (err) { alert('Message failed'); }
        finally { setIsSending(false); }
    };

    const handleFormalAction = (action) => {
        const text = `SYSTEM LOG: Formal action taken: [${action}]. Awaiting final signature.`;
        sendMessage(text, 'System');
        setDisputeStatus('Resolved');
    };

    const exportAuditPDF = () => {
        const printWindow = window.open('', '', 'width=800,height=900');
        const html = `
            <html><head><title>Audit Log: ${referenceNumber}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                h2 { border-bottom: 2px solid #1e293b; padding-bottom: 10px; color: #2563eb; }
                .msg { margin-bottom: 15px; padding: 10px; border-left: 4px solid #cbd5e1; background: #f8fafc; }
                .msg.finance { border-left-color: #3b82f6; }
                .meta { font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; }
                .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            </style>
            </head><body>
                <h2>Enterprise Dispute Audit Record</h2>
                <p><strong>Reference:</strong> ${referenceNumber}<br/><strong>Generated:</strong> ${new Date().toLocaleString()}<br/><strong>Category:</strong> ${varianceType || 'General Resolution'}</p>
                <hr/>
                ${messages.map(m => `
                    <div class="msg ${m.sender_role === 'Finance' ? 'finance' : ''}">
                        <div class="meta">${m.sender_role} • ${new Date(m.created_at).toLocaleString()}</div>
                        <div>${m.message}</div>
                    </div>
                `).join('')}
                <div class="footer">Digitally sealed and exported from Nestle Finance Command Center.</div>
            </body></html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 500);
    };

    return (
        <div className="flex flex-col h-[650px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden font-sans">
            {/* Enterprise Header */}
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center relative overflow-hidden shrink-0">
                <div className={`absolute top-0 left-0 w-full h-1 ${disputeStatus === 'Open' ? 'bg-amber-500' : disputeStatus === 'Resolved' ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${disputeStatus === 'Open' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' : disputeStatus === 'Resolved' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'}`}>
                        {disputeStatus === 'Open' ? <MessageSquareWarning className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    </div>
                    <div>
                        <h4 className="font-black text-slate-800 dark:text-white tracking-tight">Resolution Hub</h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <span>REF: {referenceNumber}</span>
                            <span>•</span>
                            <span className={`flex items-center gap-1 ${disputeStatus === 'Open' ? 'text-amber-500' : 'text-emerald-500'}`}>
                                <Clock className="w-3 h-3" /> SLA: 24h
                            </span>
                            {varianceType && (
                                <><span>•</span><span className="flex items-center gap-1 text-purple-500 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded"><Tag className="w-3 h-3" /> {varianceType}</span></>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    {userRole === 'Finance' && (
                        <button onClick={exportAuditPDF} className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold rounded-lg transition-colors" title="Export Audit Log">
                            <Download className="w-4 h-4" /> Export
                        </button>
                    )}
                    {userRole === 'Supplier' && onResubmit && (
                        <button onClick={onResubmit} className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-black uppercase rounded-lg transition-colors">
                            <RefreshCw className="w-4 h-4" /> Replace Docs
                        </button>
                    )}
                </div>
            </div>

            {/* NEW: AI Suggestion Banner */}
            {userRole === 'Finance' && disputeStatus === 'Open' && (
                <div className="bg-linear-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-b border-indigo-100 dark:border-indigo-900/50 p-3 px-5 flex items-start gap-3 shrink-0">
                    <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300">AI Intelligence Suggestion</p>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Based on variance type ({varianceType}), this is likely a minor tax rounding issue. Suggesting auto-approval to save time.</p>
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
                    const showAvatar = idx === 0 || messages[idx - 1].sender_role !== msg.sender_role;

                    if (isSystem) {
                        return (
                            <div key={msg.id} className="flex justify-center my-4">
                                <span className="bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                    {msg.message}
                                </span>
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

            {/* NEW: Formal Structured Action Form (Finance Only) */}
            {userRole === 'Finance' && disputeStatus !== 'Resolved' && (
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 shrink-0">
                    <p className="text-[10px] font-black uppercase text-slate-500 mb-2 flex items-center gap-1"><FileSignature className="w-3 h-3" /> Formal Actions</p>
                    <div className="flex gap-2">
                        <button onClick={() => handleFormalAction('Issue Credit Note')} className="flex-1 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-all">Request Credit Note</button>
                        <button onClick={() => handleFormalAction('Force Auto-Approve')} className="flex-1 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-lg transition-all">Force Approve</button>
                        <button onClick={() => handleFormalAction('Escalate to Procurement')} className="flex-1 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-red-500 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg transition-all">Escalate Issue</button>
                    </div>
                </div>
            )}

            <div className="px-4 py-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                {quickReplies.map((reply, i) => (
                    <button key={i} onClick={() => sendMessage(reply)} className="whitespace-nowrap px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-medium transition-colors">
                        {reply}
                    </button>
                ))}
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                    <button className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all" title="Attach file">
                        <Paperclip className="w-5 h-5" />
                    </button>
                    <textarea
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="Type official response..."
                        className="flex-1 max-h-32 min-h-[40px] py-2.5 px-2 bg-transparent border-none outline-none resize-none text-sm dark:text-white"
                        rows="1"
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    />
                    <button onClick={() => sendMessage(newMessage)} disabled={!newMessage.trim() || isSending} className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all disabled:opacity-50 disabled:hover:bg-blue-600 flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20">
                        <Send className={`w-4 h-4 ${isSending ? 'animate-pulse' : 'translate-x-[-1px] translate-y-[1px]'}`} />
                    </button>
                </div>
            </div>
        </div>
    );
}