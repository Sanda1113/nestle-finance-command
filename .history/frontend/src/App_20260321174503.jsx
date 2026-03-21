import { useState } from 'react';
import Login from './components/Login';
import SupplierDashboard from './components/SupplierDashboard';
import Portal from './components/Portal';

function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  if (user.role === 'supplier') {
    return <SupplierDashboard user={user} onLogout={() => setUser(null)} />;
  }

  if (user.role === 'finance') {
    return <Portal user={user} onLogout={() => setUser(null)} />;
  }

  return null;
}

export default App;