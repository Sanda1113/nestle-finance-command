const fs = require('fs');

function patchFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    // Replace Dashboard Poll Intervals in Portal.jsx (ProcurementPortal, FinancePortal, AnalyticsPortal)
    // Actually in Portal.jsx, ProcurementPortal and FinancePortal might also have setIntervals? Let's check:
    content = content.replace(/const interval = setInterval\(\(\) => fetchData\(false\), DASHBOARD_POLL_INTERVAL_MS\);\n\s+return \(\) => clearInterval\(interval\);/g, 
        `// Replaced polling with Supabase Realtime
        const channel = supabase.channel('dashboard_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reconciliations' }, () => {
                fetchData(false);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'boqs' }, () => {
                fetchData(false);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => {
                fetchData(false);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };`
    );

    fs.writeFileSync(filepath, content, 'utf8');
}

patchFile('frontend/src/components/Portal.jsx');
console.log('Patched Portal.jsx for realtime');

function patchSupplier(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    // In SupplierDashboard, fetchDashboardData is called on mount. We should add a real-time subscription.
    const useEffectMountTarget = `useEffect(() => {
        fetchDashboardData();
        return () => {
            isMountedRef.current = false;
        };
    }, []);`;

    const useEffectMountReplacement = `useEffect(() => {
        fetchDashboardData();
        
        // Supabase Realtime Subscription for UI Sync
        const channel = supabase.channel('supplier_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reconciliations' }, () => fetchDashboardData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => fetchDashboardData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'boqs' }, () => fetchDashboardData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payout_schedule' }, () => fetchDashboardData())
            .subscribe();

        return () => {
            isMountedRef.current = false;
            supabase.removeChannel(channel);
        };
    }, []);`;

    if (content.includes(useEffectMountTarget)) {
        content = content.replace(useEffectMountTarget, useEffectMountReplacement);
        fs.writeFileSync(filepath, content, 'utf8');
        console.log('Patched SupplierDashboard.jsx for realtime');
    }
}

patchSupplier('frontend/src/components/SupplierDashboard.jsx');
