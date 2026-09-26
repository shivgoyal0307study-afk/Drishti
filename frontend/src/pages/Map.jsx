import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { CARTO_DARK_TILES } from '../api'
import 'leaflet/dist/leaflet.css'

// ── Helpers ───────────────────────────────────────────────────────────────────
const stressColor = s => ({ LOW:'#3b82f6', MEDIUM:'#eab308', HIGH:'#f97316', CRITICAL:'#ef4444' }[s] || '#3b82f6')

const CAUSE_COLOR = {
  COLLISION_HUMAN_ERROR:  '#ef4444',
  DERAILMENT_HUMAN_ERROR: '#f97316',
  DERAILMENT_BRIDGE:      '#a855f7',
  DERAILMENT:             '#f97316',
  SABOTAGE:               '#dc2626',
  NATURAL_DISASTER:       '#3b82f6',
  COLLISION:              '#ef4444',
}
const CAUSE_LABEL = {
  COLLISION_HUMAN_ERROR:  'Human Error — Collision',
  DERAILMENT_HUMAN_ERROR: 'Human Error — Derailment',
  DERAILMENT_BRIDGE:      'Bridge / River Derailment',
  DERAILMENT:             'Derailment',
  SABOTAGE:               'Sabotage',
  NATURAL_DISASTER:       'Natural Disaster',
  COLLISION:              'Collision',
}

const CORRIDORS = {
  'N-S Corridor': [[28.64,77.22],[27.18,78.01],[25.45,78.60],[23.18,77.41],[21.15,79.09],[17.43,78.50],[16.51,80.65],[13.03,80.19]],
  'E-W Corridor': [[18.97,72.82],[22.31,73.19],[23.03,72.57],[22.60,88.30]],
  'East Coast':   [[22.60,88.30],[21.49,86.93],[20.25,85.83],[17.69,83.22],[16.51,80.65],[13.03,80.19]],
  'West Corridor':[[28.64,77.22],[26.91,75.79],[23.03,72.57],[18.97,72.82]],
}

// ── Popup: Historical Incident ────────────────────────────────────────────────
function IncidentPopup({ inc }) {
  const col = CAUSE_COLOR[inc.cause_category] || '#ef4444'
  return (
    <div style={{ padding:12, minWidth:255, maxWidth:295, fontFamily:'Inter,sans-serif', fontSize:'0.78rem', color:'#f1f5f9' }}>
      {inc.deaths >= 200 && (
        <div style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:4, padding:'2px 8px', marginBottom:7, fontSize:'0.58rem', fontWeight:800, color:'#ef4444', letterSpacing:1 }}>
          ⚑ MASS CASUALTY EVENT
        </div>
      )}
      <div style={{ fontWeight:800, fontSize:'0.92rem', color:col, marginBottom:2 }}>{inc.station}</div>
      <div style={{ fontSize:'0.63rem', color:'#94a3b8', marginBottom:9 }}>
        {new Date(inc.date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}
        {' · '}{CAUSE_LABEL[inc.cause_category]}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 10px', marginBottom:9 }}>
        {[
          { label:'Deaths',  val:inc.deaths,         col:'#ef4444' },
          { label:'Injured', val:inc.injuries || '?', col:'#f97316' },
          { label:'Signal',  val:(inc.signal_state||'').replace('_',' '), col:'#94a3b8' },
          { label:'Track',   val:(inc.track_state||'').replace('_',' '),  col:'#94a3b8' },
        ].map(m => (
          <div key={m.label}>
            <div style={{ fontSize:'0.58rem', color:'#64748b', marginBottom:1 }}>{m.label}</div>
            <div style={{ fontWeight:700, color:m.col, fontSize:'0.8rem' }}>{m.val}</div>
          </div>
        ))}
      </div>
      <div style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:5, padding:'6px 9px', marginBottom:8, fontSize:'0.63rem', color:'#cbd5e1', lineHeight:1.6 }}>
        <div style={{ fontWeight:700, color:'#f97316', marginBottom:3, fontSize:'0.58rem', letterSpacing:0.5 }}>ROOT CAUSE</div>
        {inc.root_cause}
      </div>
      {inc.narrative_text && (
        <div style={{ fontSize:'0.61rem', color:'#94a3b8', lineHeight:1.65 }}>
          {inc.narrative_text.slice(0,190)}{inc.narrative_text.length > 190 ? '…' : ''}
        </div>
      )}
    </div>
  )
}

