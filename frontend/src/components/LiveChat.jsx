import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Send, MessageCircle, Users, ChevronLeft, Bot, User } from 'lucide-react';

const API = 'https://nestle-finance-command-production.up.railway.app/api/sprint2';
const DEEPSEEK_API_KEY = 'sk-782521610545406686bfc54c208e922e';
const MAX_AI_HISTORY = 8;

// Returns a sorted, canonical channel name for a given pair of roles
function getChannel(roleA, roleB) {
    return `LIVECHAT-${[roleA, roleB].sort().join('-')}`;
}

// Map each role to the recipients it can message
const RECIPIENTS = {
    Supplier: ['Finance', 'Warehouse'],
    Finance: ['Supplier', 'Warehouse'],
    Warehouse: ['Supplier', 'Finance'],
};

const ROLE_COLORS = {
    Supplier: 'bg-blue-600',
    Finance: 'bg-emerald-600',
    Warehouse: 'bg-amber-600',
};

const ROLE_LABELS = {
    Supplier: '🏭 Supplier',
    Finance: '💼 Finance',
    Warehouse: '📦 Warehouse',
};

export default function LiveChat({ userEmail, userRole }) {
    const [chatTab, setChatTab] = useState('live'); // 'live' | 'ai'
    const [selectedRecipient, setSelectedRecipient] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [unread, setUnread] = useState({});
    const messagesEndRef = useRef(null);
    const pollRef = useRef(null);

    // AI chat state
    const [aiMessages, setAiMessages] = useState([{
        id: 'ai-welcome',
        role: 'assistant',
        content: `Hi! I'm the Nestlé AI Chat. I can answer questions about supply chain, purchase orders, invoices, payment terms, logistics, and more. How can I help you?`
    }]);
    const [aiInput, setAiInput] = useState('');
    const [aiThinking, setAiThinking] = useState(false);
    const aiEndRef = useRef(null);

    const recipients = RECIPIENTS[userRole] || [];

    // Compute the active channel
    const channel = selectedRecipient ? getChannel(userRole, selectedRecipient) : null;

    // Fetch messages for the active channel
    const fetchMessages = useCallback(async () => {
        if (!channel) return;
        try {
            const res = await axios.get(`${API}/livechat/${encodeURIComponent(channel)}`);
            setMessages(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch live chat messages:', err);
        }
    }, [channel]);

    // Poll for unread counts across all channels this portal participates in
    const fetchUnread = useCallback(async () => {
        const counts = {};
        for (const recipient of recipients) {
            const ch = getChannel(userRole, recipient);
            try {
                const res = await axios.get(`${API}/livechat/${encodeURIComponent(ch)}`);
                const msgs = res.data.data || [];
                // Count messages not from this role (i.e., messages from the other side)
                counts[recipient] = msgs.filter(m => m.sender_role !== userRole).length;
            } catch {
                counts[recipient] = 0;
            }
        }
        setUnread(counts);
    }, [recipients, userRole]);

    // Start/stop polling when recipient changes
    useEffect(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (channel) {
            fetchMessages();
            pollRef.current = setInterval(fetchMessages, 3000);
        } else {
            fetchUnread();
            pollRef.current = setInterval(fetchUnread, 5000);
        }
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [channel, fetchMessages, fetchUnread]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    // Scroll to bottom when AI messages change
    useEffect(() => {
        aiEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [aiMessages.length, aiThinking]);

    const sendAiMessage = async () => {
        const text = aiInput.trim();
        if (!text || aiThinking) return;
        const userMsg = { id: Date.now(), role: 'user', content: text };
        setAiMessages(prev => [...prev, userMsg]);
        setAiInput('');
        setAiThinking(true);
        try {
            const history = aiMessages.slice(-MAX_AI_HISTORY).map(m => ({ role: m.role, content: m.content }));
            const systemPrompt = `You are a knowledgeable, conversational AI assistant for Nestlé's supply chain platform, helping a ${userRole} team member. You can freely discuss topics like purchase orders, invoices, payment terms, logistics, reconciliation, warehouse operations, supplier management, and general business questions. Be helpful, natural, and thorough. Adapt your answers to what the user actually asks — do not default to scripted responses. If the question is outside your knowledge, say so honestly.`;
            const response = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: text }],
                    temperature: 0.8,
                    max_tokens: 512,
                    presence_penalty: 0.6,
                    frequency_penalty: 0.4,
                })
            });
            if (!response.ok) throw new Error('AI request failed');
            const data = await response.json();
            const aiReply = data.choices[0].message.content;
            setAiMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: aiReply }]);
        } catch (err) {
            console.error('AI Chat Error:', err);
            setAiMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: '⚠️ I\'m having trouble connecting right now. Please try again.' }]);
        } finally {
            setAiThinking(false);
        }
    };

    const handleAiKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAiMessage();
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !channel) return;
        setIsSending(true);
        try {
            await axios.post(`${API}/livechat/send`, {
                channel,
                senderEmail: userEmail,
                senderRole: userRole,
                recipientRole: selectedRecipient,
                message: newMessage.trim(),
            });
            setNewMessage('');
            fetchMessages();
        } catch (err) {
            console.error('Failed to send message:', err);
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleBack = () => {
        setSelectedRecipient(null);
        setMessages([]);
        fetchUnread();
    };

    const roleColor = ROLE_COLORS[userRole] || 'bg-blue-600';

    // ── AI Assistant screen ──────────────────────────────────────────────────
    if (chatTab === 'ai') {
        return (
            <div className="flex flex-col h-full bg-slate-900 text-white">
                {/* Tab bar */}
                <div className="flex border-b border-slate-700 bg-slate-800 shrink-0">
                    <button
                        onClick={() => setChatTab('live')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                    >
                        <Users className="w-3.5 h-3.5" />
                        Live Chat
                    </button>
                    <button
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-purple-400 border-b-2 border-purple-500"
                    >
                        <Bot className="w-3.5 h-3.5" />
                        AI Chat
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {aiMessages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                                    <Bot className="w-3.5 h-3.5 text-white" />
                                </div>
                            )}
                            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow text-sm leading-relaxed ${
                                msg.role === 'user'
                                    ? `${roleColor} text-white rounded-br-sm`
                                    : 'bg-slate-700 text-slate-100 rounded-bl-sm'
                            }`}>
                                {msg.content}
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center ml-2 flex-shrink-0 mt-1">
                                    <User className="w-3.5 h-3.5 text-white" />
                                </div>
                            )}
                        </div>
                    ))}
                    {aiThinking && (
                        <div className="flex justify-start">
                            <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                                <Bot className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div className="bg-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 text-slate-400 text-sm">
                                <span className="inline-flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={aiEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-slate-700 bg-slate-800 p-3 shrink-0">
                    <div className="flex gap-2 items-end">
                        <textarea
                            value={aiInput}
                            onChange={(e) => setAiInput(e.target.value)}
                            onKeyDown={handleAiKeyDown}
                            placeholder="Ask the AI anything…"
                            rows={1}
                            className="flex-1 bg-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-600"
                            style={{ minHeight: '40px', maxHeight: '100px' }}
                        />
                        <button
                            onClick={sendAiMessage}
                            disabled={aiThinking || !aiInput.trim()}
                            className="w-10 h-10 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
                            title="Send"
                        >
                            <Send className="w-4 h-4 text-white" />
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 text-center">Powered by DeepSeek AI · Press Enter to send</p>
                </div>
            </div>
        );
    }

    // ── Recipient selection screen ───────────────────────────────────────────
    if (!selectedRecipient) {
        return (
            <div className="flex flex-col h-full bg-slate-900 text-white">
                {/* Tab bar */}
                <div className="flex border-b border-slate-700 bg-slate-800 shrink-0">
                    <button
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-blue-400 border-b-2 border-blue-500"
                    >
                        <Users className="w-3.5 h-3.5" />
                        Live Chat
                    </button>
                    <button
                        onClick={() => setChatTab('ai')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                    >
                        <Bot className="w-3.5 h-3.5" />
                        AI Chat
                    </button>
                </div>
                <div className="px-4 py-3 border-b border-slate-700 bg-slate-800">
                    <p className="text-sm text-slate-300">Select who you want to message:</p>
                </div>
                <div className="flex-1 flex flex-col gap-3 p-4 justify-center">
                    {recipients.map((recipient) => {
                        const recipientColor = ROLE_COLORS[recipient] || 'bg-blue-600';
                        const msgCount = unread[recipient] || 0;
                        return (
                            <button
                                key={recipient}
                                onClick={() => setSelectedRecipient(recipient)}
                                className={`flex items-center gap-4 p-4 rounded-xl ${recipientColor} hover:opacity-90 active:scale-[0.98] transition-all shadow-lg`}
                            >
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                    <Users className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-bold text-white">{ROLE_LABELS[recipient] || recipient}</p>
                                    <p className="text-xs text-white/70">Send a message to the {recipient} team</p>
                                </div>
                                {msgCount > 0 && (
                                    <span className="bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                                        {msgCount > 9 ? '9+' : msgCount}
                                    </span>
                                )}
                                <MessageCircle className="w-5 h-5 text-white/70" />
                            </button>
                        );
                    })}
                </div>
                <p className="text-center text-xs text-slate-500 pb-3">
                    Logged in as <span className="text-slate-300 font-medium">{ROLE_LABELS[userRole] || userRole}</span>
                </p>
            </div>
        );
    }


    // ── Chat screen ───────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full bg-slate-900 text-white">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-800 flex items-center gap-3 shrink-0">
                <button
                    onClick={handleBack}
                    className="text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600 rounded-full p-1.5 transition-colors"
                    title="Back to recipient selection"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <div className={`w-8 h-8 rounded-full ${ROLE_COLORS[selectedRecipient] || 'bg-blue-600'} flex items-center justify-center`}>
                    <Users className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm truncate">{ROLE_LABELS[selectedRecipient] || selectedRecipient}</p>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Live Chat</p>
                </div>
                <button
                    onClick={() => setChatTab('ai')}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 text-xs font-semibold transition-colors"
                    title="Switch to AI Chat"
                >
                    <Bot className="w-3.5 h-3.5" />
                    AI Chat
                </button>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" title="Connected"></span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                        <MessageCircle className="w-10 h-10 mb-2 text-slate-600" />
                        <p className="text-sm">No messages yet.</p>
                        <p className="text-xs mt-1">Start the conversation below.</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isOwn = msg.sender_role === userRole;
                        return (
                            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow ${
                                    isOwn
                                        ? `${roleColor} text-white rounded-br-sm`
                                        : 'bg-slate-700 text-slate-100 rounded-bl-sm'
                                }`}>
                                    {!isOwn && (
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            {ROLE_LABELS[msg.sender_role] || msg.sender_role}
                                        </p>
                                    )}
                                    <p className="text-sm leading-relaxed break-words">{msg.message}</p>
                                    <p className={`text-[10px] mt-1 ${isOwn ? 'text-white/60 text-right' : 'text-slate-500'}`}>
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-700 bg-slate-800 p-3 shrink-0">
                <div className="flex gap-2 items-end">
                    <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`Message ${ROLE_LABELS[selectedRecipient] || selectedRecipient}…`}
                        rows={1}
                        className="flex-1 bg-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-600"
                        style={{ minHeight: '40px', maxHeight: '100px' }}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={isSending || !newMessage.trim()}
                        className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
                        title="Send"
                    >
                        <Send className="w-4 h-4 text-white" />
                    </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 text-center">Press Enter to send · Shift+Enter for new line</p>
            </div>
        </div>
    );
}
