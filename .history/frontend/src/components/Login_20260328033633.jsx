import { useState } from 'react';
import axios from 'axios';

export default function Login({ onLogin }) {
    const [isLoginView, setIsLoginView] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('supplier');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError(''); setSuccessMsg('');

        try {
            if (isLoginView) {
                const res = await axios.post('https://nestle-finance-command-production.up.railway.app/api/auth/login', { email, password });
                if (res.data.success) onLogin(res.data.user);
            } else {
                const res = await axios.post('https://nestle-finance-command-production.up.railway.app/api/auth/register', { email, password, role });
                if (res.data.success) {
                    setSuccessMsg('✅ Account created successfully! Please log in.');
                    setIsLoginView(true); setPassword('');
                }
            }
        } catch (err) {
            setError(isLoginView ? '❌ Invalid email or password.' : '❌ Registration failed. Email might be in use.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
            <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl shadow-blue-900/20 w-full max-w-sm border border-slate-700/50">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-extrabold text-white tracking-tight">Nestle<span className="text-blue-500">Finance</span></h1>
                    <p className="text-slate-400 text-sm font-medium mt-1">
                        {isLoginView ? 'Enterprise Access Gateway' : 'Partner Registration'}
                    </p>
                </div>

                {error && <div className="mb-5 p-2.5 bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg text-xs font-semibold text-center">{error}</div>}
                {successMsg && <div className="mb-5 p-2.5 bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 rounded-lg text-xs font-semibold text-center">{successMsg}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
                        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" />
                    </div>

                    {!isLoginView && (
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Select Role</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => setRole('supplier')} className={`py-2 text-xs font-bold rounded-lg border transition-all ${role === 'supplier' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>🏢 Supplier</button>
                                <button type="button" onClick={() => setRole('finance')} className={`py-2 text-xs font-bold rounded-lg border transition-all ${role === 'finance' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>💼 Finance</button>
                            </div>
                        </div>
                    )}

                    <button type="submit" disabled={loading}
                        className="w-full py-2.5 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? 'Authenticating...' : (isLoginView ? 'Secure Login' : 'Create Account')}
                    </button>
                </form>

                <div className="mt-6 text-center border-t border-slate-700/50 pt-5">
                    <p className="text-slate-400 text-xs">
                        {isLoginView ? "New partner?" : "Already registered?"}
                        <button onClick={() => { setIsLoginView(!isLoginView); setError(''); setSuccessMsg(''); }} className="ml-2 text-blue-400 hover:text-blue-300 font-bold transition-colors">
                            {isLoginView ? "Register Here" : "Login Here"}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}