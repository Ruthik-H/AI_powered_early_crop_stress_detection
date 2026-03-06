import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, FeatureGroup, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import { farmsAPI, satelliteAPI } from '../api'
import toast from 'react-hot-toast'
import { Satellite, Trash2, Save, Layers, Eye } from 'lucide-react'
import L from 'leaflet'
import 'leaflet-draw'

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Draw control injected directly into Leaflet ──────────────────────────────
function DrawControl({ onCreated, onDeleted }) {
    const map = useMap()
    const drawRef = useRef(null)
    const fgRef = useRef(L.featureGroup().addTo(map))

    useEffect(() => {
        const fg = fgRef.current
        const drawControl = new L.Control.Draw({
            edit: { featureGroup: fg },
            draw: {
                polygon: { shapeOptions: { color: '#22c55e', fillOpacity: 0.15 } },
                rectangle: { shapeOptions: { color: '#22c55e', fillOpacity: 0.15 } },
                circle: false, marker: false, circlemarker: false, polyline: false,
            }
        })
        map.addControl(drawControl)
        drawRef.current = drawControl

        map.on(L.Draw.Event.CREATED, e => {
            fg.addLayer(e.layer)
            onCreated(e.layer)
        })
        map.on(L.Draw.Event.DELETED, () => {
            onDeleted()
        })
        return () => {
            map.removeControl(drawControl)
            map.off(L.Draw.Event.CREATED)
            map.off(L.Draw.Event.DELETED)
        }
    }, [map])

    return null
}

// ── NDVI heatmap overlay using SVG grid ─────────────────────────────────────
function NDVIOverlay({ heatmap, bounds }) {
    const map = useMap()
    const layerRef = useRef(null)

    useEffect(() => {
        if (!heatmap || !bounds) return
        if (layerRef.current) map.removeLayer(layerRef.current)

        const { color_map, rows, cols } = heatmap.heatmap_data || heatmap
        if (!color_map) return

        // Create canvas
        const canvas = document.createElement('canvas')
        canvas.width = cols; canvas.height = rows
        const ctx = canvas.getContext('2d')
        const imgData = ctx.createImageData(cols, rows)

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const [red, green, blue, alpha] = color_map[r][c]
                const idx = (r * cols + c) * 4
                imgData.data[idx] = red
                imgData.data[idx + 1] = green
                imgData.data[idx + 2] = blue
                imgData.data[idx + 3] = alpha
            }
        }
        ctx.putImageData(imgData, 0, 0)

        const overlay = L.imageOverlay(canvas.toDataURL(), bounds, { opacity: 0.65 })
        overlay.addTo(map)
        layerRef.current = overlay

        return () => { if (layerRef.current) map.removeLayer(layerRef.current) }
    }, [heatmap, bounds, map])

    return null
}

