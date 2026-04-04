import { useState, useEffect } from 'react';
import axios from 'axios';

export default function DisputeChat({ referenceNumber, userEmail, userRole, onResubmit }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');

    const fetchMessages = async () => {
        try {
            const res = await axios.get(`https://nestle-finance-command-production.up.railway.app/api/sprint2/disputes/${referenceNumber}`);
            setMessages(res.data.data);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 3000); // Polling for real-time feel
        return () => clearInterval(interval);
    }, [referenceNumber]);

    const sendMessage = async () => {
        if (!newMessage.trim()) return;
        try {
            await axios.post('https://nestle-finance-command-production.up.railway.app/api/sprint2/disputes/send', {
                referenceNumber,
                senderEmail: userEmail,
                senderRole: userRole,
                message: newMessage
            });
            setNewMessage('');
            fetchMessages();
        } catch (err) { alert('Message failed'); }
    };

    return (
        <div className="flex flex-col h-[400px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-3 bg-slate-200 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 flex justify-between items-center">
                <h4 className="font-bold text-sm">💬 Comm Hub: {referenceNumber}</h4>
                {userRole === 'Supplier' && onResubmit && (
                    <button onClick={onResubmit} className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded shadow-sm">
                        🔄 Delete & Resubmit Docs
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? <p className="text-xs text-center text-slate-500">No messages yet. Start the conversation.</p> : null}
                {messages.map(msg => (
                    <div key={msg.id} className={`flex flex-col max-w-[80%] ${msg.sender_role === userRole ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                        <span className="text-[10px] text-slate-500 mb-0.5">{msg.sender_role} • {new Date(msg.created_at).toLocaleTimeString()}</span>
                        <div className={`p-2.5 rounded-lg text-sm ${msg.sender_role === userRole ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-200 dark:bg-slate-800 dark:text-slate-200 rounded-bl-none'}`}>
                            {msg.message}
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 text-sm rounded bg-slate-100 dark:bg-slate-800 border-none outline-none dark:text-white"
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button onClick={sendMessage} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded">Send</button>
            </div>
        </div>
    );
}