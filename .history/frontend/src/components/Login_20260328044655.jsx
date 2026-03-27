import { useState } from 'react';
import axios from 'axios';

export default function Login({ onLogin }) {
    const [isLoginView, setIsLoginView] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('supplier'); // Default role for registration
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
        <>
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
                {/* Animated gradient background */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20 animate-gradient-xy"></div>

                {/* Subtle grid pattern */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cdefs%3E%3Cpattern id=\"grid\" width=\"60\" height=\"60\" patternUnits=\"userSpaceOnUse\"%3E%3Cpath d=\"M 60 0 L 0 0 0 60\" fill=\"none\" stroke=\"rgba(255,255,255,0.03)\" stroke-width=\"1\"/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\"100%25\" height=\"100%25\" fill=\"url(%23grid)\"/%3E%3C/svg%3E')] opacity-30"></div>

            {/* Card */}
            <div className="relative z-10 w-full max-w-md">
                <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-slate-700/50 transition-all duration-300 hover:shadow-blue-500/10">
                    {/* Logo and header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg mb-4">
                            <span className="text-3xl font-black text-white">N</span>
                        </div>
                        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white to-blue-400 bg-clip-text text-transparent">
                            Nestle<span className="text-blue-500">Finance</span>
                        </h1>
                        <p className="text-slate-400 text-sm font-medium mt-2">
                            {isLoginView ? 'Secure Access Portal' : 'Join the Nestle Network'}
                        </p>
                    </div>

                    {/* Alert messages */}
                    {error && (
                        <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-semibold text-center animate-shake">
                            {error}
                        </div>
                    )}
                    {successMsg && (
                        <div className="mb-5 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-semibold text-center">
                            {successMsg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                                    </svg>
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                                    placeholder="you@company.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6-4h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2zm10-4V6a4 4 0 00-8 0v4" />
                                    </svg>
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {!isLoginView && (
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    Account Type
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setRole('supplier')}
                                        className={`py-2.5 text-sm font-bold rounded-xl border transition-all duration-200 ${role === 'supplier'
                                            ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-700/50'
                                            }`}
                                    >
                                        🏢 Supplier
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRole('finance')}
                                        className={`py-2.5 text-sm font-bold rounded-xl border transition-all duration-200 ${role === 'finance'
                                            ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-700/50'
                                            }`}
                                    >
                                        💼 Finance
                                    </button>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold rounded-xl transition-all duration-200 shadow-lg shadow-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Authenticating...
                                </>
                            ) : (
                                isLoginView ? 'Secure Login' : 'Create Account'
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center border-t border-slate-700/50 pt-6">
                        <p className="text-slate-400 text-sm">
                            {isLoginView ? "Don't have an account?" : "Already have an account?"}
                            <button
                                onClick={() => {
                                    setIsLoginView(!isLoginView);
                                    setError('');
                                    setSuccessMsg('');
                                }}
                                className="ml-2 text-blue-400 hover:text-blue-300 font-bold transition-colors underline-offset-2 hover:underline"
                            >
                                {isLoginView ? 'Register now' : 'Sign in'}
                            </button>
                        </p>
                    </div>
                </div>

                {/* Footer note */}
                <p className="text-center text-slate-500 text-xs mt-6">
                    © {new Date().getFullYear()} Nestle Finance Command Center
                </p>
            </div>
        </div >

            {/* 🚀 FIXED: Swapped <style> to a standard React <style> block */ }
            < style > {`
                @keyframes gradient-xy {
                    0%, 100% { transform: translate(0%, 0%); }
                    50% { transform: translate(10%, 10%); }
                }
                .animate-gradient-xy {
                    animation: gradient-xy 15s ease infinite;
                    background-size: 400% 400%;
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
                    20%, 40%, 60%, 80% { transform: translateX(2px); }
                }
                .animate-shake {
                    animation: shake 0.4s ease-in-out;
                }
            `}</style >
        </>
    );
}