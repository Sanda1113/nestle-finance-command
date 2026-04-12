import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Send, X, MessageCircle, Users, ChevronLeft } from 'lucide-react';

const API = 'https://nestle-finance-command-production.up.railway.app/api/sprint2';

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
    const [selectedRecipient, setSelectedRecipient] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [unread, setUnread] = useState({});
    const messagesEndRef = useRef(null);
    const pollRef = useRef(null);

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

    // ── Recipient selection screen ───────────────────────────────────────────
    if (!selectedRecipient) {
        return (
            <div className="flex flex-col h-full bg-slate-900 text-white">
                <div className="px-4 py-3 border-b border-slate-700 bg-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Live Chat</p>
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
