import { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
    Send, Paperclip, MessageSquareWarning, RefreshCw, Clock,
    CheckCircle2, Download, Tag, Bot, FileSignature, FileSpreadsheet,
    AlertCircle, ShieldAlert, User, Cpu
} from 'lucide-react';

const DEEPSEEK_API_KEY = 'sk-782521610545406686bfc54c208e922e';

export default function DisputeChat({ referenceNumber, userEmail, userRole, varianceType, onResubmit, contextData }) {
    const [messages, setMessages] = useState([]);

    const [aiMessages, setAiMessages] = useState([{
        id: 'ai-welcome',
        sender_role: 'AI System',
        message: `Hello! I'm the Nestlé ${userRole === 'Finance' ? 'Internal Finance' : 'Supplier'} AI Assistant. I can help you understand the status of ${referenceNumber}, explain next steps, or answer general supply chain questions. What would you like to know?`,
        created_at: new Date().toISOString()
    }]);

    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [disputeStatus, setDisputeStatus] = useState('Open');

    const [chatMode, setChatMode] = useState('human');
    const [aiThinking, setAiThinking] = useState(false);

    const messagesEndRef = useRef(null);

    const [isFormMode, setIsFormMode] = useState(false);
    const [formType, setFormType] = useState('Quantity Mismatch');
    const [formAmount, setFormAmount] = useState('');

    const fetchMessages = async () => {
        if (chatMode === 'ai') return;

        try {
            const res = await axios.get(`https://nestle-finance-command-production.up.railway.app/api/sprint2/disputes/${referenceNumber}`);
            setMessages(res.data.data);

            const timeSinceStart = res.data.data.length > 0 ? (new Date() - new Date(res.data.data[0].created_at)) / (1000 * 60 * 60) : 0;
            if (res.data.data.some(m => m.message.includes('[FORMAL DISPUTE LOGGED]'))) {
                setDisputeStatus('Escalated');
            } else if (res.data.data.length > 5 || timeSinceStart > 24) {
                setDisputeStatus('SLA Breached');
            } else {
                setDisputeStatus('Open');
            }
        } catch (err) { console.error("Failed to fetch messages:", err); }
    };

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, [referenceNumber, chatMode]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length, aiMessages.length, aiThinking]);

    const sendMessage = async (text = newMessage, forceRole = userRole, metadata = null) => {
        if (!text.trim() && !metadata) return;
        setIsSending(true);

        if (chatMode === 'ai') {
            const userMsg = { id: Date.now(), sender_role: userRole, message: text, created_at: new Date().toISOString() };
            setAiMessages(prev => [...prev, userMsg]);
            setNewMessage('');
            setAiThinking(true);

            try {
                const cleanKey = DEEPSEEK_API_KEY.trim();
                if (!cleanKey) {
                    throw new Error('API key missing');
                }

                // Build conversation history (last 10 messages for context)
                const recentMessages = aiMessages.slice(-10).map(m => ({
                    role: m.sender_role === 'AI System' ? 'assistant' : 'user',
                    content: m.message
                }));

                const actualStatus = contextData?.status || 'Pending Review';
                const poNumber = referenceNumber;

                const systemPrompt = `You are a knowledgeable, conversational supply chain assistant for Nestlé, speaking with a ${userRole === 'Finance' ? 'Nestlé Finance Agent' : 'Nestlé Supplier'}.

Document context:
- Reference Number: ${poNumber}
- Current Status: ${actualStatus}
- Issue / Variance: ${varianceType || 'None'}

Approach:
- Respond naturally and directly to what the user actually asks — do not give generic scripted responses.
- Use the document context above to ground your answers where relevant, but also draw on general supply chain knowledge.
- Be concise (2–4 sentences) unless a detailed explanation is needed.
- If the status or information is unclear, acknowledge it honestly rather than guessing.
- Keep your tone professional yet friendly.
- If you genuinely cannot help, suggest the user switch to the Live Agent tab.`;

                const messagesPayload = [
                    { role: "system", content: systemPrompt },
                    ...recentMessages,
                    { role: "user", content: text }
                ];

                const response = await fetch('https://api.deepseek.com/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${cleanKey}`
                    },
                    body: JSON.stringify({
                        model: "deepseek-chat",
                        messages: messagesPayload,
                        temperature: 0.8,
                        presence_penalty: 0.6,
                        frequency_penalty: 0.4,
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error?.message || "AI request failed");
                }

                const data = await response.json();
                const aiResponseText = data.choices[0].message.content;

                const botMsg = { id: Date.now() + 1, sender_role: 'AI System', message: aiResponseText, created_at: new Date().toISOString() };
                setAiMessages(prev => [...prev, botMsg]);

            } catch (err) {
                console.error("AI Chat Error:", err);
                const errorMsg = {
                    id: Date.now() + 1,
                    sender_role: 'AI System',
                    message: "⚠️ I'm having trouble connecting right now. Please try again or switch to Live Agent mode.",
                    created_at: new Date().toISOString()
                };
                setAiMessages(prev => [...prev, errorMsg]);
            } finally {
                setAiThinking(false);
                setIsSending(false);
            }
            return;
        }

        // Human mode
        try {
            await axios.post('https://nestle-finance-command-production.up.railway.app/api/sprint2/disputes/send', {
                referenceNumber, senderEmail: userEmail, senderRole: forceRole, message: text, metadata
            });
            setNewMessage('');
            setIsFormMode(false);
            fetchMessages();
        } catch { alert('Message failed'); }
        finally { setIsSending(false); }
    };

    const submitStructuredForm = () => {
        sendMessage("Formal Dispute Record Submitted.", userRole, { type: formType, amount: formAmount });
    };

    const handleFormalAction = (action) => {
        const text = `SYSTEM LOG: Formal action taken: [${action}]. Awaiting final signature.`;
        sendMessage(text, 'System');
        setDisputeStatus('Resolved');
    };

    const getStatusStyle = () => {
        if (chatMode === 'ai') return 'bg-purple-500';
        if (disputeStatus === 'Resolved') return 'bg-blue-500';
        if (disputeStatus === 'Escalated' || disputeStatus === 'SLA Breached') return 'bg-red-500';
        return 'bg-emerald-500';
    };

    const activeMessages = chatMode === 'ai' ? aiMessages : messages;

    // Dynamic quick replies based on status and role
    const quickReplies = useMemo(() => {
        const status = contextData?.status || '';
        if (userRole === 'Finance') {
            if (status.includes('Matched')) {
                return ["Approve this match", "Request more documents", "Escalate to manager"];
            } else if (status.includes('Discrepancy')) {
                return ["Please upload POD", "Can you clarify this variance?", "Requesting Credit Note"];
            }
            return ["Please upload Proof of Delivery (POD).", "Can you clarify this variance?", "Requesting Credit Note."];
        } else {
            // Supplier
            if (status.includes('Matched')) {
                return ["What does this status mean?", "Can I deliver now?", "When will payment be released?"];
            } else if (status.includes('Rejected')) {
                return ["Why was this rejected?", "How can I resubmit?", "I want to dispute this."];
            } else if (status.includes('Approved')) {
                return ["I've delivered the goods", "Where is my payment?", "Upload GRN documents"];
            }
            return ["POD attached below.", "Credit Note generated.", "Will ship backordered items tomorrow."];
        }
    }, [contextData?.status, userRole]);

    const exportAuditPDF = () => {
        const printWindow = window.open('', '', 'width=800,height=900');
        const modeLabel = chatMode === 'ai' ? 'AI Assistant Transcript' : 'Live Agent Audit';

        const html = `
            <html><head><title>Audit Log: ${referenceNumber}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                h2 { border-bottom: 2px solid #1e293b; padding-bottom: 10px; color: #2563eb; }
                .msg { margin-bottom: 15px; padding: 10px; border-left: 4px solid #cbd5e1; background: #f8fafc; }
                .msg.finance { border-left-color: #3b82f6; }
                .msg.ai { border-left-color: #a855f7; }
                .meta { font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; }
                .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            </style>
            </head><body>
                <h2>Enterprise Communication Record - ${modeLabel}</h2>
                <p><strong>Reference:</strong> ${referenceNumber}<br/><strong>Generated:</strong> ${new Date().toLocaleString()}<br/><strong>Category:</strong> ${varianceType || 'General Resolution'}</p>
                <hr/>
                ${activeMessages.map(m => `
                    <div class="msg ${m.sender_role === 'Finance' ? 'finance' : m.sender_role === 'AI System' ? 'ai' : ''}">
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
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center relative overflow-hidden shrink-0">
                <div className={`absolute top-0 left-0 w-full h-1 ${getStatusStyle()}`}></div>
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${chatMode === 'ai' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'}`}>
                        {chatMode === 'ai' ? <Cpu className="w-5 h-5" /> : <MessageSquareWarning className="w-5 h-5" />}
                    </div>
                    <div>
                        <h4 className="font-black text-slate-800 dark:text-white tracking-tight">{chatMode === 'ai' ? 'AI Assistant' : 'Finance Support Hub'}</h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <span>REF: {referenceNumber}</span>
                            {chatMode === 'human' && (
                                <>
                                    <span>•</span>
                                    <span className={`flex items-center gap-1 ${disputeStatus.includes('SLA') || disputeStatus === 'Escalated' ? 'text-red-500' : 'text-emerald-500'}`}>
                                        <Clock className="w-3 h-3" /> Ticket: {disputeStatus}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={exportAuditPDF} className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold rounded-lg transition-colors" title="Export Chat Log">
                        <Download className="w-4 h-4" /> Export
                    </button>
                    {userRole === 'Supplier' && onResubmit && chatMode === 'human' && (
                        <button type="button" onClick={onResubmit} className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-black uppercase rounded-lg transition-colors">
                            <RefreshCw className="w-4 h-4" /> Replace Docs
                        </button>
                    )}
                </div>
            </div>

            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/50">
                <button
                    type="button"
                    onClick={() => setChatMode('human')}
                    className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-2 transition-all ${chatMode === 'human' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500 shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800/80'}`}
                >
                    <User className="w-4 h-4" /> Live Agent
                </button>
                <button
                    type="button"
                    onClick={() => setChatMode('ai')}
                    className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-2 transition-all ${chatMode === 'ai' ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 border-b-2 border-purple-500 shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800/80'}`}
                >
                    <Cpu className="w-4 h-4" /> AI Tracking
                </button>
            </div>

            {userRole === 'Finance' && varianceType && disputeStatus === 'Open' && chatMode === 'human' && (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border-b border-red-100 dark:border-red-900/50 p-3 px-5 flex items-start gap-3 shrink-0">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-red-800 dark:text-red-300">Variance Detected</p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Discrepancy tagged as: {varianceType}. Supplier interaction required.</p>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50 dark:bg-slate-950/50 relative">
                {activeMessages.length === 0 && chatMode === 'human' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 opacity-60">
                        <div className="w-20 h-20 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4"><MessageSquareWarning className="w-10 h-10 text-slate-400" /></div>
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Start Communication Thread</p>
                        <p className="text-xs text-slate-400 mt-2 max-w-[250px]">Messages sent here are recorded in the official audit ledger.</p>
                    </div>
                )}

                {activeMessages.map((msg, idx) => {
                    const isMe = msg.sender_role === userRole;
                    const isSystem = msg.sender_role === 'System';
                    const isFormalLog = msg.message.includes('[FORMAL DISPUTE LOGGED]');
                    const isAi = msg.sender_role === 'AI System';
                    const showAvatar = idx === 0 || activeMessages[idx - 1].sender_role !== msg.sender_role;

                    if (isSystem || isFormalLog) {
                        return (
                            <div key={msg.id} className="flex justify-center my-4">
                                <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs px-4 py-3 rounded-xl shadow-sm max-w-[80%] whitespace-pre-wrap font-mono">
                                    <div className="text-slate-500 font-bold mb-1 uppercase flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Official Record</div>
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
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md ${isMe ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : isAi ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-slate-600 to-slate-800'}`}>
                                            {isAi ? <Cpu className="w-4 h-4" /> : msg.sender_role[0]}
                                        </div>
                                    ) : <div className="w-8 h-8"></div>}
                                </div>
                                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    {showAvatar && (
                                        <span className="text-[10px] font-bold text-slate-400 mb-1.5 px-1 uppercase tracking-wider">
                                            {msg.sender_role} <span className="font-normal opacity-50 ml-2">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </span>
                                    )}
                                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${isMe ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-sm'}`}>
                                        {msg.message}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {aiThinking && (
                    <div className="flex w-full justify-start">
                        <div className="flex max-w-[85%] gap-3 flex-row">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md bg-gradient-to-br from-purple-500 to-indigo-600 shrink-0"><Cpu className="w-4 h-4 animate-pulse" /></div>
                            <div className="flex flex-col items-start">
                                <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tl-sm">
                                    <div className="flex gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce"></div>
                                        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
                {userRole === 'Finance' && chatMode === 'human' && (
                    <div className="flex border-b border-slate-100 dark:border-slate-800">
                        <button type="button" onClick={() => setIsFormMode(false)} className={`flex-1 py-2 text-xs font-bold ${!isFormMode ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>💬 Quick Chat</button>
                        <button type="button" onClick={() => setIsFormMode(true)} className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1 ${isFormMode ? 'text-red-600 border-b-2 border-red-600' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><FileSpreadsheet className="w-3 h-3" /> Formal Dispute Form</button>
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
                        <button type="button" onClick={submitStructuredForm} disabled={!formAmount} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg transition-colors shadow-md disabled:opacity-50">Log Formal Dispute</button>
                    </div>
                ) : (
                    <>
                        {userRole === 'Finance' && chatMode === 'human' && disputeStatus !== 'Resolved' && (
                            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-2">
                                <span className="text-[10px] font-black uppercase text-slate-500 w-full mb-1 flex items-center gap-1"><FileSignature className="w-3 h-3" /> Formal Actions</span>
                                <button type="button" onClick={() => handleFormalAction('Issue Credit Note')} className="flex-1 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-md transition-all shadow-sm">Credit Note</button>
                                <button type="button" onClick={() => handleFormalAction('Force Auto-Approve')} className="flex-1 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-md transition-all shadow-sm">Force Approve</button>
                                <button type="button" onClick={() => handleFormalAction('Escalate to Procurement')} className="flex-1 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-red-500 text-red-600 dark:text-red-400 text-xs font-bold rounded-md transition-all shadow-sm">Escalate</button>
                            </div>
                        )}

                        {chatMode === 'human' && (
                            <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
                                {quickReplies.map((reply, i) => (
                                    <button type="button" key={i} onClick={() => sendMessage(reply)} className="whitespace-nowrap px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-medium transition-colors">
                                        {reply}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="p-4 pt-2">
                            <div className={`flex items-end gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border focus-within:ring-2 transition-all ${chatMode === 'ai' ? 'border-purple-200 dark:border-purple-900/50 focus-within:border-purple-500 focus-within:ring-purple-500/20' : 'border-slate-200 dark:border-slate-700 focus-within:border-emerald-500 focus-within:ring-emerald-500/20'}`}>
                                <button type="button" className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all" title="Attach file">
                                    <Paperclip className="w-5 h-5" />
                                </button>
                                <textarea
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    placeholder={chatMode === 'ai' ? "Ask AI about status..." : "Type official response..."}
                                    className="flex-1 max-h-32 min-h-[40px] py-2.5 px-2 bg-transparent border-none outline-none resize-none text-sm dark:text-white"
                                    rows="1"
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                                />
                                <button type="button" onClick={() => sendMessage(newMessage)} disabled={!newMessage.trim() || isSending || aiThinking} className={`p-3 text-white rounded-xl transition-all disabled:opacity-50 flex items-center justify-center shrink-0 shadow-md ${chatMode === 'ai' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                                    <Send className={`w-4 h-4 ${isSending ? 'animate-pulse' : 'translate-x-[-1px] translate-y-[1px]'}`} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}