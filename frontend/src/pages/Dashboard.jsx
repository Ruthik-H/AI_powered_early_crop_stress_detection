import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { farmsAPI, satelliteAPI, reportAPI } from '../api'
import toast from 'react-hot-toast'
import {
    Satellite, Activity, Droplets, AlertTriangle, TrendingUp,
    Map, Leaf, ChevronRight, RefreshCw, Plus
} from 'lucide-react'
import { Line } from 'react-chartjs-2'
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const HEALTH_COLORS = {
    healthy: 'var(--accent)',
    moderate: '#eab308',
    stressed: '#ef4444',
    critical: '#7f1d1d',
    unknown: 'var(--text-muted)',
}

export default function Dashboard() {
    const navigate = useNavigate()
    const [farms, setFarms] = useState([])
    const [selectedFarm, setSelectedFarm] = useState(null)
    const [report, setReport] = useState(null)
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(false)
    const [scanning, setScanning] = useState(false)

    useEffect(() => {
        farmsAPI.list().then(r => {
            setFarms(r.data)
            if (r.data.length > 0) setSelectedFarm(r.data[0])
        }).catch(() => { })
    }, [])

    useEffect(() => {
        if (!selectedFarm) return
        reportAPI.get(selectedFarm.id).then(r => setReport(r.data)).catch(() => setReport(null))
        satelliteAPI.getHistory(selectedFarm.id, 15).then(r => setHistory(r.data)).catch(() => { })
    }, [selectedFarm])

    const runScan = async () => {
        if (!selectedFarm) { toast.error('Please create a farm first'); return }
        setScanning(true)
        try {
            await satelliteAPI.fetchImagery({ farm_id: selectedFarm.id })
            toast.success('Satellite scan complete! 🛰️')
            const [rpt, hist] = await Promise.all([
                reportAPI.get(selectedFarm.id),
                satelliteAPI.getHistory(selectedFarm.id, 15)
            ])
            setReport(rpt.data)
            setHistory(hist.data)
        } catch { toast.error('Scan failed') } finally { setScanning(false) }
    }

    const ndviData = {
        labels: history.slice().reverse().map(h => new Date(h.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })),
        datasets: [
            {
                label: 'NDVI',
                data: history.slice().reverse().map(h => h.ndvi_mean),
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34,197,94,0.1)',
                fill: true, tension: 0.4, pointRadius: 4,
                pointBackgroundColor: '#22c55e',
            },
            {
                label: 'NDMI',
                data: history.slice().reverse().map(h => h.ndmi_mean),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.07)',
                fill: true, tension: 0.4, pointRadius: 4,
                pointBackgroundColor: '#3b82f6',
            },
        ],
    }

    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#86a98e', font: { size: 12 } } } },
        scales: {
            x: { ticks: { color: '#4d6b55' }, grid: { color: '#1e3323' } },
            y: { ticks: { color: '#4d6b55' }, grid: { color: '#1e3323' }, min: -0.2, max: 1 },
        },
    }

    const healthColor = HEALTH_COLORS[report?.ndvi?.health_status] || 'var(--text-muted)'
    const score = report?.overall_health_score || 0

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
                        Good morning, Farmer 🌱
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                        {new Date().toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {farms.length > 0 && (
                        <select className="input" style={{ width: 'auto', paddingRight: 32 }}
                            value={selectedFarm?.id || ''} onChange={e => setSelectedFarm(farms.find(f => f.id === +e.target.value))}>
                            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    )}
                    <button className="btn-secondary" onClick={() => navigate('/map')}>
                        <Plus size={16} /> New Farm
                    </button>
                    <button className="btn-primary" onClick={runScan} disabled={scanning || !selectedFarm}>
                        <Satellite size={16} className={scanning ? 'animate-spin' : ''} />
                        {scanning ? 'Scanning...' : 'Run Satellite Scan'}
                    </button>
                </div>
            </div>

            {farms.length === 0 ? (
                <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🛰️</div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>No farms yet</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Draw your farm boundary on the map to start monitoring with satellite imagery</p>
                    <button className="btn-primary" onClick={() => navigate('/map')}>
                        <Map size={16} /> Go to Farm Map
                    </button>
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 28 }}>
                        <div className="stat-card green">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Health Score</span>
                                <Activity size={18} color={healthColor} />
                            </div>
                            <div style={{ fontSize: 36, fontWeight: 800, color: healthColor }}>{score}<span style={{ fontSize: 16 }}>/100</span></div>
                            <div style={{ marginTop: 10 }}>
                                <div className="progress-bar"><div className="progress-fill" style={{ width: `${score}%`, background: `linear-gradient(90deg, ${healthColor}, ${healthColor}88)` }} /></div>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{report?.overall_status || 'No data'}</div>
                        </div>

                        <div className="stat-card green">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>NDVI Index</span>
                                <Satellite size={18} color="#22c55e" />
                            </div>
                            <div style={{ fontSize: 36, fontWeight: 800, color: '#22c55e' }}>
                                {report?.ndvi?.mean ? report.ndvi.mean.toFixed(3) : '—'}
                            </div>
                            <div className="ndvi-bar" style={{ marginTop: 12 }} />
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                                Range: {report?.ndvi?.min?.toFixed(2) || '—'} – {report?.ndvi?.max?.toFixed(2) || '—'}
                            </div>
                        </div>

                        <div className={`stat-card ${report?.ndmi?.irrigation_needed ? 'yellow' : 'blue'}`}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Moisture (NDMI)</span>
                                <Droplets size={18} color={report?.ndmi?.irrigation_needed ? '#eab308' : '#3b82f6'} />
                            </div>
                            <div style={{ fontSize: 36, fontWeight: 800, color: report?.ndmi?.irrigation_needed ? '#eab308' : '#3b82f6' }}>
                                {report?.ndmi?.mean ? report.ndmi.mean.toFixed(3) : '—'}
                            </div>
                            {report?.ndmi?.irrigation_needed && (
                                <div className="badge badge-moderate" style={{ marginTop: 12 }}>💧 Irrigation Needed</div>
                            )}
                        </div>

                        <div className={`stat-card ${report?.disease?.risk_level === 'High' ? 'red' : 'green'}`}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Disease Risk</span>
                                <AlertTriangle size={18} color={report?.disease?.risk_level === 'High' ? '#ef4444' : '#22c55e'} />
                            </div>
                            <div style={{ fontSize: 36, fontWeight: 800, color: report?.disease?.risk_level === 'High' ? '#ef4444' : '#22c55e' }}>
                                {report?.disease?.risk_level || 'Low'}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                                {report?.disease?.latest_detection?.replace?.('___', ' ').replace?.('_', ' ') || 'No detections'}
                            </div>
                        </div>
                    </div>

                    {/* Charts + Recommendations row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 24 }}>
                        {/* NDVI Chart */}
                        <div className="card" style={{ padding: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <h3 style={{ fontWeight: 700 }}>Vegetation Indices Over Time</h3>
                                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => navigate('/history')}>
                                    View Full History <ChevronRight size={14} />
                                </button>
                            </div>
                            {history.length > 0 ? (
                                <div style={{ height: 260 }}>
                                    <Line data={ndviData} options={chartOptions} />
                                </div>
                            ) : (
                                <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <Satellite size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                                        <p>Run a satellite scan to see NDVI trends</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Recommendations */}
                        <div className="card" style={{ padding: 24 }}>
                            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>🤖 AI Recommendations</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {(report?.recommendations || ['Run a satellite scan to get personalized recommendations for your farm.']).map((rec, i) => (
                                    <div key={i} style={{
                                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                        borderRadius: 10, padding: '12px 14px', fontSize: 13,
                                        borderLeft: '3px solid var(--accent)', lineHeight: 1.5
                                    }}>
                                        {rec}
                                    </div>
                                ))}
                            </div>
                            <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={() => navigate('/assistant')}>
                                <Leaf size={16} /> Ask AI Assistant
                            </button>
                        </div>
                    </div>

                    {/* Farm info + quick actions */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                        {[
                            { label: 'Farm Name', value: selectedFarm?.name, icon: '🌾' },
                            { label: 'Crop Type', value: selectedFarm?.crop_type, icon: '🌿' },
                            { label: 'Area', value: selectedFarm?.area_hectares ? `${selectedFarm.area_hectares} ha` : '—', icon: '📐' },
                            { label: 'Location', value: selectedFarm?.location_name || 'No location set', icon: '📍' },
                        ].map(({ label, value, icon }) => (
                            <div key={label} className="card" style={{ padding: 16 }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
                                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{icon} {value || '—'}</div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
