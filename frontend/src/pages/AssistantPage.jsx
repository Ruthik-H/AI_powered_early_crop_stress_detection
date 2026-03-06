import React, { useState, useEffect, useRef } from 'react'
import { chatAPI, farmsAPI } from '../api'
import { Send, Bot, User, Sprout } from 'lucide-react'

const SUGGESTIONS = [
    'My tomatoes have yellow spots',
    'When should I irrigate my rice?',
    'How to treat late blight?',
    'What is NDVI?',
    'How to prevent aphids?',
    'When to harvest wheat?',
]

export default function AssistantPage() {
    const [messages, setMessages] = useState([
        { role: 'bot', text: "👋 Hello! I'm your AI Agronomy Assistant. I can help you with crop diseases, irrigation scheduling, fertilizer recommendations, pest control, and satellite data interpretation. How can I help your farm today?" }
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [farms, setFarms] = useState([])
    const [selectedFarm, setSelectedFarm] = useState(null)
    const bottomRef = useRef()

    useEffect(() => {
        farmsAPI.list().then(r => { setFarms(r.data); if (r.data[0]) setSelectedFarm(r.data[0].id) }).catch(() => { })
    }, [])

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

    const sendMessage = async (text = input) => {
        if (!text.trim() || loading) return
        const userMsg = text.trim()
        setInput('')
        setMessages(prev => [...prev, { role: 'user', text: userMsg }])
        setLoading(true)
        try {
            const { data } = await chatAPI.message(userMsg, selectedFarm)
            setMessages(prev => [...prev, { role: 'bot', text: data.response }])
        } catch {
            setMessages(prev => [...prev, { role: 'bot', text: '⚠️ Sorry, I had trouble processing that. Please try again.' }])
        } finally { setLoading(false) }
    }

    return (
        <div className="animate-fade-in" style={{ height: 'calc(100vh - 130px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>🤖 AI Agronomy Assistant</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Expert crop advice powered by agricultural AI</p>
                </div>
                {farms.length > 0 && (
                    <select className="input" style={{ width: 'auto' }} value={selectedFarm || ''} onChange={e => setSelectedFarm(+e.target.value)}>
                        <option value="">No farm selected</option>
                        {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                )}
            </div>

            {/* Suggestions */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => sendMessage(s)}
                        style={{ padding: '6px 12px', fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 100, color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit' }}>
                        {s}
                    </button>
                ))}
            </div>

            {/* Chat */}
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {messages.map((msg, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 10, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                            {msg.role === 'bot' && (
                                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #22c55e, #166534)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Sprout size={16} color="white" />
                                </div>
                            )}
                            <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-bot'}>
                                {msg.text}
                            </div>
                            {msg.role === 'user' && (
                                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <User size={16} color="var(--text-muted)" />
                                </div>
                            )}
                        </div>
                    ))}
                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #22c55e, #166534)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Sprout size={16} color="white" />
                            </div>
                            <div className="chat-bubble-bot" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-green 1s infinite' }} />
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-green 1s infinite 0.2s' }} />
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-green 1s infinite 0.4s' }} />
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
                    <input
                        className="input"
                        placeholder="Ask about crop diseases, irrigation, pest control..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        disabled={loading}
                    />
                    <button className="btn-primary" style={{ padding: '10px 16px', flexShrink: 0 }} onClick={() => sendMessage()} disabled={loading || !input.trim()}>
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    )
}
