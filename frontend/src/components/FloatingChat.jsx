import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import LiveChat from './LiveChat';

export default function FloatingChat({ userEmail, userRole }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
            {isOpen && (
                <div className="relative mb-4 w-[380px] sm:w-[420px] bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl overflow-hidden flex flex-col shadow-blue-900/20 shadow-[0_0_50px_rgba(37,99,235,0.3)] animate-in slide-in-from-bottom-5 duration-300" style={{ height: '520px' }}>
                    <div className="bg-slate-800 p-3 flex justify-between items-center border-b border-slate-700 shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
                            <span className="font-bold text-slate-100 text-sm tracking-wide">AI Chat</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600 rounded-full p-1.5 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <LiveChat userEmail={userEmail} userRole={userRole} />
                    </div>
                </div>
            )}
            
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-300 
                ${isOpen 
                    ? 'bg-slate-700 rotate-90 scale-90' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:scale-110 hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] ring-4 ring-blue-500/30'
                }`}
                title={isOpen ? "Close Chat" : "Open Live Chat"}
            >
                {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-7 h-7" />}
                
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse"></span>
                )}
            </button>
        </div>
    );
}

