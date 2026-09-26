import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from 'react-leaflet'
import { CARTO_DARK_TILES } from '../api'
import 'leaflet/dist/leaflet.css'
import indianRailwayZones from '../assets/indian_railway_zones.svg'

/* ═══════════════════════════════════════════════════════════════════
   INDIAN RAILWAY ZONES — graph data
   17 zones with approximate SVG-canvas positions (800 × 580 canvas)
   and adjacency (zones that share a border / major rail link)
═══════════════════════════════════════════════════════════════════ */
const ZONES = [
  { id: 1,  code: 'NR',   name: 'Northern Railway',             hq: 'New Delhi',     cx: 400, cy: 145, centrality: 0.92, lat: 28.636, lng: 77.224 },
  { id: 2,  code: 'NER',  name: 'North Eastern Railway',        hq: 'Gorakhpur',     cx: 530, cy: 185, centrality: 0.58, lat: 26.752, lng: 83.374 },
  { id: 3,  code: 'NFR',  name: 'Northeast Frontier Railway',   hq: 'Maligaon',      cx: 670, cy: 200, centrality: 0.44, lat: 26.180, lng: 91.737 },
  { id: 4,  code: 'ER',   name: 'Eastern Railway',              hq: 'Kolkata',       cx: 570, cy: 260, centrality: 0.71, lat: 22.572, lng: 88.363 },
  { id: 5,  code: 'SER',  name: 'South Eastern Railway',        hq: 'Kolkata',       cx: 580, cy: 320, centrality: 0.67, lat: 22.520, lng: 88.240 },
  { id: 6,  code: 'SCR',  name: 'South Central Railway',        hq: 'Secunderabad',  cx: 450, cy: 390, centrality: 0.78, lat: 17.442, lng: 78.498 },
  { id: 7,  code: 'SR',   name: 'Southern Railway',             hq: 'Chennai',       cx: 460, cy: 470, centrality: 0.73, lat: 13.082, lng: 80.275 },
  { id: 8,  code: 'CR',   name: 'Central Railway',              hq: 'Mumbai CST',    cx: 360, cy: 355, centrality: 0.85, lat: 18.940, lng: 72.836 },
  { id: 9,  code: 'WR',   name: 'Western Railway',              hq: 'Mumbai Church', cx: 280, cy: 310, centrality: 0.80, lat: 18.935, lng: 72.827 },
  { id: 10, code: 'SWR',  name: 'South Western Railway',        hq: 'Hubballi',      cx: 370, cy: 430, centrality: 0.60, lat: 15.362, lng: 75.136 },
  { id: 11, code: 'NWR',  name: 'North Western Railway',        hq: 'Jaipur',        cx: 295, cy: 220, centrality: 0.65, lat: 26.912, lng: 75.787 },
  { id: 12, code: 'WCR',  name: 'West Central Railway',         hq: 'Jabalpur',      cx: 415, cy: 265, centrality: 0.62, lat: 23.181, lng: 79.941 },
  { id: 13, code: 'NCR',  name: 'North Central Railway',        hq: 'Prayagraj',     cx: 470, cy: 225, centrality: 0.70, lat: 25.436, lng: 81.846 },
  { id: 14, code: 'ECR',  name: 'East Central Railway',         hq: 'Hajipur',       cx: 510, cy: 270, centrality: 0.66, lat: 25.692, lng: 85.209 },
  { id: 15, code: 'SECR', name: 'South East Central Railway',   hq: 'Bilaspur',      cx: 500, cy: 340, centrality: 0.55, lat: 22.082, lng: 82.148 },
  { id: 16, code: 'ECoR', name: 'East Coast Railway',           hq: 'Bhubaneswar',   cx: 545, cy: 305, centrality: 0.59, lat: 20.296, lng: 85.824 },
  { id: 17, code: 'METRO',name: 'Metro Railway Kolkata',        hq: 'Kolkata Metro', cx: 590, cy: 265, centrality: 0.30, lat: 22.560, lng: 88.350 },
]

/* Edges — pairs of zone IDs */
const EDGES = [
  [1, 11], [1, 12], [1, 13], [1, 2], [1, 9],
  [2, 13], [2, 14], [2, 3],
  [3, 4],  [3, 17],
  [4, 14], [4, 16], [4, 17],
  [5, 15], [5, 16], [5, 6],
  [6, 7],  [6, 8],  [6, 10], [6, 15],
  [7, 10],
  [8, 9],  [8, 10], [8, 12],
  [9, 11],
  [11, 12],[12, 13],[13, 14],[14, 15],[15, 16],
]

