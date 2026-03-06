import React, { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import {
    LayoutDashboard, Map, Leaf, BarChart2, Bug, TrendingUp,
    MessageCircle, FileText, Sprout, Menu, X
} from 'lucide-react'

const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/map', icon: Map, label: 'Farm Map' },
    { to: '/disease', icon: Leaf, label: 'Disease Detection' },
    { to: '/history', icon: BarChart2, label: 'Crop History' },
    { to: '/pest-risk', icon: Bug, label: 'Pest Risk' },
    { to: '/yield', icon: TrendingUp, label: 'Yield Prediction' },
    { to: '/assistant', icon: MessageCircle, label: 'AI Assistant' },
    { to: '/report', icon: FileText, label: 'Farm Report' },
]

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false)

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    onClick={() => setSidebarOpen(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }}
                />
            )}

            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                {/* Logo */}
                <div style={{ padding: '24px 16px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 12,
                            background: 'linear-gradient(135deg, #22c55e, #166534)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 20px rgba(34,197,94,0.3)'
                        }}>
                            <Sprout size={20} color="white" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>AgriSense</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Precision Agriculture</div>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav style={{ padding: '12px 0', flex: 1 }}>
                    {navItems.map(({ to, icon: Icon, label }) => (
                        <NavLink key={to} to={to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <Icon size={18} />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Bottom tag */}
                <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                        🛰️ Powered by Planet Labs + OpenWeather
                    </div>
                </div>
            </aside>

            {/* Main */}
            <main className="main-content" style={{ flex: 1 }}>
                {/* Mobile topbar */}
                <div style={{
                    padding: '12px 16px',
                    background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
                    display: 'none', alignItems: 'center', justifyContent: 'space-between',
                    position: 'sticky', top: 0, zIndex: 100
                }} className="mobile-topbar">
                    <button onClick={() => setSidebarOpen(!sidebarOpen)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
                        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                    <div style={{ fontWeight: 700, color: 'var(--accent)' }}>AgriSense</div>
                </div>

                <div style={{ padding: '32px', maxWidth: 1400 }}>
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