export default function MapPage() {
    const [farms, setFarms] = useState([])
    const [selectedFarm, setSelectedFarm] = useState(null)
    const [heatmap, setHeatmap] = useState(null)
    const [heatmapBounds, setHeatmapBounds] = useState(null)
    const [scanning, setScanning] = useState(false)
    const [savingFarm, setSavingFarm] = useState(false)
    const [drawnLayer, setDrawnLayer] = useState(null)
    const [farmName, setFarmName] = useState('')
    const [cropType, setCropType] = useState('Mixed')
    const [locationName, setLocationName] = useState('')
    const [showHeatmap, setShowHeatmap] = useState(true)
    const mapRef = useRef(null)

    useEffect(() => {
        farmsAPI.list().then(r => {
            setFarms(r.data)
            if (r.data.length > 0) setSelectedFarm(r.data[0])
        }).catch(() => { })
    }, [])

    const onDrawCreated = useCallback(layer => {
        setDrawnLayer(layer)
        setHeatmap(null)
        toast.success('📐 Boundary drawn! Enter farm details and click Save Farm.')
    }, [])

    const onDrawDeleted = useCallback(() => {
        setDrawnLayer(null); setHeatmap(null)
    }, [])

    const saveFarm = async () => {
        if (!drawnLayer) { toast.error('Draw a farm boundary first'); return }
        if (!farmName.trim()) { toast.error('Enter a farm name'); return }
        const geo = drawnLayer.toGeoJSON()
        setSavingFarm(true)
        try {
            const { data } = await farmsAPI.create({
                name: farmName, crop_type: cropType,
                location_name: locationName, boundary: geo.geometry,
            })
            setFarms(prev => [...prev, data])
            setSelectedFarm(data)
            setFarmName('')
            toast.success(`✅ Farm "${data.name}" saved!`)
        } catch (e) { toast.error('Failed to save farm: ' + e.message) } finally { setSavingFarm(false) }
    }

    const runSatelliteScan = async () => {
        if (!selectedFarm) { toast.error('Select or save a farm first'); return }
        setScanning(true)
        setHeatmap(null)
        toast('🛰️ Requesting satellite imagery…', { icon: '🛰️' })
        try {
            const { data } = await satelliteAPI.fetchImagery({ farm_id: selectedFarm.id })
            setHeatmap(data)

            // Compute bounds from farm boundary if available
            if (selectedFarm.boundary?.coordinates) {
                const coords = selectedFarm.boundary.coordinates[0]
                const lats = coords.map(c => c[1])
                const lons = coords.map(c => c[0])
                setHeatmapBounds([
                    [Math.min(...lats), Math.min(...lons)],
                    [Math.max(...lats), Math.max(...lons)]
                ])
            } else if (mapRef.current) {
                const b = mapRef.current.getBounds()
                setHeatmapBounds([[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]])
            }

            toast.success('✅ Satellite analysis complete!')
        } catch (e) { toast.error('Satellite scan failed: ' + e.message) } finally { setScanning(false) }
    }

    const deleteFarm = async (id) => {
        if (!window.confirm('Delete this farm?')) return
        await farmsAPI.delete(id)
        setFarms(prev => prev.filter(f => f.id !== id))
        if (selectedFarm?.id === id) { setSelectedFarm(null); setHeatmap(null) }
        toast.success('Farm deleted')
    }

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>🗺️ Farm Boundary Map</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                    Use the <strong style={{ color: 'var(--accent)' }}>✏️ polygon/rectangle tool</strong> (top-right of map) to draw your farm, then save it and run a satellite scan.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
                {/* Map */}
                <div>
                    <div className="map-container" style={{ height: 520, position: 'relative' }}>
                        <MapContainer
                            center={[20.5937, 78.9629]} zoom={5}
                            style={{ height: '100%', width: '100%' }}
                            ref={mapRef}
                        >
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
                            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                attribution="Esri" opacity={0.55} />
                            <DrawControl onCreated={onDrawCreated} onDeleted={onDrawDeleted} />
                            {heatmap && heatmapBounds && showHeatmap && (
                                <NDVIOverlay heatmap={heatmap} bounds={heatmapBounds} />
                            )}
                        </MapContainer>
                    </div>

                    {/* Legend + scan bar */}
                    <div className="card" style={{ padding: '12px 16px', marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div className="heatmap-legend">
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>NDVI:</span>
                            {[['#22c55e', 'Healthy (>0.6)'], ['#eab308', 'Moderate (0.4–0.6)'], ['#ef4444', 'Stressed (0.2–0.4)'], ['#7f1d1d', 'Critical (<0.2)']].map(([color, label]) => (
                                <div key={label} className="legend-item">
                                    <div className="legend-dot" style={{ background: color }} />
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {heatmap && (
                                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}
                                    onClick={() => setShowHeatmap(p => !p)}>
                                    <Eye size={14} /> {showHeatmap ? 'Hide' : 'Show'} Heatmap
                                </button>
                            )}
                            <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 13 }}
                                onClick={runSatelliteScan} disabled={scanning || !selectedFarm}>
                                <Satellite size={14} style={{ animation: scanning ? 'spin 1s linear infinite' : 'none' }} />
                                {scanning ? 'Scanning…' : 'Run Scan'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Side panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Save form */}
                    {drawnLayer && (
                        <div className="card" style={{ padding: 20, border: '1px solid rgba(34,197,94,0.3)' }}>
                            <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 15, color: 'var(--accent)' }}>💾 Save Farm Boundary</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div>
                                    <label className="label">Farm Name *</label>
                                    <input className="input" placeholder="e.g. North Field" value={farmName} onChange={e => setFarmName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveFarm()} />
                                </div>
                                <div>
                                    <label className="label">Crop Type</label>
                                    <select className="input" value={cropType} onChange={e => setCropType(e.target.value)}>
                                        {['Rice', 'Wheat', 'Corn', 'Tomato', 'Potato', 'Soybean', 'Cotton', 'Sugarcane', 'Sunflower', 'Millet', 'Mixed'].map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Location (optional)</label>
                                    <input className="input" placeholder="e.g. Nashik, Maharashtra" value={locationName} onChange={e => setLocationName(e.target.value)} />
                                </div>
                                <button className="btn-primary" style={{ justifyContent: 'center' }} onClick={saveFarm} disabled={savingFarm}>
                                    <Save size={16} /> {savingFarm ? 'Saving…' : 'Save Farm'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Analysis result */}
                    {heatmap && (
                        <div className="card" style={{ padding: 20, border: `1px solid rgba(${heatmap.health_status === 'healthy' ? '34,197,94' : heatmap.health_status === 'moderate' ? '234,179,8' : '239,68,68'},0.3)` }}>
                            <h3 style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>📡 Satellite Analysis</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                {[
                                    { label: 'NDVI Mean', value: heatmap.ndvi_mean?.toFixed(3), color: '#22c55e' },
                                    { label: 'NDMI Mean', value: heatmap.ndmi_mean?.toFixed(3), color: '#3b82f6' },
                                    { label: 'NDVI Min', value: heatmap.ndvi_min?.toFixed(3), color: '#ef4444' },
                                    { label: 'NDVI Max', value: heatmap.ndvi_max?.toFixed(3), color: '#22c55e' },
                                ].map(({ label, value, color }) => (
                                    <div key={label} style={{ background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 10 }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                                        <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                                    </div>
                                ))}
                            </div>
                            <div className={`badge badge-${heatmap.health_status === 'healthy' ? 'healthy' : heatmap.health_status === 'moderate' ? 'moderate' : 'stressed'}`}>
                                {heatmap.health_status?.toUpperCase()}
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {heatmap.recommendations?.map((r, i) => (
                                    <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', borderLeft: '2px solid var(--accent)', paddingLeft: 8, lineHeight: 1.5 }}>{r}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Farm list */}
                    <div className="card" style={{ padding: 20 }}>
                        <h3 style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>🌾 My Farms ({farms.length})</h3>
                        {farms.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 16 }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Use the ✏️ draw tool on the map to add your first farm</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                                {farms.map(f => (
                                    <div key={f.id} onClick={() => { setSelectedFarm(f); setHeatmap(null) }} style={{
                                        padding: '10px 12px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s',
                                        background: selectedFarm?.id === f.id ? 'rgba(34,197,94,0.12)' : 'var(--bg-secondary)',
                                        border: `1px solid ${selectedFarm?.id === f.id ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.crop_type} · {f.area_hectares} ha</div>
                                        </div>
                                        <button onClick={e => { e.stopPropagation(); deleteFarm(f.id) }}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 6 }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
