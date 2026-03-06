import React, { useState, useEffect } from 'react'
import { farmsAPI, yieldAPI } from '../api'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Radar } from 'react-chartjs-2'
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

export default function YieldPage() {
    const [farms, setFarms] = useState([])
    const [selectedFarm, setSelectedFarm] = useState(null)
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        farmsAPI.list().then(r => { setFarms(r.data); if (r.data[0]) { setSelectedFarm(r.data[0]); loadYield(r.data[0].id) } }).catch(() => { })
    }, [])

    const loadYield = id => {
        setLoading(true)
        yieldAPI.predict(id).then(r => setResult(r.data)).catch(() => setResult(null)).finally(() => setLoading(false))
    }

    const onFarmChange = e => {
        const f = farms.find(f => f.id === +e.target.value)
        setSelectedFarm(f)
        if (f) loadYield(f.id)
    }

    const TrendIcon = result?.ndvi_trend === 'improving' ? TrendingUp : result?.ndvi_trend === 'declining' ? TrendingDown : Minus
    const trendColor = result?.ndvi_trend === 'improving' ? '#22c55e' : result?.ndvi_trend === 'declining' ? '#ef4444' : '#eab308'

    const radarData = result ? {
        labels: ['NDVI Health', 'Moisture', 'Canopy Cover', 'Growth Rate', 'Stress Level'],
        datasets: [{
            label: 'Farm Health',
            data: [
                result.ndvi_average * 100,
                (result.ndvi_average - 0.05) * 100,
                result.ndvi_average * 95,
                result.ndvi_trend === 'improving' ? 80 : result.ndvi_trend === 'declining' ? 40 : 60,
                result.ndvi_trend === 'improving' ? 20 : result.ndvi_trend === 'declining' ? 80 : 50,
            ],
            backgroundColor: 'rgba(34,197,94,0.15)',
            borderColor: '#22c55e',
            pointBackgroundColor: '#22c55e',
        }]
    } : null

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>🌾 Yield Prediction</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>AI-powered crop yield estimation based on NDVI time series analysis</p>
                </div>
                {farms.length > 0 && (
                    <select className="input" style={{ width: 'auto' }} value={selectedFarm?.id || ''} onChange={onFarmChange}>
                        {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                )}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Calculating yield estimate...</div>
            ) : !result ? (
                <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🌾</div>
                    <h3 style={{ fontWeight: 700 }}>No farm data yet</h3>
                    <p style={{ color: 'var(--text-muted)' }}>Add a farm and run satellite scans to enable yield prediction</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Main yield cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                        <div className="stat-card green" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>Estimated Yield / Hectare</div>
                            <div style={{ fontSize: 42, fontWeight: 800, color: '#22c55e' }}>{result.estimated_yield_per_ha.toLocaleString()}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>kg/ha</div>
                        </div>
                        <div className="stat-card green" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>Total Expected Yield</div>
                            <div style={{ fontSize: 42, fontWeight: 800, color: '#22c55e' }}>{result.estimated_total_yield_kg.toLocaleString()}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>kg total ({result.area_hectares} ha)</div>
                        </div>
                        <div className={`stat-card ${result.ndvi_trend === 'improving' ? 'green' : result.ndvi_trend === 'declining' ? 'red' : 'yellow'}`} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>NDVI Trend</div>
                            <TrendIcon size={40} color={trendColor} style={{ margin: '0 auto 8px' }} />
                            <div style={{ fontSize: 20, fontWeight: 800, color: trendColor, textTransform: 'capitalize' }}>{result.ndvi_trend}</div>
                        </div>
                        <div className="stat-card blue" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>Prediction Confidence</div>
                            <div style={{ fontSize: 42, fontWeight: 800, color: '#3b82f6' }}>{result.confidence}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Based on {result.data_points} scans</div>
                        </div>
                    </div>

                    {/* Radar + Details */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
                        <div className="card" style={{ padding: 24 }}>
                            <h3 style={{ fontWeight: 700, marginBottom: 8 }}>📊 Farm Details</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                {[
                                    { label: 'Farm', value: result.farm_name },
                                    { label: 'Crop', value: result.crop_type },
                                    { label: 'NDVI Average', value: result.ndvi_average.toFixed(4) },
                                    { label: 'Area', value: `${result.area_hectares} ha` },
                                ].map(({ label, value }) => (
                                    <div key={label} style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 10 }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
                                        <div style={{ fontWeight: 700, marginTop: 4 }}>{value}</div>
                                    </div>
                                ))}
                            </div>

                            <h4 style={{ fontWeight: 600, marginBottom: 10 }}>🤖 Recommendations</h4>
                            {result.recommendations.map((r, i) => (
                                <div key={i} style={{ padding: '10px 12px', marginBottom: 8, background: 'var(--bg-secondary)', borderRadius: 10, fontSize: 13, borderLeft: '3px solid var(--accent)', lineHeight: 1.5 }}>
                                    {r}
                                </div>
                            ))}
                        </div>

                        <div className="card" style={{ padding: 24 }}>
                            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>🕸️ Health Radar</h3>
                            {radarData && (
                                <div style={{ height: 280 }}>
                                    <Radar data={radarData} options={{
                                        responsive: true, maintainAspectRatio: false,
                                        plugins: { legend: { display: false } },
                                        scales: {
                                            r: {
                                                angleLines: { color: '#1e3323' },
                                                grid: { color: '#1e3323' },
                                                pointLabels: { color: '#86a98e', font: { size: 11 } },
                                                ticks: { color: '#4d6b55', backdropColor: 'transparent' },
                                                min: 0, max: 100,
                                            }
                                        }
                                    }} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
