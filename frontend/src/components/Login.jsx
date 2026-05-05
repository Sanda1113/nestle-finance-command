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
            // 🔥 HARDCODED DEV-LOGIN BYPASS (Localhost Testing)
            const devAccounts = {
                'nestlesupplier1@gmail.com': { password: '123', role: 'supplier', name: 'Nestlé Supplier 1' },
                'employee1@nestle.lk': { password: '123', role: 'finance', name: 'Finance Admin 1' },
                'dock1@nestle.lk': { password: '123', role: 'warehouse', name: 'Dock Inspector 1' },
                'manager@nestle.lk': { password: '123', role: 'procurement', name: 'Procurement Manager' }
            };

            const devUser = devAccounts[email.toLowerCase()];
            if (devUser && password === devUser.password) {
                console.log("🛠️ Dev Bypass Login Success:", devUser.role);
                onLogin({ email: email.toLowerCase(), role: devUser.role, name: devUser.name });
                return;
            }

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
            // 🔥 NEW: Extract the REAL error from the backend/Supabase
            const realError = err.response?.data?.details || err.response?.data?.error || err.message;
            console.error("Full Backend Error:", err.response?.data);

            let displayError = '❌ Invalid email or password.';
            
            if (err.response?.status >= 500) {
                displayError = '❌ Server Error: Database or backend is unreachable (500).';
            } else if (err.response?.status !== 401 && err.response?.data?.error) {
                displayError = `❌ ${err.response.data.error}`;
            }

            setError(isLoginView
                ? displayError
                : `❌ Registration failed: ${typeof realError === 'string' && realError.includes('<html') ? 'Server is down.' : realError}`
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden px-4 font-sans selection:bg-blue-500/30">

            {/* 🌌 ANIMATED BACKGROUND ORBS */}
            <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-600/20 blur-[120px] mix-blend-screen animate-blob"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-indigo-600/20 blur-[120px] mix-blend-screen animate-blob animation-delay-2000"></div>
            <div className="absolute top-[20%] left-[20%] w-[30vw] h-[30vw] rounded-full bg-purple-600/20 blur-[100px] mix-blend-screen animate-blob animation-delay-4000"></div>

            {/* 🔲 SUBTLE ANIMATED GRID PATTERN */}
            <div className="absolute inset-0 opacity-[0.04]" style={{
                backgroundImage: 'linear-gradient(rgba(148,163,184,1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px)',
                backgroundSize: '40px 40px'
            }}></div>

            {/* 🎛️ GLASSMORPHISM CARD */}
            <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
                <div className="bg-slate-900/80 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl border border-slate-700/50 shadow-blue-900/30">
                    {/* LOGO & HEADER */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-xl shadow-blue-500/20 mb-5 p-3 border-4 border-slate-800">
                            <img src="/nestle-logo.svg" alt="Nestle" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-3xl font-extrabold text-white tracking-tight">
                            Nestle<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Finance</span>
                        </h1>
                        <p className="text-slate-400 text-sm font-medium mt-2">
                            {isLoginView ? 'Enterprise Access Gateway' : 'Partner Registration Portal'}
                        </p>
                    </div>

                    {/* ALERTS */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-sm font-semibold text-center animate-shake">
                            {error}
                        </div>
                    )}
                    {successMsg && (
                        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-sm font-semibold text-center animate-fade-in">
                            {successMsg}
                        </div>
                    )}

                    {/* FORM */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 group-focus-within:text-blue-400 transition-colors">
                                Email Address
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-600 shadow-inner"
                                placeholder="you@company.com"
                            />
                        </div>

                        <div className="group">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 group-focus-within:text-blue-400 transition-colors">
                                Password
                            </label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-600 shadow-inner"
                                placeholder="••••••••"
                            />
                        </div>

                        {/* SLIDING ROLE SELECTOR (Only visible during Registration) */}
                        <div className={`overflow-hidden transition-all duration-500 ${isLoginView ? 'max-h-0 opacity-0' : 'max-h-40 opacity-100'}`}>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                                Account Type
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setRole('supplier')}
                                    className={`py-3 text-sm font-bold rounded-2xl transition-all ${role === 'supplier' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50' : 'bg-slate-800/40 text-slate-400 border border-transparent hover:border-slate-700'}`}
                                >
                                    🏢 Supplier
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRole('finance')}
                                    className={`py-3 text-sm font-bold rounded-2xl transition-all ${role === 'finance' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/50' : 'bg-slate-800/40 text-slate-400 border border-transparent hover:border-slate-700'}`}
                                >
                                    💼 Finance
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRole('warehouse')}
                                    className={`py-3 text-sm font-bold rounded-2xl transition-all ${role === 'warehouse' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/50' : 'bg-slate-800/40 text-slate-400 border border-transparent hover:border-slate-700'}`}
                                >
                                    📦 Dock
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 active:scale-[0.98] text-base"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

                    <div className="mt-8 text-center border-t border-slate-800 pt-6">
                        <p className="text-slate-500 text-sm">
                            {isLoginView ? "Don't have an account?" : "Already have an account?"}
                            <button
                                onClick={() => {
                                    setIsLoginView(!isLoginView);
                                    setError('');
                                    setSuccessMsg('');
                                }}
                                className="ml-1.5 text-blue-400 hover:text-blue-300 font-bold transition-colors hover:underline underline-offset-2 decoration-blue-500/50"
                            >
                                {isLoginView ? 'Register now' : 'Sign in'}
                            </button>
                        </p>
                    </div>
                </div>

                {/* FOOTER */}
                <p className="text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-8">
                    © {new Date().getFullYear()} Nestlé Command Center · Secure Enterprise Platform
                </p>
            </div>

            {/* 🎨 CUSTOM CSS FOR ANIMATIONS */}
            <style>{`
                @keyframes blob {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                .animate-blob {
                    animation: blob 10s infinite alternate;
                }
                .animation-delay-2000 {
                    animation-delay: 2s;
                }
                .animation-delay-4000 {
                    animation-delay: 4s;
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.6s ease-out forwards;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fadeIn 0.4s ease-out forwards;
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    50% { transform: translateX(4px); }
                    75% { transform: translateX(-4px); }
                }
                .animate-shake {
                    animation: shake 0.3s ease-in-out forwards;
                }
            `}</style>
        </div>
    );
}