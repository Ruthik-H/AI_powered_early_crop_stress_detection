import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Sprout, Mail, Lock, User } from 'lucide-react'

export default function Register() {
    const [form, setForm] = useState({ email: '', full_name: '', password: '' })
    const [loading, setLoading] = useState(false)
    const { login } = useAuth()
    const navigate = useNavigate()

    const submit = async e => {
        e.preventDefault()
        if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
        setLoading(true)
        try {
            const { data } = await authAPI.register(form)
            login(data.user, data.access_token)
            toast.success('Account created! Welcome to AgriSense 🌱')
            navigate('/dashboard')
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Registration failed')
        } finally { setLoading(false) }
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'radial-gradient(ellipse at 70% 50%, rgba(34,197,94,0.08) 0%, transparent 60%), var(--bg-primary)',
            padding: 20
        }}>
            <div style={{ width: '100%', maxWidth: 420 }}>
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: 20,
                        background: 'linear-gradient(135deg, #22c55e, #166534)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px', boxShadow: '0 0 40px rgba(34,197,94,0.3)'
                    }}>
                        <Sprout size={30} color="white" />
                    </div>
                    <h1 style={{ fontSize: 28, fontWeight: 800 }}>Join AgriSense</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Start monitoring your farm with AI & satellite</p>
                </div>

                <div className="glass-card" style={{ padding: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Create Account</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>Join thousands of smart farmers</p>

                    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label className="label">Full Name</label>
                            <div style={{ position: 'relative' }}>
                                <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input className="input" style={{ paddingLeft: 38 }} type="text" placeholder="John Farmer"
                                    value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required />
                            </div>
                        </div>
                        <div>
                            <label className="label">Email</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input className="input" style={{ paddingLeft: 38 }} type="email" placeholder="farmer@example.com"
                                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                            </div>
                        </div>
                        <div>
                            <label className="label">Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input className="input" style={{ paddingLeft: 38 }} type="password" placeholder="Min. 6 characters"
                                    value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                            </div>
                        </div>
                        <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '12px 20px' }} disabled={loading}>
                            {loading ? '⟳ Creating...' : 'Create Account →'}
                        </button>
                    </form>
                    <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
                        Already have an account?{' '}
                        <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
