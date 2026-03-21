import { useState } from 'react';
import axios from 'axios';

export default function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [setupMessage, setSetupMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSetupMessage('');

        try {
            const res = await axios.post('https://nestle-finance-command-production.up.railway.app/api/auth/login', { email, password });
            if (res.data.success) {
                onLogin(res.data.user);
            }
        } catch (err) {
            setError('Invalid email or password.');
        } finally {
            setLoading(false);
        }
    };

    // 🚀 TEMPORARY SETUP FUNCTION
    const setupTestAccounts = async () => {
        setLoading(true);
        setError('');
        try {
            await axios.post('https://nestle-finance-command-production.up.railway.app/api/auth/register', {
                email: 'admin@nestle.com', password: 'password123', role: 'finance'
            });
            await axios.post('https://nestle-finance-command-production.up.railway.app/api/auth/register', {
                email: 'vendor@test.com', password: 'password123', role: 'supplier'
            });
            setSetupMessage('✅ Test accounts created successfully! You can now log in.');
        } catch (err) {
            setError('❌ Setup failed. Did you run the SQL command in Supabase to create the app_users table?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 flex-col">
            <div className="bg-slate-800 p-10 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 relative z-10">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-white">Nestle<span className="text-blue-500">Finance</span></h1>
                    <p className="text-slate-400 font-medium mt-2">Secure Gateway</p>
                </div>

                {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded-lg text-sm font-bold text-center">{error}</div>}
                {setupMessage && <div className="mb-4 p-3 bg-emerald-900/50 border border-emerald-500 text-emerald-200 rounded-lg text-sm font-bold text-center">{setupMessage}</div>}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
                        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500" />
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-colors shadow-lg shadow-blue-900/20">
                        {loading ? 'Authenticating...' : 'Secure Login'}
                    </button>
                </form>
            </div>

            {/* Temporary Setup Button */}
            <div className="mt-8 text-center">
                <p className="text-slate-500 text-xs mb-3 uppercase tracking-widest font-bold">Developer Tools</p>
                <button
                    onClick={setupTestAccounts}
                    disabled={loading}
                    className="px-6 py-2 bg-emerald-600/20 text-emerald-500 border border-emerald-600/50 hover:bg-emerald-600 hover:text-white rounded-lg text-sm font-bold transition-all"
                >
                    🔧 Auto-Create Test Accounts
                </button>
            </div>
        </div>
    );
}