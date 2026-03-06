import React, { useState, useEffect } from 'react'
import { farmsAPI, reportAPI } from '../api'
import { FileText, Activity, Droplets, AlertTriangle, Thermometer, CheckCircle, XCircle } from 'lucide-react'

export default function ReportPage() {
    const [farms, setFarms] = useState([])
    const [selectedFarm, setSelectedFarm] = useState(null)
    const [report, setReport] = useState(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        farmsAPI.list().then(r => { setFarms(r.data); if (r.data[0]) { setSelectedFarm(r.data[0]); loadReport(r.data[0].id) } }).catch(() => { })
    }, [])

    const loadReport = id => {
        setLoading(true)
        reportAPI.get(id).then(r => setReport(r.data)).catch(() => setReport(null)).finally(() => setLoading(false))
    }

    const onFarmChange = e => {
        const f = farms.find(f => f.id === +e.target.value)
        setSelectedFarm(f); if (f) loadReport(f.id)
    }

    const scoreColor = s => s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : s >= 40 ? '#f97316' : '#ef4444'

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>📋 Farm Health Report</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Comprehensive AI-generated farm health analysis combining all data sources</p>
                </div>
                {farms.length > 0 && (
                    <select className="input" style={{ width: 'auto' }} value={selectedFarm?.id || ''} onChange={onFarmChange}>
                        {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                )}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Generating report...</div>
            ) : !report ? (
                <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
                    <FileText size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <h3 style={{ fontWeight: 700 }}>No report data yet</h3>
                    <p style={{ color: 'var(--text-muted)' }}>Create a farm and run a satellite scan to generate your first report</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Header report card */}
                    <div className="glass-card" style={{ padding: 32, background: `linear-gradient(135deg, rgba(${report.overall_health_score >= 60 ? '34,197,94' : '239,68,68'},0.08), transparent)` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                            <div>
                                <h2 style={{ fontSize: 22, fontWeight: 800 }}>{report.farm_name}</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{report.crop_type} · {report.area_hectares} ha · Generated {new Date(report.generated_at).toLocaleString()}</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 56, fontWeight: 900, color: scoreColor(report.overall_health_score), lineHeight: 1 }}>
                                    {report.overall_health_score}
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>/ 100 — {report.overall_status}</div>
                                <div className="progress-bar" style={{ width: 120, margin: '8px auto 0' }}>
                                    <div className="progress-fill" style={{ width: `${report.overall_health_score}%`, background: `linear-gradient(90deg, ${scoreColor(report.overall_health_score)}, ${scoreColor(report.overall_health_score)}99)` }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detail cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
                        {/* NDVI */}
                        <div className="card" style={{ padding: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                <Activity size={20} color="#22c55e" />
                                <h3 style={{ fontWeight: 700 }}>Vegetation (NDVI)</h3>
                            </div>
                            <div className="ndvi-bar" style={{ marginBottom: 12 }} />
                            {[['Mean', report.ndvi?.mean?.toFixed(4), '#22c55e'], ['Min', report.ndvi?.min?.toFixed(4), '#ef4444'], ['Max', report.ndvi?.max?.toFixed(4), '#22c55e']].map(([l, v, c]) => (
                                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{l}</span>
                                    <span style={{ fontWeight: 700, color: c }}>{v || '—'}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 12 }}>
                                <span className={`badge badge-${report.ndvi?.health_status === 'healthy' ? 'healthy' : 'moderate'}`}>
                                    {report.ndvi?.health_status?.toUpperCase() || 'UNKNOWN'}
                                </span>
                            </div>
                        </div>

                        {/* NDMI / Irrigation */}
                        <div className="card" style={{ padding: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                <Droplets size={20} color="#3b82f6" />
                                <h3 style={{ fontWeight: 700 }}>Moisture (NDMI)</h3>
                            </div>
                            <div style={{ fontSize: 36, fontWeight: 800, color: '#3b82f6', marginBottom: 8 }}>
                                {report.ndmi?.mean?.toFixed(4) || '—'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 10, marginTop: 12, background: report.ndmi?.irrigation_needed ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${report.ndmi?.irrigation_needed ? 'rgba(234,179,8,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
                                {report.ndmi?.irrigation_needed ? <XCircle size={18} color="#eab308" /> : <CheckCircle size={18} color="#22c55e" />}
                                <span style={{ fontWeight: 600, fontSize: 13 }}>{report.ndmi?.irrigation_needed ? 'Irrigation Recommended' : 'Moisture Adequate'}</span>
                            </div>
                        </div>

                        {/* Disease */}
                        <div className="card" style={{ padding: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                <AlertTriangle size={20} color={report.disease?.risk_level === 'High' ? '#ef4444' : '#22c55e'} />
                                <h3 style={{ fontWeight: 700 }}>Disease Risk</h3>
                            </div>
                            <div style={{ fontSize: 36, fontWeight: 800, color: report.disease?.risk_level === 'High' ? '#ef4444' : report.disease?.risk_level === 'Medium' ? '#eab308' : '#22c55e', marginBottom: 8 }}>
                                {report.disease?.risk_level || 'Low'}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                {report.disease?.latest_detection?.replace('___', ' - ').replace(/_/g, ' ') || 'No diseases detected'}
                            </div>
                            {report.disease?.confidence && (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                    Confidence: {(report.disease.confidence * 100).toFixed(1)}%
                                </div>
                            )}
                        </div>

                        {/* Weather */}
                        <div className="card" style={{ padding: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                <Thermometer size={20} color="#f97316" />
                                <h3 style={{ fontWeight: 700 }}>Weather Summary</h3>
                            </div>
                            {report.weather?.temperature !== null ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {[['Temperature', `${report.weather.temperature}°C`, '#ef4444'], ['Humidity', `${report.weather.humidity}%`, '#3b82f6'], ['Conditions', report.weather.description || '—', '#eab308']].map(([l, v, c]) => (
                                        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                            <span style={{ color: 'var(--text-muted)' }}>{l}</span>
                                            <span style={{ fontWeight: 700, color: c }}>{v}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No weather data. Add location to farm.</p>}
                        </div>
                    </div>

                    {/* Recommendations */}
                    <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ fontWeight: 700, marginBottom: 16 }}>🤖 Recommended Actions</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                            {report.recommendations.map((rec, i) => (
                                <div key={i} style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 12, fontSize: 13, lineHeight: 1.6, borderLeft: '3px solid var(--accent)' }}>
                                    {rec}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
