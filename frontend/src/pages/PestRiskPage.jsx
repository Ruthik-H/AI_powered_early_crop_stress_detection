import React, { useState, useEffect } from 'react'
import { pestAPI, farmsAPI } from '../api'
import toast from 'react-hot-toast'
import { Bug, Thermometer, Droplets, Wind, AlertTriangle, Shield } from 'lucide-react'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const DEFAULT_LAT = 20.5937
const DEFAULT_LON = 78.9629

export default function PestRiskPage() {
    const [lat, setLat] = useState(DEFAULT_LAT)
    const [lon, setLon] = useState(DEFAULT_LON)
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                setLat(pos.coords.latitude)
                setLon(pos.coords.longitude)
            })
        }
    }, [])

    const analyze = async () => {
        setLoading(true)
        try {
            const { data } = await pestAPI.predict(lat, lon)
            setResult(data)
        } catch { toast.error('Failed to fetch pest risk data') } finally { setLoading(false) }
    }

    const getRiskColor = risk => ({ High: '#ef4444', Medium: '#eab308', Low: '#22c55e' }[risk] || '#22c55e')

    const donutData = result ? {
        datasets: [{
            data: [result.risk_score, 100 - result.risk_score],
            backgroundColor: [getRiskColor(result.overall_risk), '#1e3323'],
            borderWidth: 0,
        }]
    } : null

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>🐛 Pest Risk Prediction</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Weather-based AI model predicts likelihood of pest outbreaks in your region</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
                {/* Controls */}
                <div className="card" style={{ padding: 24, height: 'fit-content' }}>
                    <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Location</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                            <label className="label">Latitude</label>
                            <input className="input" type="number" step="0.0001" value={lat} onChange={e => setLat(+e.target.value)} />
                        </div>
                        <div>
                            <label className="label">Longitude</label>
                            <input className="input" type="number" step="0.0001" value={lon} onChange={e => setLon(+e.target.value)} />
                        </div>
                        <button className="btn-primary" style={{ justifyContent: 'center' }} onClick={analyze} disabled={loading}>
                            <Bug size={16} /> {loading ? 'Analyzing...' : 'Predict Pest Risk'}
                        </button>
                        <button className="btn-secondary" style={{ justifyContent: 'center', fontSize: 12 }} onClick={() => {
                            navigator.geolocation?.getCurrentPosition(pos => { setLat(pos.coords.latitude); setLon(pos.coords.longitude); toast.success('Location updated') })
                        }}>
                            📍 Use My Location
                        </button>
                    </div>
                </div>

                {/* Results */}
                {result ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Risk gauge + weather */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                                <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Overall Pest Risk</h3>
                                <div style={{ width: 160, margin: '0 auto', position: 'relative' }}>
                                    <Doughnut data={donutData} options={{ cutout: '75%', plugins: { legend: { display: false } } }} />
                                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                        <div style={{ fontSize: 28, fontWeight: 800, color: getRiskColor(result.overall_risk) }}>{result.risk_score}%</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>risk</div>
                                    </div>
                                </div>
                                <div style={{ marginTop: 16 }}>
                                    <span className={`badge badge-${result.overall_risk === 'High' ? 'stressed' : result.overall_risk === 'Medium' ? 'moderate' : 'healthy'}`} style={{ fontSize: 14, padding: '6px 16px' }}>
                                        {result.overall_risk} Risk
                                    </span>
                                </div>
                            </div>

                            <div className="card" style={{ padding: 24 }}>
                                <h3 style={{ fontWeight: 700, marginBottom: 16 }}>🌡️ Weather Conditions</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {[
                                        { icon: Thermometer, label: 'Temperature', value: `${result.weather_summary.temp}°C`, color: '#ef4444' },
                                        { icon: Droplets, label: 'Humidity', value: `${result.weather_summary.humidity}%`, color: '#3b82f6' },
                                        { icon: Wind, label: 'Wind Speed', value: `${result.weather_summary.wind} m/s`, color: '#a78bfa' },
                                        { icon: AlertTriangle, label: 'Rainfall', value: `${result.weather_summary.rain} mm`, color: '#22c55e' },
                                    ].map(({ icon: Icon, label, value, color }) => (
                                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                                                <Icon size={16} color={color} /> {label}
                                            </div>
                                            <div style={{ fontWeight: 700, color }}>{value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Pest threats */}
                        {result.pests.length > 0 && (
                            <div className="card" style={{ padding: 24 }}>
                                <h3 style={{ fontWeight: 700, marginBottom: 16 }}>⚠️ Pest Threats Detected</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                                    {result.pests.map((p, i) => (
                                        <div key={i} style={{
                                            padding: 16, borderRadius: 12, border: `1px solid ${getRiskColor(p.risk)}44`,
                                            background: `${getRiskColor(p.risk)}10`
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <span style={{ fontWeight: 700, fontSize: 14 }}>{p.type}</span>
                                                <span className={`badge badge-${p.risk === 'High' ? 'stressed' : p.risk === 'Medium' ? 'moderate' : 'healthy'}`}>{p.risk}</span>
                                            </div>
                                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{p.description}</p>
                                            <div style={{ fontSize: 12, borderLeft: '2px solid var(--accent)', paddingLeft: 8, color: 'var(--text-secondary)' }}>💊 {p.action}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {result.pests.length === 0 && (
                            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                                <Shield size={32} color="#22c55e" style={{ margin: '0 auto 8px' }} />
                                <h3 style={{ fontWeight: 700, color: '#22c55e' }}>Low Pest Risk</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Current weather conditions do not favor significant pest activity. Continue regular monitoring.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
                        <Bug size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                        <h3 style={{ fontWeight: 700 }}>Enter your location and click Predict</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 13 }}>We'll analyze current weather data to estimate pest outbreak risk in your area</p>
                    </div>
                )}
            </div>
        </div>
    )
}
