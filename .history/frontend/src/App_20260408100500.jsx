import { useState } from 'react';
import Login from './components/Login';
import SupplierDashboard from './components/SupplierDashboard';
import Portal from './components/Portal';
import WarehousePortal from './components/WarehousePortal';

function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  // 1. Route for Suppliers
  if (user.role === 'supplier') {
    return <SupplierDashboard user={user} onLogout={() => setUser(null)} />;
  }

  // 2. Route for Logistics / Warehouse Team
  if (user.role === 'warehouse') {
    return <WarehousePortal user={user} onLogout={() => setUser(null)} />;
  }

  // 3. Route for Finance / Admins
  if (user.role === 'finance' || user.role === 'admin') {
    return <Portal user={user} onLogout={() => setUser(null)} />;
  }

  // Fallback if an unknown role logs in
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-sans">
      <div className="text-center p-8 bg-slate-800 rounded-xl border border-slate-700 shadow-xl">
        <h2 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h2>
        <p className="text-slate-400 mb-6">Your role ({user.role}) is not recognized by the system.</p>
        <button onClick={() => setUser(null)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors">
          Return to Login
        </button>
      </div>
    </div>
  );
}

export default App;