// ── Popup: Live Junction Node ─────────────────────────────────────────────────
function NodePopup({ node }) {
  const col = stressColor(node.stress_level)
  const pct = node.signature_match_pct || 0
  return (
    <div style={{ padding:12, minWidth:235, fontFamily:'Inter,sans-serif', fontSize:'0.78rem', color:'#f1f5f9' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:9 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:'0.95rem', color:col }}>{node.name}</div>
          <div style={{ fontSize:'0.63rem', color:'#94a3b8', marginTop:1 }}>{node.id} · Zone {node.zone} · Rank #{node.risk_rank}</div>
        </div>
        <div style={{ padding:'2px 7px', borderRadius:4, background:`${col}22`, border:`1px solid ${col}55`, color:col, fontSize:'0.62rem', fontWeight:700 }}>
          {node.stress_level}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 10px', marginBottom:9 }}>
        {[
          { label:'Centrality', val:`Top ${Math.round((node.risk_rank/51)*100)}%`, col },
          { label:'Delay',      val:`${node.delay_minutes||0} min`, col: node.delay_minutes > 45 ? '#f97316' : '#94a3b8' },
          { label:'Cascade Risk', val:`${((node.cascade_risk||0)*100).toFixed(0)}%`, col: node.cascade_risk > 0.5 ? '#ef4444' : '#94a3b8' },
          { label:'CRS Accidents', val: node.accident_count > 0 ? `${node.accident_count} on record` : 'None', col: node.accident_count > 0 ? '#ef4444' : '#64748b' },
        ].map(m => (
          <div key={m.label}>
            <div style={{ fontSize:'0.58rem', color:'#64748b', marginBottom:1 }}>{m.label}</div>
            <div style={{ fontWeight:700, color:m.col, fontSize:'0.78rem' }}>{m.val}</div>
          </div>
        ))}
      </div>
      {node.signature_accident_name && (
        <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:5, padding:'6px 9px', marginBottom:8 }}>
          <div style={{ fontSize:'0.6rem', color:'#ef4444', fontWeight:700, marginBottom:2 }}>⚠ CRS MATCH: {pct}%</div>
          <div style={{ fontSize:'0.65rem', color:'#cbd5e1' }}>{node.signature_accident_name} · {node.signature_date}</div>
        </div>
      )}
      {pct > 0 && (
        <div style={{ marginBottom:9 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.58rem', color:'#64748b', marginBottom:3 }}>
            <span>Pattern Match</span><span>{pct}%</span>
          </div>
          <div style={{ background:'#1e293b', borderRadius:3, height:4, overflow:'hidden' }}>
            <div style={{ width:`${pct}%`, height:'100%', background: pct>75?'#ef4444':pct>50?'#f97316':'#eab308', borderRadius:3 }} />
          </div>
        </div>
      )}
      <Link to={`/alerts?station=${node.id}`} style={{ display:'block', textAlign:'center', padding:'5px', background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.3)', color:'#3b82f6', borderRadius:4, fontSize:'0.68rem', fontWeight:700 }}>
        View Alerts for {node.id} →
      </Link>
    </div>
  )
}

// ── Incident Sidebar Panel ────────────────────────────────────────────────────
function IncidentPanel({ incidents, selected, onSelect }) {
  const sorted = [...incidents].sort((a,b) => new Date(b.date)-new Date(a.date))
  const totalDeaths = incidents.reduce((s,i)=>s+i.deaths,0)
  return (
    <div style={{
      position:'absolute', top:0, right:0, width:288, height:'100%', zIndex:999,
      background:'rgba(4,7,26,0.96)', backdropFilter:'blur(14px)',
      borderLeft:'1px solid rgba(255,255,255,0.07)',
      display:'flex', flexDirection:'column', fontFamily:'Inter,sans-serif',
    }}>
      <div style={{ padding:'11px 13px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize:'0.68rem', fontWeight:800, color:'#ef4444', letterSpacing:1, marginBottom:3 }}>⚑ HISTORICAL INCIDENT REGISTER</div>
        <div style={{ fontSize:'0.58rem', color:'#64748b' }}>
          {incidents.length} disasters · {totalDeaths.toLocaleString()} documented deaths · 1961–2024
        </div>
        <div style={{ display:'flex', gap:5, marginTop:7, flexWrap:'wrap' }}>
          {[['#ef4444','Human Error'],['#dc2626','Sabotage'],['#3b82f6','Natural'],['#a855f7','Bridge']].map(([c,l])=>(
            <div key={l} style={{ display:'flex', alignItems:'center', gap:3 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:c }} />
              <span style={{ fontSize:'0.53rem', color:'#94a3b8' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto' }}>
        {sorted.map(inc => {
          const col = CAUSE_COLOR[inc.cause_category] || '#ef4444'
          const isSel = selected?.accident_id === inc.accident_id
          return (
            <div key={inc.accident_id} onClick={()=>onSelect(isSel?null:inc)} style={{
              padding:'9px 13px', borderBottom:'1px solid rgba(255,255,255,0.04)',
              cursor:'pointer', transition:'all 120ms',
              background: isSel ? 'rgba(239,68,68,0.07)' : 'transparent',
              borderLeft: `3px solid ${isSel ? col : 'transparent'}`,
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:'0.73rem', color:'#e2e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inc.station}</div>
                  <div style={{ fontSize:'0.58rem', color:'#64748b', marginTop:1 }}>{new Date(inc.date).getFullYear()} · {CAUSE_LABEL[inc.cause_category]}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0, marginLeft:8 }}>
                  <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:'0.8rem', fontWeight:800, color:col }}>{inc.deaths >= 500 ? `${inc.deaths}+` : inc.deaths}</div>
                  <div style={{ fontSize:'0.52rem', color:'#64748b' }}>deaths</div>
                </div>
              </div>
              {isSel && <div style={{ marginTop:5, fontSize:'0.6rem', color:'#94a3b8', lineHeight:1.55 }}>{inc.root_cause}</div>}
            </div>
          )
        })}
      </div>
      <div style={{ padding:'9px 13px', borderTop:'1px solid rgba(255,255,255,0.07)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
        {[
          { label:'Human Error', val:incidents.filter(i=>i.cause_category?.includes('HUMAN')||i.cause_category==='COLLISION').length, col:'#ef4444' },
          { label:'Sabotage',    val:incidents.filter(i=>i.cause_category==='SABOTAGE').length, col:'#dc2626' },
          { label:'Natural',     val:incidents.filter(i=>i.cause_category==='NATURAL_DISASTER').length, col:'#3b82f6' },
          { label:'Bridge',      val:incidents.filter(i=>i.cause_category==='DERAILMENT_BRIDGE').length, col:'#a855f7' },
        ].map(s=>(
          <div key={s.label} style={{ background:'rgba(255,255,255,0.03)', borderRadius:5, padding:'5px 7px' }}>
            <div style={{ fontSize:'0.53rem', color:'#64748b', marginBottom:1 }}>{s.label}</div>
            <div style={{ fontFamily:'IBM Plex Mono,monospace', fontWeight:800, fontSize:'0.82rem', color:s.col }}>{s.val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Map Page ─────────────────────────────────────────────────────────────
export default function NetworkMap() {
  const [nodes,       setNodes]       = useState([])
  const [incidents,   setIncidents]   = useState([])
  const [tileKey,     setTileKey]     = useState('dark')
  const [stressFilter,setStressFilter]= useState('ALL')
  const [layer,       setLayer]       = useState('BOTH')        // 'BOTH' | 'NETWORK' | 'INCIDENTS'
  const [causeFilter, setCauseFilter] = useState('ALL')
  const [selectedInc, setSelectedInc] = useState(null)
  const [showPanel,   setShowPanel]   = useState(true)

  const TILES = {
    dark:    CARTO_DARK_TILES,
    terrain: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
  }

  // Load 51-node network graph
  useEffect(() => {
    fetch('/network_graph.json')
      .then(r => r.json())
      .then(d => setNodes(d.graph?.nodes || []))
      .catch(() => {})
  }, [])

  // Load CRS historical incidents
  useEffect(() => {
    fetch('/crs_corpus.json')
      .then(r => r.json())
      .then(d => setIncidents(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  const showNetwork   = layer === 'BOTH' || layer === 'NETWORK'
  const showIncidents = layer === 'BOTH' || layer === 'INCIDENTS'

  const visibleNodes = useMemo(() => {
    if (stressFilter === 'ALL') return nodes
    return nodes.filter(n => n.stress_level === stressFilter)
  }, [nodes, stressFilter])

  const visibleIncidents = useMemo(() => {
    if (causeFilter === 'ALL') return incidents
    return incidents.filter(i => i.cause_category === causeFilter)
  }, [incidents, causeFilter])

  const critCount   = nodes.filter(n => n.stress_level === 'CRITICAL').length
  const totalDeaths = incidents.reduce((s,i) => s+i.deaths, 0)

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <div style={{
        padding:'9px 18px', background:'rgba(4,7,26,0.97)',
        borderBottom:'1px solid rgba(255,255,255,0.07)',
        display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8,
      }}>
        <div>
          <h2 style={{ fontSize:'0.98rem', fontWeight:800, margin:0, color:'#e2e8f0' }}>
            National Railway Intelligence Map
          </h2>
          <div style={{ fontSize:'0.63rem', color:'#64748b', marginTop:2 }}>
            {nodes.length} live junctions · {incidents.length} historical incidents · {totalDeaths.toLocaleString()} documented deaths
          </div>
        </div>
        <div style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}>
          {/* Summary pills */}
          {[
            { label:'Critical',  val:critCount,          col:'#ef4444' },
            { label:'Incidents', val:incidents.length,   col:'#dc2626' },
            { label:'Dead',      val:`${(totalDeaths/1000).toFixed(1)}k+`, col:'#f97316' },
          ].map(s=>(
            <div key={s.label} style={{ fontSize:'0.68rem', display:'flex', gap:4 }}>
              <span style={{ color:'#64748b' }}>{s.label}:</span>
              <span style={{ fontWeight:800, fontFamily:'IBM Plex Mono,monospace', color:s.col }}>{s.val}</span>
            </div>
          ))}
          <div style={{ width:1, height:18, background:'rgba(255,255,255,0.08)' }} />
          {/* Layer toggle */}
          {[['BOTH','All'],['NETWORK','Live'],['INCIDENTS','Disasters']].map(([v,l])=>(
            <button key={v} onClick={()=>setLayer(v)} style={{
              padding:'3px 8px', borderRadius:4, fontSize:'0.6rem', fontWeight:700, cursor:'pointer',
              background: layer===v ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
              color: layer===v ? '#ef4444' : '#64748b',
              border:`1px solid ${layer===v ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
            }}>{l}</button>
          ))}
          {/* Cause filter */}
          {showIncidents && (
            <select value={causeFilter} onChange={e=>setCauseFilter(e.target.value)} style={{
              padding:'3px 6px', borderRadius:4, fontSize:'0.6rem', fontWeight:600, cursor:'pointer',
              background:'rgba(255,255,255,0.06)', color:'#e2e8f0',
              border:'1px solid rgba(255,255,255,0.1)',
            }}>
              <option value="ALL">All Causes</option>
              {Object.entries(CAUSE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          )}
          {/* Stress filter */}
          {showNetwork && ['ALL','CRITICAL','HIGH','MEDIUM','LOW'].map(f=>(
            <button key={f} onClick={()=>setStressFilter(f)} style={{
              padding:'3px 7px', borderRadius:4, fontSize:'0.58rem', fontWeight:700, cursor:'pointer',
              background: stressFilter===f ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
              color: stressFilter===f ? '#3b82f6' : '#64748b',
              border:`1px solid ${stressFilter===f ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
            }}>{f}</button>
          ))}
          {/* Tile + panel */}
          {['dark','terrain'].map(t=>(
            <button key={t} onClick={()=>setTileKey(t)} style={{
              padding:'3px 7px', borderRadius:4, fontSize:'0.58rem', fontWeight:700, textTransform:'uppercase', cursor:'pointer',
              background: tileKey===t ? 'rgba(255,255,255,0.14)' : 'transparent',
              color: tileKey===t ? '#e2e8f0' : '#64748b',
              border:'1px solid rgba(255,255,255,0.08)',
            }}>{t}</button>
          ))}
          <button onClick={()=>setShowPanel(v=>!v)} style={{
            padding:'3px 8px', borderRadius:4, fontSize:'0.6rem', fontWeight:700, cursor:'pointer',
            background: showPanel ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
            color: showPanel ? '#ef4444' : '#64748b',
            border:'1px solid rgba(255,255,255,0.08)',
          }}>{showPanel ? 'Hide Panel' : 'Incidents ▸'}</button>
        </div>
      </div>

      {/* Map + Panel */}
      <div style={{ flex:1, position:'relative' }}>
        <MapContainer
          center={[22.5, 80.5]} zoom={5} minZoom={4} maxZoom={14}
          maxBounds={[[5.0,63.0],[38.0,100.0]]} maxBoundsViscosity={0.8}
          style={{ height:'100%', width:'100%', background:'#02040f' }}
        >
          <TileLayer key={tileKey} url={TILES[tileKey]} attribution="DRISHTI · © CARTO" />
          <TileLayer url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png" opacity={0.18} />

          {/* Corridors */}
          {Object.entries(CORRIDORS).map(([name, pts]) => (
            <Polyline key={name} positions={pts} pathOptions={{ color:'#60a5fa', weight:1.5, opacity:0.55, dashArray:'5 8' }} />
          ))}

          {/* ── Historical Incident Markers ─────────────────────────────── */}
          {showIncidents && visibleIncidents.map(inc => {
            if (!inc.lat || !inc.lng) return null
            const col = CAUSE_COLOR[inc.cause_category] || '#ef4444'
            const r   = Math.max(8, Math.min(28, inc.deaths / 18))
            const isSelected = selectedInc?.accident_id === inc.accident_id

            return (
              <CircleMarker
                key={inc.accident_id}
                center={[inc.lat, inc.lng]}
                radius={r}
                pathOptions={{
                  color: col,
                  fillColor: col,
                  fillOpacity: isSelected ? 0.95 : 0.72,
                  weight: inc.deaths >= 200 ? 2.5 : 1.5,
                  opacity: 1,
                  dashArray: inc.cause_category === 'SABOTAGE' ? '4 3' : undefined,
                }}
                eventHandlers={{ click: () => setSelectedInc(isSelected ? null : inc) }}
              >
                <Popup className="drishti-popup" maxWidth={300}>
                  <IncidentPopup inc={inc} />
                </Popup>
              </CircleMarker>
            )
          })}

          {/* ── Glow rings for mass-casualty incidents ──────────────────── */}
          {showIncidents && visibleIncidents.filter(i => i.lat && i.lng && i.deaths >= 100).map(inc => (
            <CircleMarker
              key={`glow-${inc.accident_id}`}
              center={[inc.lat, inc.lng]}
              radius={Math.max(8, Math.min(28, inc.deaths / 18)) + 9}
              pathOptions={{
                color: CAUSE_COLOR[inc.cause_category] || '#ef4444',
                fillColor: CAUSE_COLOR[inc.cause_category] || '#ef4444',
                fillOpacity: 0.04, weight: 1, opacity: 0.3, dashArray: '3 6',
              }}
              interactive={false}
            />
          ))}

          {/* ── Live Network Nodes ──────────────────────────────────────── */}
          {showNetwork && visibleNodes.filter(n => n.lat && n.lng).map(node => {
            const col    = stressColor(node.stress_level)
            const radius = Math.max(5, (node.centrality || 0.3) * 22)
            const isCrit = node.stress_level === 'CRITICAL'
            const isHigh = node.stress_level === 'HIGH'
            const hasSig = (node.signature_match_pct || 0) > 55

            return [
              // Glow ring
              (isCrit || isHigh || hasSig) && (
                <CircleMarker
                  key={`glow-${node.id}`}
                  center={[node.lat, node.lng]}
                  radius={radius + 7}
                  pathOptions={{ color:col, fillColor:col, fillOpacity:0.05, weight:1, opacity:0.22 }}
                  interactive={false}
                />
              ),
              // Main node
              <CircleMarker
                key={node.id}
                center={[node.lat, node.lng]}
                radius={radius}
                pathOptions={{
                  color:col, fillColor:col,
                  fillOpacity: isCrit ? 0.85 : isHigh ? 0.70 : 0.50,
                  weight: isCrit ? 2 : 1, opacity:0.9,
                }}
              >
                <Popup className="drishti-popup" maxWidth={280}>
                  <NodePopup node={node} />
                </Popup>
              </CircleMarker>
            ].filter(Boolean)
          })}
        </MapContainer>

        {/* Incident Sidebar */}
        {showPanel && showIncidents && (
          <IncidentPanel incidents={visibleIncidents} selected={selectedInc} onSelect={setSelectedInc} />
        )}

        {/* Legend */}
        <div style={{
          position:'absolute', bottom:22, left:14, zIndex:1000,
          background:'rgba(4,7,26,0.93)', backdropFilter:'blur(10px)',
          border:'1px solid rgba(255,255,255,0.07)', borderRadius:9, padding:'11px 14px', minWidth:170,
        }}>
          {showNetwork && <>
            <div style={{ fontSize:'0.56rem', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:7 }}>Live Network</div>
            {[['#3b82f6','Stable'],['#eab308','Medium Stress'],['#f97316','High Stress'],['#ef4444','Critical']].map(([c,l])=>(
              <div key={l} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                <div style={{ width:8, height:8, background:c, borderRadius:'50%', boxShadow:`0 0 5px ${c}` }} />
                <span style={{ fontSize:'0.62rem', color:'#94a3b8' }}>{l}</span>
              </div>
            ))}
          </>}
          {showIncidents && <>
            <div style={{ fontSize:'0.56rem', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:7, marginTop: showNetwork ? 8 : 0, paddingTop: showNetwork ? 8 : 0, borderTop: showNetwork ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>Historical Incidents</div>
            {Object.entries(CAUSE_COLOR).map(([k,c])=>(
              <div key={k} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                <div style={{ width:8, height:8, background:c, borderRadius:'50%', boxShadow:`0 0 5px ${c}` }} />
                <span style={{ fontSize:'0.59rem', color:'#94a3b8' }}>{CAUSE_LABEL[k]}</span>
              </div>
            ))}
            <div style={{ fontSize:'0.55rem', color:'#475569', marginTop:5 }}>Circle size = death toll</div>
          </>}
        </div>

        {/* Critical banner */}
        {critCount > 0 && (
          <div style={{
            position:'absolute', bottom:22, left:'50%', transform:'translateX(-50%)',
            zIndex:1000, background:'#dc2626', color:'#fff',
            padding:'8px 20px', borderRadius:28, fontWeight:800, fontSize:'0.75rem',
            boxShadow:'0 4px 24px rgba(239,68,68,0.5)',
          }}>
            ⚑ {critCount} CRITICAL CASCADE NODE{critCount>1?'S':''} ACTIVE
          </div>
        )}
      </div>
    </div>
  )
}