/* Cascade propagation — BFS-ish weighted delay per hop */
function computeCascade(triggerIds, hops = 4) {
  const adj = {}
  ZONES.forEach(z => { adj[z.id] = [] })
  EDGES.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a) })

  const result = {} // id → { level, delay }
  const queue = []

  triggerIds.forEach(id => {
    result[id] = { level: 'CRITICAL', delay: 0 }
    queue.push({ id, hop: 0 })
  })

  while (queue.length) {
    const { id, hop } = queue.shift()
    if (hop >= hops) continue
    const zone = ZONES.find(z => z.id === id)
    adj[id].forEach(nid => {
      if (result[nid]) return
      const nzone = ZONES.find(z => z.id === nid)
      const propDelay = (hop + 1) * 4 + Math.round(Math.random() * 6)
      const propLevel = hop === 0 ? 'HIGH'
        : hop === 1 ? 'MEDIUM'
        : 'LOW'
      // High centrality neighbours amplify
      const effectiveLevel = nzone.centrality > 0.75 && propLevel === 'MEDIUM'
        ? 'HIGH' : propLevel
      result[nid] = { level: effectiveLevel, delay: propDelay }
      queue.push({ id: nid, hop: hop + 1 })
    })
  }
  return result
}

const STRESS_COLOR = {
  CRITICAL: '#ff4d6d',
  HIGH:     '#ff6b35',
  MEDIUM:   '#ffd60a',
  LOW:      '#00d4ff',
  STABLE:   '#1e3a5f',
}
const STRESS_GLOW = {
  CRITICAL: 'rgba(255,77,109,.8)',
  HIGH:     'rgba(255,107,53,.7)',
  MEDIUM:   'rgba(255,214,10,.6)',
  LOW:      'rgba(0,212,255,.4)',
  STABLE:   'rgba(0,212,255,.1)',
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function Network() {
  const [activeTab, setActiveTab] = useState('zones') // 'zones' | 'graph'
  const [cascade, setCascade]     = useState({})
  const [triggered, setTriggered] = useState([])
  const [hoveredId, setHoveredId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [animStep, setAnimStep]   = useState(0)
  const [running, setRunning]     = useState(false)
  const [pulseEdges, setPulseEdges] = useState([])
  const animRef = useRef(null)

  /* ── Start cascade from clicked zone ─────────────────────────── */
  const triggerCascade = useCallback((zoneId) => {
    const newTriggered = triggered.includes(zoneId)
      ? triggered.filter(id => id !== zoneId)
      : [...triggered, zoneId]

    setTriggered(newTriggered)
    setSelectedId(zoneId)

    if (newTriggered.length === 0) {
      setCascade({})
      setAnimStep(0)
      setRunning(false)
      setPulseEdges([])
      return
    }

    // Compute full cascade result
    const result = computeCascade(newTriggered, 4)
    setCascade(result)
    setAnimStep(0)
    setRunning(true)

    // Build propagating edge sequence for animation
    const adj = {}
    ZONES.forEach(z => { adj[z.id] = [] })
    EDGES.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a) })

    const visited = new Set(newTriggered)
    const edgeSeq = []
    const queue = newTriggered.map(id => ({ id, hop: 0 }))
    const hops = 4
    while (queue.length) {
      const { id, hop } = queue.shift()
      if (hop >= hops) continue
      adj[id].forEach(nid => {
        if (!visited.has(nid)) {
          visited.add(nid)
          edgeSeq.push({ from: id, to: nid, delay: hop })
          queue.push({ id: nid, hop: hop + 1 })
        }
      })
    }
    setPulseEdges([])

    // Animate edge pulses sequentially
    edgeSeq.forEach((e, i) => {
      setTimeout(() => {
        setPulseEdges(prev => [...prev, `${e.from}-${e.to}`])
      }, i * 320 + 200)
    })
  }, [triggered])

  const resetCascade = () => {
    setTriggered([])
    setCascade({})
    setAnimStep(0)
    setRunning(false)
    setPulseEdges([])
    setSelectedId(null)
  }

  /* Zone helpers */
  const getStress = (id) => cascade[id]?.level || 'STABLE'
  const getColor  = (id) => STRESS_COLOR[getStress(id)]
  const getGlow   = (id) => STRESS_GLOW[getStress(id)]
  const isTriggered = (id) => triggered.includes(id)
  const radius = (z) => Math.max(16, z.centrality * 30)

  /* edge pulse check */
  const edgePulsing = (a, b) =>
    pulseEdges.includes(`${a}-${b}`) || pulseEdges.includes(`${b}-${a}`)

  const selectedZone = selectedId ? ZONES.find(z => z.id === selectedId) : null

  /* Cascade stats */
  const critCount   = Object.values(cascade).filter(v => v.level === 'CRITICAL').length + triggered.length
  const highCount   = Object.values(cascade).filter(v => v.level === 'HIGH').length
  const medCount    = Object.values(cascade).filter(v => v.level === 'MEDIUM').length
  const totalAffect = Object.keys(cascade).length + triggered.length

  return (
    <div style={{
      width: '100vw', minHeight: '100vh',
      background: 'var(--deep)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, sans-serif',
      paddingTop: 'var(--nav-h)',
    }}>

      {/* ── Tab Bar ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '16px 24px 0',
        borderBottom: '1px solid rgba(0,212,255,.1)',
      }}>
        {[
          { key: 'zones', label: '🗺  Zone Map' },
          { key: 'graph', label: '🔗  Cascade Graph' },
          { key: 'geomap', label: '🌍  Geo Network Map' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '9px 22px',
              fontSize: 13, fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === t.key
                ? 'rgba(0,212,255,.12)'
                : 'rgba(255,255,255,.03)',
              color: activeTab === t.key
                ? 'var(--cyan)'
                : 'var(--t3)',
              borderBottom: activeTab === t.key
                ? '2px solid var(--cyan)'
                : '2px solid transparent',
              transition: 'all .2s',
              letterSpacing: '.3px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════
          TAB 1 — SVG Zones Map (existing)
      ════════════════════════════════════════════════════════ */}
      {activeTab === 'zones' && (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#e0e0e0',
          padding: 32,
          minHeight: 'calc(100vh - var(--nav-h) - 46px)',
        }}>
          <img
            src={indianRailwayZones}
            alt="Indian Railway Zones"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          TAB 2 — Cascade Graph
      ════════════════════════════════════════════════════════ */}
      {activeTab === 'graph' && (
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          gap: 0,
          minHeight: 'calc(100vh - var(--nav-h) - 46px)',
        }}>

          {/* ── SVG Canvas ────────────────────────────────────── */}
          <div style={{
            position: 'relative',
            background: 'var(--void)',
            overflow: 'hidden',
          }}>
            {/* Grid bg */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage:
                'linear-gradient(rgba(0,212,255,.018) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,.018) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
              pointerEvents: 'none',
            }} />

            {/* Instruction overlay (before any click) */}
            {triggered.length === 0 && (
              <div style={{
                position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(0,212,255,.08)',
                border: '1px solid rgba(0,212,255,.2)',
                borderRadius: 10, padding: '10px 20px',
                fontSize: 12, color: 'var(--cyan)',
                fontWeight: 600, letterSpacing: '.3px',
                zIndex: 10, whiteSpace: 'nowrap',
              }}>
                Click any zone node to trigger cascading failure simulation
              </div>
            )}

            <svg
              viewBox="0 0 800 580"
              style={{ width: '100%', height: '100%' }}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                {/* Glow filters */}
                {['red','orange','yellow','blue','dim'].map((name, i) => (
                  <filter key={name} id={`gf-${name}`} x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation={[10, 8, 7, 6, 3][i]} result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                ))}
                {/* Pulse animation gradient for edges */}
                <linearGradient id="pulse-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%"   stopColor="#ff4d6d" stopOpacity="0" />
                  <stop offset="50%"  stopColor="#ff4d6d" stopOpacity="1" />
                  <stop offset="100%" stopColor="#ffd60a" stopOpacity="0" />
                </linearGradient>
                <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="rgba(255,77,109,.6)" />
                </marker>
              </defs>

              {/* ── Edges ────────────────────────────────────── */}
              {EDGES.map(([a, b]) => {
                const za = ZONES.find(z => z.id === a)
                const zb = ZONES.find(z => z.id === b)
                const isPulse = edgePulsing(a, b)
                const aAffected = cascade[a] || triggered.includes(a)
                const bAffected = cascade[b] || triggered.includes(b)
                const bothAffected = aAffected && bAffected

                return (
                  <g key={`e-${a}-${b}`}>
                    {/* Base edge */}
                    <line
                      x1={za.cx} y1={za.cy} x2={zb.cx} y2={zb.cy}
                      stroke={bothAffected ? 'rgba(255,77,109,.3)' : 'rgba(0,212,255,.1)'}
                      strokeWidth={bothAffected ? 2 : 1}
                    />
                    {/* Pulse wave */}
                    {isPulse && (
                      <line
                        x1={za.cx} y1={za.cy} x2={zb.cx} y2={zb.cy}
                        stroke="url(#pulse-grad)"
                        strokeWidth={3}
                        strokeLinecap="round"
                        opacity={1}
                      >
                        <animate
                          attributeName="opacity"
                          values="1;0;0"
                          dur="1.2s"
                          fill="freeze"
                        />
                        <animateTransform
                          attributeName="gradientTransform"
                          type="translate"
                          from="-1 0" to="1 0"
                          dur="1.2s" fill="freeze"
                        />
                      </line>
                    )}
                    {/* Moving dot along edge for pulse */}
                    {isPulse && (() => {
                      const dx = zb.cx - za.cx
                      const dy = zb.cy - za.cy
                      return (
                        <circle r="4" fill="#ff4d6d" opacity="0.9" filter="url(#gf-red)">
                          <animateMotion
                            dur="0.9s"
                            fill="freeze"
                            path={`M${za.cx},${za.cy} L${zb.cx},${zb.cy}`}
                          />
                          <animate attributeName="opacity"
                            values="0.9;0" dur="0.9s" fill="freeze"
                          />
                        </circle>
                      )
                    })()}
                  </g>
                )
              })}

              {/* ── Zone Nodes ───────────────────────────────── */}
              {ZONES.map(zone => {
                const stress  = getStress(zone.id)
                const color   = getColor(zone.id)
                const glow    = getGlow(zone.id)
                const r       = radius(zone)
                const isTrig  = isTriggered(zone.id)
                const isHov   = hoveredId === zone.id
                const isCrit  = stress === 'CRITICAL'
                const filterMap = {
                  CRITICAL: 'url(#gf-red)',
                  HIGH:     'url(#gf-orange)',
                  MEDIUM:   'url(#gf-yellow)',
                  LOW:      'url(#gf-blue)',
                  STABLE:   'url(#gf-dim)',
                }

                return (
                  <g
                    key={zone.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => triggerCascade(zone.id)}
                    onMouseEnter={() => setHoveredId(zone.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Outer pulse ring for triggered nodes */}
                    {isTrig && (
                      <circle cx={zone.cx} cy={zone.cy} r={r + 12}
                        fill="none" stroke="#ff4d6d" strokeWidth="1.5" opacity=".4"
                      >
                        <animate attributeName="r"
                          from={r + 8} to={r + 24} dur="1.2s" repeatCount="indefinite" />
                        <animate attributeName="opacity"
                          from=".5" to="0" dur="1.2s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {/* Mid ring */}
                    <circle
                      cx={zone.cx} cy={zone.cy} r={r + 6}
                      fill="none"
                      stroke={color}
                      strokeWidth={isHov ? 1.5 : 0.8}
                      opacity={stress !== 'STABLE' ? 0.4 : 0.15}
                    />

                    {/* Main node fill */}
                    <circle
                      cx={zone.cx} cy={zone.cy} r={r}
                      fill={stress === 'STABLE' ? 'rgba(19,35,66,.8)' : `${color}22`}
                      stroke={color}
                      strokeWidth={isTrig ? 2.5 : isCrit ? 2 : 1.5}
                      filter={filterMap[stress]}
                    />

                    {/* Zone code label */}
                    <text
                      x={zone.cx} y={zone.cy + 1}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={r > 22 ? 11 : 9}
                      fontWeight="800"
                      fontFamily="JetBrains Mono, monospace"
                      fill={stress === 'STABLE' ? 'rgba(0,212,255,.7)' : color}
                    >
                      {zone.code}
                    </text>

                    {/* Number badge */}
                    <text
                      x={zone.cx + r - 4} y={zone.cy - r + 4}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize="8" fontWeight="700"
                      fontFamily="JetBrains Mono, monospace"
                      fill="rgba(226,234,242,.4)"
                    >
                      {zone.id}
                    </text>

                    {/* Delay badge for cascaded nodes */}
                    {cascade[zone.id] && !isTrig && (
                      <g>
                        <rect
                          x={zone.cx - 16} y={zone.cy + r + 4}
                          width="32" height="13" rx="6"
                          fill={`${color}cc`}
                        />
                        <text
                          x={zone.cx} y={zone.cy + r + 10.5}
                          textAnchor="middle" dominantBaseline="middle"
                          fontSize="7.5" fontWeight="700"
                          fontFamily="JetBrains Mono, monospace"
                          fill="black"
                        >
                          +{cascade[zone.id].delay}min
                        </text>
                      </g>
                    )}

                    {/* TRIGGER label */}
                    {isTrig && (
                      <text
                        x={zone.cx} y={zone.cy - r - 8}
                        textAnchor="middle"
                        fontSize="8" fontWeight="800"
                        fontFamily="Inter, sans-serif"
                        fill="#ff4d6d"
                        letterSpacing="1"
                      >
                        ▲ TRIGGER
                      </text>
                    )}

                    {/* Hover tooltip */}
                    {isHov && (
                      <g>
                        <rect
                          x={zone.cx + r + 8} y={zone.cy - 24}
                          width="140" height="48" rx="6"
                          fill="rgba(7,13,26,.95)"
                          stroke="rgba(0,212,255,.25)"
                          strokeWidth="1"
                        />
                        <text
                          x={zone.cx + r + 16} y={zone.cy - 10}
                          fontSize="9.5" fontWeight="700"
                          fontFamily="Inter, sans-serif"
                          fill="var(--t1, #e2eaf2)"
                        >
                          {zone.name.length > 20 ? zone.name.slice(0,20)+'…' : zone.name}
                        </text>
                        <text
                          x={zone.cx + r + 16} y={zone.cy + 3}
                          fontSize="8.5" fontFamily="Inter, sans-serif"
                          fill="rgba(125,154,181,.8)"
                        >
                          HQ: {zone.hq}
                        </text>
                        <text
                          x={zone.cx + r + 16} y={zone.cy + 16}
                          fontSize="8.5" fontFamily="JetBrains Mono, monospace"
                          fill={color}
                        >
                          Centrality: {(zone.centrality * 100).toFixed(0)}%
                        </text>
                      </g>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          {/* ── Right Sidebar ──────────────────────────────────── */}
          <div style={{
            background: 'rgba(7,13,26,.95)',
            borderLeft: '1px solid rgba(0,212,255,.1)',
            display: 'flex', flexDirection: 'column',
            overflowY: 'auto',
            padding: '20px 18px',
            gap: 18,
          }}>

            {/* Title */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'var(--cyan,#00d4ff)', textTransform: 'uppercase', marginBottom: 4 }}>
                Cascade Failure Engine
              </div>
              <div style={{ fontSize: 11, color: 'rgba(125,154,181,.7)', lineHeight: 1.5 }}>
                Click zone nodes to trigger cascading failures. Multi-select supported.
              </div>
            </div>

            {/* Stats */}
            {triggered.length > 0 && (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
              }}>
                {[
                  { label: 'Triggered', val: triggered.length, color: '#ff4d6d' },
                  { label: 'Affected',  val: totalAffect,       color: '#ff6b35' },
                  { label: 'Critical',  val: critCount,         color: '#ff4d6d' },
                  { label: 'High Risk', val: highCount,         color: '#ff6b35' },
                  { label: 'Medium',    val: medCount,          color: '#ffd60a' },
                  { label: 'Reach',     val: `${Math.round((totalAffect/17)*100)}%`, color: '#00d4ff' },
                ].map(s => (
                  <div key={s.label} style={{
                    background: 'rgba(0,0,0,.3)', border: '1px solid rgba(0,212,255,.08)',
                    borderRadius: 8, padding: '10px 12px',
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(125,154,181,.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: 'JetBrains Mono, monospace' }}>
                      {s.val}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Selected zone detail */}
            {selectedZone && (
              <div style={{
                background: 'rgba(0,0,0,.3)',
                border: `1px solid ${STRESS_COLOR[getStress(selectedZone.id)]}44`,
                borderLeft: `3px solid ${STRESS_COLOR[getStress(selectedZone.id)]}`,
                borderRadius: 8, padding: '14px 14px',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: STRESS_COLOR[getStress(selectedZone.id)], textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  {isTriggered(selectedZone.id) ? '⚡ Failure Origin' : 'Cascaded Zone'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#e2eaf2', marginBottom: 4 }}>
                  {selectedZone.name}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(125,154,181,.7)', marginBottom: 10 }}>
                  HQ: {selectedZone.hq} · Code: {selectedZone.code}
                </div>
                {[
                  ['Status',      getStress(selectedZone.id), STRESS_COLOR[getStress(selectedZone.id)]],
                  ['Centrality',  `${(selectedZone.centrality*100).toFixed(0)}%`, 'var(--cyan,#00d4ff)'],
                  ['Cascade Delay', cascade[selectedZone.id] ? `+${cascade[selectedZone.id].delay} min` : (isTriggered(selectedZone.id) ? 'Origin' : '—'), '#e2eaf2'],
                ].map(([label, val, col]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7, fontSize: 11 }}>
                    <span style={{ color: 'rgba(125,154,181,.6)' }}>{label}</span>
                    <span style={{ fontWeight: 700, color: col, fontFamily: 'JetBrains Mono, monospace' }}>{val}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Affected zones list */}
            {triggered.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(125,154,181,.5)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Affected Zones
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 240, overflowY: 'auto' }}>
                  {ZONES
                    .filter(z => cascade[z.id] || triggered.includes(z.id))
                    .sort((a, b) => {
                      const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
                      return (order[getStress(a.id)] ?? 9) - (order[getStress(b.id)] ?? 9)
                    })
                    .map(zone => {
                      const stress = getStress(zone.id)
                      const col    = STRESS_COLOR[stress]
                      return (
                        <div
                          key={zone.id}
                          onClick={() => setSelectedId(zone.id)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '7px 10px', borderRadius: 6,
                            background: selectedId === zone.id ? `${col}15` : 'rgba(0,0,0,.2)',
                            border: `1px solid ${selectedId === zone.id ? col+'55' : 'rgba(0,212,255,.06)'}`,
                            cursor: 'pointer', transition: 'all .15s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: col, boxShadow: `0 0 6px ${col}` }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#e2eaf2' }}>{zone.code}</span>
                            <span style={{ fontSize: 9, color: 'rgba(125,154,181,.6)' }}>{zone.name.split(' ').slice(0,2).join(' ')}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {cascade[zone.id] && (
                              <span style={{ fontSize: 9, color: 'rgba(125,154,181,.5)', fontFamily: 'JetBrains Mono, monospace' }}>
                                +{cascade[zone.id].delay}m
                              </span>
                            )}
                            <span style={{ fontSize: 8, fontWeight: 800, color: col, background: `${col}22`, padding: '2px 6px', borderRadius: 4 }}>
                              {stress}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  }
                </div>
              </div>
            )}

            {/* Legend */}
            <div style={{
              background: 'rgba(0,0,0,.2)', border: '1px solid rgba(0,212,255,.06)',
              borderRadius: 8, padding: '12px 14px',
              marginTop: 'auto',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(125,154,181,.5)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
                Stress Legend
              </div>
              {[
                ['CRITICAL', '#ff4d6d', 'Failure origin node'],
                ['HIGH',     '#ff6b35', 'Direct neighbour cascade'],
                ['MEDIUM',   '#ffd60a', 'Secondary propagation'],
                ['LOW',      '#00d4ff', 'Tertiary / distal effect'],
                ['STABLE',   '#1e3a5f', 'Unaffected'],
              ].map(([label, col, desc]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: col, boxShadow: `0 0 7px ${col}`, flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: col }}>{label}</span>
                    <span style={{ fontSize: 9, color: 'rgba(125,154,181,.5)', marginLeft: 6 }}>{desc}</span>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: '1px solid rgba(0,212,255,.06)', marginTop: 8, paddingTop: 8, fontSize: 9, color: 'rgba(125,154,181,.4)', lineHeight: 1.5 }}>
                Node size = betweenness centrality<br />
                Moving dots = failure wave propagation
              </div>
            </div>

            {/* Reset button */}
            {triggered.length > 0 && (
              <button
                onClick={resetCascade}
                style={{
                  padding: '10px', borderRadius: 8, border: '1px solid rgba(255,77,109,.3)',
                  background: 'rgba(255,77,109,.08)', color: '#ff4d6d',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  transition: 'all .2s', letterSpacing: '.3px',
                }}
              >
                🔄 Reset Cascade
              </button>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          TAB 3 — Geo Network Map (Leaflet)
      ════════════════════════════════════════════════════════ */}
      {activeTab === 'geomap' && (
        <div style={{
          flex: 1, display: 'flex',
          minHeight: 'calc(100vh - var(--nav-h) - 46px)',
          position: 'relative',
        }}>
          {/* ── Leaflet Map ───────────────────────────────────── */}
          <div style={{ flex: 1, position: 'relative' }}>
            <MapContainer
              center={[22.5, 80.5]}
              zoom={5}
              minZoom={4}
              maxZoom={10}
              maxBounds={[[5.0, 63.0], [38.0, 100.0]]}
              maxBoundsViscosity={0.8}
              style={{ height: '100%', width: '100%', background: '#02040f' }}
              zoomControl={true}
            >
              {/* Dark CartoDB tiles */}
              <TileLayer
                url={CARTO_DARK_TILES}
                attribution="&copy; CARTO &copy; OSM"
              />

              {/* ── Zone adjacency edges ── */}
              {EDGES.map(([a, b]) => {
                const za = ZONES.find(z => z.id === a)
                const zb = ZONES.find(z => z.id === b)
                const aAff = cascade[a] || triggered.includes(a)
                const bAff = cascade[b] || triggered.includes(b)
                const bothAff = aAff && bAff
                const aPulsing = pulseEdges.includes(`${a}-${b}`) || pulseEdges.includes(`${b}-${a}`)

                // Color edge by worst of the two endpoints
                const worstLevel = (() => {
                  const lvA = cascade[a]?.level || (triggered.includes(a) ? 'CRITICAL' : 'STABLE')
                  const lvB = cascade[b]?.level || (triggered.includes(b) ? 'CRITICAL' : 'STABLE')
                  const rank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, STABLE: 0 }
                  return rank[lvA] >= rank[lvB] ? lvA : lvB
                })()

                const edgeColor = {
                  CRITICAL: '#ff4d6d', HIGH: '#ff6b35', MEDIUM: '#ffd60a',
                  LOW: '#00d4ff', STABLE: 'rgba(0,212,255,.18)',
                }[worstLevel]

                return (
                  <Polyline
                    key={`geo-e-${a}-${b}`}
                    positions={[[za.lat, za.lng], [zb.lat, zb.lng]]}
                    pathOptions={{
                      color: edgeColor,
                      weight: bothAff ? (aPulsing ? 4 : 2.5) : 1.2,
                      opacity: bothAff ? 0.85 : 0.3,
                      dashArray: worstLevel === 'STABLE' ? '4 6' : undefined,
                    }}
                  />
                )
              })}

              {/* ── Zone nodes ── */}
              {ZONES.map(zone => {
                const stress  = getStress(zone.id)
                const color   = getColor(zone.id)
                const isTrig  = isTriggered(zone.id)
                const r = Math.max(10, zone.centrality * 22)

                return (
                  <CircleMarker
                    key={zone.id}
                    center={[zone.lat, zone.lng]}
                    radius={r}
                    pathOptions={{
                      color,
                      fillColor: stress === 'STABLE' ? 'rgba(19,35,66,.9)' : color,
                      fillOpacity: stress === 'STABLE' ? 0.6 : isTrig ? 0.9 : 0.55,
                      weight: isTrig ? 3 : stress !== 'STABLE' ? 2 : 1.2,
                      opacity: 1,
                    }}
                    eventHandlers={{ click: () => triggerCascade(zone.id) }}
                  >
                    <Tooltip
                      permanent
                      direction="center"
                      className="zone-label-tooltip"
                      offset={[0, 0]}
                    >
                      <span style={{
                        fontSize: zone.centrality > 0.7 ? 9 : 8,
                        fontWeight: 800,
                        fontFamily: 'JetBrains Mono, monospace',
                        color: stress === 'STABLE' ? 'rgba(0,212,255,.8)' : color,
                      }}>
                        {zone.code}
                      </span>
                    </Tooltip>
                    <Tooltip
                      direction="top"
                      offset={[0, -(r + 6)]}
                      opacity={1}
                    >
                      <div style={{ fontFamily: 'Inter, sans-serif', padding: '2px 0' }}>
                        <div style={{ fontWeight: 800, fontSize: 12, color: color }}>
                          {zone.code} — {zone.name}
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                          HQ: {zone.hq}
                        </div>
                        <div style={{ fontSize: 10, marginTop: 2 }}>
                          Status: <strong style={{ color }}>{stress}</strong>
                          {cascade[zone.id] && (
                            <> · Delay: <strong style={{ color }}>
                              +{cascade[zone.id].delay} min
                            </strong></>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                          Centrality: {(zone.centrality * 100).toFixed(0)}%
                          {isTrig ? ' · ⚡ FAILURE ORIGIN' : ''}
                        </div>
                        <div style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>
                          Click to {isTrig ? 'remove' : 'add'} trigger
                        </div>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                )
              })}
            </MapContainer>

            {/* ── Top-left instruction/status ── */}
            <div style={{
              position: 'absolute', top: 16, left: 16, zIndex: 1000,
              background: 'rgba(7,13,26,.92)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(0,212,255,.2)',
              borderRadius: 10, padding: '12px 16px',
              maxWidth: 260,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan,#00d4ff)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
                Geo Cascade Network
              </div>
              {triggered.length === 0 ? (
                <div style={{ fontSize: 11, color: 'rgba(125,154,181,.7)', lineHeight: 1.5 }}>
                  Click any HQ node on the map to trigger a cascading failure across zones.
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                    {[
                      ['Triggered', triggered.length, '#ff4d6d'],
                      ['Affected',  totalAffect,       '#ff6b35'],
                      ['Critical',  critCount,         '#ff4d6d'],
                      ['Reach',     `${Math.round((totalAffect/17)*100)}%`, '#00d4ff'],
                    ].map(([l, v, c]) => (
                      <div key={l} style={{ background: 'rgba(0,0,0,.3)', borderRadius: 6, padding: '6px 8px' }}>
                        <div style={{ fontSize: 8, color: 'rgba(125,154,181,.5)', textTransform: 'uppercase', letterSpacing: 1 }}>{l}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: c, fontFamily: 'JetBrains Mono, monospace' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={resetCascade}
                    style={{
                      width: '100%', padding: '7px', borderRadius: 6,
                      border: '1px solid rgba(255,77,109,.3)',
                      background: 'rgba(255,77,109,.08)', color: '#ff4d6d',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    🔄 Reset Cascade
                  </button>
                </>
              )}
            </div>

            {/* ── Bottom-left legend ── */}
            <div style={{
              position: 'absolute', bottom: 32, left: 16, zIndex: 1000,
              background: 'rgba(7,13,26,.92)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(0,212,255,.1)',
              borderRadius: 10, padding: '12px 16px',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(125,154,181,.4)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
                Zone Stress
              </div>
              {[
                ['#ff4d6d', 'CRITICAL — Origin'],
                ['#ff6b35', 'HIGH — Direct cascade'],
                ['#ffd60a', 'MEDIUM — Secondary'],
                ['#00d4ff', 'LOW — Distal'],
                ['#1e3a5f', 'STABLE'],
              ].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c, boxShadow: `0 0 6px ${c}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: 'rgba(226,234,242,.7)' }}>{l}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid rgba(0,212,255,.06)', marginTop: 6, paddingTop: 6, fontSize: 9, color: 'rgba(125,154,181,.4)', lineHeight: 1.5 }}>
                Node size = betweenness centrality<br />
                Edges = inter-zone adjacency
              </div>
            </div>

            {/* ── Affected zones list (bottom-right) ── */}
            {triggered.length > 0 && (
              <div style={{
                position: 'absolute', bottom: 32, right: 16, zIndex: 1000,
                width: 280,
                background: 'rgba(7,13,26,.94)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(0,212,255,.15)',
                borderRadius: 10, padding: '12px',
                maxHeight: 340, display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(125,154,181,.45)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, flexShrink: 0 }}>
                  Affected Zones
                </div>
                <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {ZONES
                    .filter(z => cascade[z.id] || triggered.includes(z.id))
                    .sort((a, b) => {
                      const o = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
                      return (o[getStress(a.id)] ?? 9) - (o[getStress(b.id)] ?? 9)
                    })
                    .map(zone => {
                      const stress = getStress(zone.id)
                      const col = STRESS_COLOR[stress]
                      return (
                        <div
                          key={zone.id}
                          onClick={() => { triggerCascade(zone.id) }}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                            background: 'rgba(0,0,0,.25)', border: `1px solid ${col}33`,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: col, boxShadow: `0 0 5px ${col}` }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#e2eaf2' }}>{zone.code}</span>
                            <span style={{ fontSize: 9, color: 'rgba(125,154,181,.55)' }}>{zone.hq}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {cascade[zone.id] && (
                              <span style={{ fontSize: 9, color: 'rgba(125,154,181,.5)', fontFamily: 'JetBrains Mono, monospace' }}>+{cascade[zone.id].delay}m</span>
                            )}
                            <span style={{ fontSize: 8, fontWeight: 800, color: col, background: `${col}22`, padding: '2px 5px', borderRadius: 3 }}>
                              {stress}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
