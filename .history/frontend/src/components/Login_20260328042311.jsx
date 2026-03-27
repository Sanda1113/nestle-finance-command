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
        setLoading(true);
        setError('');
        setSuccessMsg('');

        try {
            if (isLoginView) {
                // Handle Login
                const res = await axios.post('https://nestle-finance-command-production.up.railway.app/api/auth/login', { email, password });
                if (res.data.success) {
                    onLogin(res.data.user);
                }
            } else {
                // Handle Registration
                const res = await axios.post('https://nestle-finance-command-production.up.railway.app/api/auth/register', {
                    email, password, role
                });
                if (res.data.success) {
                    setSuccessMsg('✅ Account created successfully! You can now log in.');
                    setIsLoginView(true); // Switch back to login view
                    setPassword(''); // Clear password for security
                }
            }
        } catch (err) {
            if (isLoginView) {
                setError('❌ Invalid email or password.');
            } else {
                setError('❌ Registration failed. This email might already be in use.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 flex-col px-4">
            <div className="bg-slate-800 p-8 md:p-10 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 relative z-10">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-white">Nestle<span className="text-blue-500">Finance</span></h1>
                    <p className="text-slate-400 font-medium mt-2">
                        {isLoginView ? 'Secure Gateway' : 'Create New Account'}
                    </p>
                </div>

                {error && <div className="mb-6 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded-lg text-sm font-bold text-center">{error}</div>}
                {successMsg && <div className="mb-6 p-3 bg-emerald-900/50 border border-emerald-500 text-emerald-200 rounded-lg text-sm font-bold text-center">{successMsg}</div>}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    {/* Role Selector - Only visible during Registration */}
                    {!isLoginView && (
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Your Role</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setRole('supplier')}
                                    className={`py-3 text-sm font-bold rounded-xl border transition-all ${role === 'supplier' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                >
                                    🏢 Supplier
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRole('finance')}
                                    className={`py-3 text-sm font-bold rounded-xl border transition-all ${role === 'finance' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                >
                                    💼 Finance Team
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 mt-2 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-colors shadow-lg shadow-blue-900/20 disabled:bg-slate-600 disabled:text-slate-400"
                    >
                        {loading ? 'Processing...' : (isLoginView ? 'Secure Login' : 'Register Account')}
                    </button>
                </form>

                {/* Toggle View Button */}
                <div className="mt-8 text-center border-t border-slate-700 pt-6">
                    <p className="text-slate-400 text-sm">
                        {isLoginView ? "Don't have an account?" : "Already have an account?"}
                    </p>
                    <button
                        onClick={() => {
                            setIsLoginView(!isLoginView);
                            setError('');
                            setSuccessMsg('');
                        }}
                        className="mt-2 text-blue-400 hover:text-blue-300 font-bold transition-colors"
                    >
                        {isLoginView ? "Register Here" : "Back to Login"}
                    </button>
                </div>
            </div>
        </div>
    );
}