import React, { useState, useEffect, useRef } from 'react'
import { diseaseAPI, farmsAPI } from '../api'
import toast from 'react-hot-toast'
import { Upload, Leaf, AlertTriangle, CheckCircle, Loader } from 'lucide-react'

export default function DiseasePage() {
    const [farms, setFarms] = useState([])
    const [selectedFarm, setSelectedFarm] = useState(null)
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)
    const [preview, setPreview] = useState(null)
    const [history, setHistory] = useState([])
    const [dragOver, setDragOver] = useState(false)
    const fileRef = useRef()

    useEffect(() => {
        farmsAPI.list().then(r => { setFarms(r.data); if (r.data[0]) setSelectedFarm(r.data[0].id) }).catch(() => { })
        diseaseAPI.history().then(r => setHistory(r.data)).catch(() => { })
    }, [])

    const handleFile = async file => {
        if (!file) return
        setPreview(URL.createObjectURL(file))
        setLoading(true)
        setResult(null)
        try {
            const { data } = await diseaseAPI.detect(file, selectedFarm)
            setResult(data)
            toast.success(data.is_healthy ? '✅ Leaf appears healthy!' : `🦠 Disease detected: ${data.disease}`)
            diseaseAPI.history().then(r => setHistory(r.data)).catch(() => { })
        } catch { toast.error('Detection failed. Please try again.') } finally { setLoading(false) }
    }

    const onDrop = e => {
        e.preventDefault(); setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file?.type.startsWith('image/')) handleFile(file)
    }

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>🔬 Plant Disease Detection</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Upload a leaf image to detect diseases using our CNN model trained on 54,000+ PlantVillage images</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                {/* Upload */}
                <div className="card" style={{ padding: 24 }}>
                    <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Upload Leaf Image</h3>

                    {farms.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <label className="label">Assign to Farm (optional)</label>
                            <select className="input" value={selectedFarm || ''} onChange={e => setSelectedFarm(+e.target.value)}>
                                <option value="">None</option>
                                {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Drop zone */}
                    <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={onDrop}
                        onClick={() => fileRef.current.click()}
                        style={{
                            border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                            borderRadius: 16, padding: 32, textAlign: 'center', cursor: 'pointer',
                            background: dragOver ? 'rgba(34,197,94,0.05)' : 'var(--bg-secondary)',
                            transition: 'all 0.2s', minHeight: 180,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                        }}>
                        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => handleFile(e.target.files[0])} />
                        {preview ? (
                            <img src={preview} alt="Leaf preview" style={{ maxHeight: 200, borderRadius: 12, maxWidth: '100%', objectFit: 'cover' }} />
                        ) : (
                            <>
                                <Upload size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>Drop leaf image here</div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>or click to browse · JPG, PNG, WEBP</div>
                            </>
                        )}
                    </div>

                    {preview && !loading && !result && (
                        <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                            onClick={() => fileRef.current.click()}>
                            <Upload size={16} /> Change Image
                        </button>
                    )}

                    {loading && (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--accent)' }}>
                            <Loader size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                            <div style={{ fontSize: 13 }}>Analyzing leaf with CNN model...</div>
                        </div>
                    )}
                </div>

                {/* Result */}
                <div className="card" style={{ padding: 24 }}>
                    <h3 style={{ fontWeight: 700, marginBottom: 16 }}>🧪 Detection Result</h3>
                    {!result ? (
                        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
                            <Leaf size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
                            <p>Upload a leaf image to see results</p>
                            <p style={{ fontSize: 12, marginTop: 4 }}>Supports 38 crop diseases</p>
                        </div>
                    ) : (
                        <div style={{ animation: 'fadeIn 0.4s ease' }}>
                            <div style={{
                                padding: 20, borderRadius: 16,
                                background: result.is_healthy ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                border: `1px solid ${result.is_healthy ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                marginBottom: 16, textAlign: 'center'
                            }}>
                                {result.is_healthy
                                    ? <CheckCircle size={32} color="#22c55e" style={{ margin: '0 auto 8px' }} />
                                    : <AlertTriangle size={32} color="#ef4444" style={{ margin: '0 auto 8px' }} />
                                }
                                <div style={{ fontWeight: 800, fontSize: 18, color: result.is_healthy ? '#22c55e' : '#ef4444' }}>
                                    {result.disease}
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                                    {result.confidence}% confidence · Severity: {result.severity}
                                </div>
                            </div>

                            <h4 style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Top Predictions</h4>
                            {result.top_predictions.map((p, i) => (
                                <div key={i} style={{ marginBottom: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                        <span>{p.label}</span>
                                        <span style={{ color: 'var(--accent)' }}>{p.confidence}%</span>
                                    </div>
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${p.confidence}%` }} />
                                    </div>
                                </div>
                            ))}

                            <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-secondary)', borderRadius: 10, fontSize: 13, lineHeight: 1.6, borderLeft: '3px solid var(--accent)' }}>
                                <strong>💊 Treatment:</strong> {result.treatment}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* History */}
            {history.length > 0 && (
                <div className="card" style={{ padding: 24 }}>
                    <h3 style={{ fontWeight: 700, marginBottom: 16 }}>📋 Detection History</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                        {history.map(d => (
                            <div key={d.id} className="card" style={{ padding: 14 }}>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    {d.image_url && <img src={`http://localhost:8000${d.image_url}`} alt="" style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover' }} />}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.disease}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.confidence.toFixed(1)}% · {new Date(d.detected_at).toLocaleDateString()}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
