import React, { useState, useEffect } from 'react'
import { farmsAPI, satelliteAPI } from '../api'
import { Line, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { BarChart2, Satellite, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

export default function HistoryPage() {
    const [farms, setFarms] = useState([])
    const [selectedFarm, setSelectedFarm] = useState(null)
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(false)
    const [scanning, setScanning] = useState(false)

    useEffect(() => {
        farmsAPI.list().then(r => { setFarms(r.data); if (r.data[0]) { setSelectedFarm(r.data[0]); loadHistory(r.data[0].id) } }).catch(() => { })
    }, [])

    const loadHistory = id => {
        setLoading(true)
        satelliteAPI.getHistory(id, 30).then(r => setHistory(r.data)).catch(() => { }).finally(() => setLoading(false))
    }

    const onFarmChange = e => {
        const f = farms.find(f => f.id === +e.target.value)
        setSelectedFarm(f)
        if (f) loadHistory(f.id)
    }

    const addScan = async () => {
        if (!selectedFarm) return
        setScanning(true)
        try {
            await satelliteAPI.fetchImagery({ farm_id: selectedFarm.id })
            toast.success('New scan added!')
            loadHistory(selectedFarm.id)
        } catch { toast.error('Scan failed') } finally { setScanning(false) }
    }

    const labels = history.slice().reverse().map(h => new Date(h.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }))

    const lineData = {
        labels,
        datasets: [
            { label: 'NDVI', data: history.slice().reverse().map(h => h.ndvi_mean), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#22c55e' },
            { label: 'NDMI', data: history.slice().reverse().map(h => h.ndmi_mean), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.07)', fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#3b82f6' },
        ]
    }

    const barData = {
        labels,
        datasets: [
            { label: 'NDVI', data: history.slice().reverse().map(h => h.ndvi_mean), backgroundColor: history.slice().reverse().map(h => h.health_status === 'healthy' ? 'rgba(34,197,94,0.8)' : h.health_status === 'moderate' ? 'rgba(234,179,8,0.8)' : 'rgba(239,68,68,0.8)'), borderRadius: 4 }
        ]
    }

    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#86a98e' } } },
        scales: { x: { ticks: { color: '#4d6b55' }, grid: { color: '#1e3323' } }, y: { ticks: { color: '#4d6b55' }, grid: { color: '#1e3323' }, min: -0.1, max: 1 } }
    }

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>📈 Historical Crop Monitoring</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Track NDVI and NDMI vegetation indices over time</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {farms.length > 0 && (
                        <select className="input" style={{ width: 'auto' }} value={selectedFarm?.id || ''} onChange={onFarmChange}>
                            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    )}
                    <button className="btn-primary" onClick={addScan} disabled={scanning || !selectedFarm}>
                        <Satellite size={16} className={scanning ? 'animate-spin' : ''} />
                        {scanning ? 'Scanning...' : 'Add Scan'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                    <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                    <p>Loading history...</p>
                </div>
            ) : history.length === 0 ? (
                <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
                    <BarChart2 size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <h3 style={{ fontWeight: 700 }}>No history yet</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Run a satellite scan to start tracking crop health over time</p>
                    <button className="btn-primary" onClick={addScan} disabled={scanning}>
                        <Satellite size={16} /> Run First Scan
                    </button>
                </div>
            ) : (
                <>
                    {/* Stats row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
                        {[
                            { label: 'Scans', value: history.length, color: 'var(--accent)' },
                            { label: 'Avg NDVI', value: (history.reduce((s, h) => s + (h.ndvi_mean || 0), 0) / history.length).toFixed(3), color: '#22c55e' },
                            { label: 'Avg NDMI', value: (history.reduce((s, h) => s + (h.ndmi_mean || 0), 0) / history.length).toFixed(3), color: '#3b82f6' },
                            { label: 'Healthy Scans', value: history.filter(h => h.health_status === 'healthy').length, color: '#22c55e' },
                            { label: 'Stressed Scans', value: history.filter(h => h.health_status === 'stressed' || h.health_status === 'critical').length, color: '#ef4444' },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="card" style={{ padding: 16 }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
                                <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                        <div className="card" style={{ padding: 24 }}>
                            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>NDVI & NDMI Trend</h3>
                            <div style={{ height: 280 }}><Line data={lineData} options={chartOptions} /></div>
                        </div>
                        <div className="card" style={{ padding: 24 }}>
                            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Health Status Per Scan</h3>
                            <div style={{ height: 280 }}><Bar data={barData} options={chartOptions} /></div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Scan Records</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        {['Date', 'NDVI Mean', 'NDMI Mean', 'Status'].map(h => (
                                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(h => (
                                        <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '10px 12px' }}>{new Date(h.date).toLocaleDateString()}</td>
                                            <td style={{ padding: '10px 12px', color: '#22c55e', fontWeight: 600 }}>{h.ndvi_mean?.toFixed(4)}</td>
                                            <td style={{ padding: '10px 12px', color: '#3b82f6', fontWeight: 600 }}>{h.ndmi_mean?.toFixed(4)}</td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <span className={`badge badge-${h.health_status === 'healthy' ? 'healthy' : h.health_status === 'moderate' ? 'moderate' : 'stressed'}`}>
                                                    {h.health_status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
