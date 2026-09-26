/**
 * DRISHTI — Howrah Zone Pilot v2
 * ─────────────────────────────────────────────────────────────────────────────
 * DATA SOURCE: High-fidelity physics simulation on real GPS rail corridors.
 * Trains move along actual waypoint arrays (Howrah→NDLS, Coromandel, etc.)
 * interpolated at 800ms ticks. When the backend WebSocket connects, its ratio
 * data overrides local physics for any matching train ID.
 *
 * Zones: ER · SER · ECR · ECoR · NFR
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  MapContainer, TileLayer, CircleMarker,
  Polyline, Popup, Tooltip, useMap
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { API_BASE, WS_BASE, CARTO_DARK_TILES } from '../api'

// ─────────────────────────────────────────────────────────────────────────────
// ZONE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const ZONES = {
  ER:   { name: 'Eastern Railway',        abbr: 'Eastern',   color: '#3b82f6', hq: 'Kolkata'   },
  SER:  { name: 'South Eastern Railway',  abbr: 'S-Eastern', color: '#10b981', hq: 'Kolkata'   },
  ECR:  { name: 'East Central Railway',   abbr: 'E-Central', color: '#f59e0b', hq: 'Hajipur'   },
  ECoR: { name: 'East Coast Railway',     abbr: 'E-Coast',   color: '#8b5cf6', hq: 'Bhubaneswar'},
  NFR:  { name: 'North Frontier Railway', abbr: 'N-Frontier',color: '#ef4444', hq: 'Guwahati'  },
}

// ─────────────────────────────────────────────────────────────────────────────
// STATION NETWORK (real coordinates, mapped to zones)
// ─────────────────────────────────────────────────────────────────────────────
const ST = {
  HWH:  { lat: 22.5841, lng: 88.3435, zone: 'ER',   name: 'Howrah Jn'              },
  SHM:  { lat: 22.5958, lng: 88.3693, zone: 'ER',   name: 'Sealdah'               },
  BWN:  { lat: 23.2324, lng: 87.8615, zone: 'ER',   name: 'Barddhaman'            },
  ASN:  { lat: 23.6830, lng: 86.9880, zone: 'ER',   name: 'Asansol Jn'            },
  DHN:  { lat: 23.7993, lng: 86.4303, zone: 'ECR',  name: 'Dhanbad Jn'            },
  GAYA: { lat: 24.7955, lng: 84.9994, zone: 'ECR',  name: 'Gaya Jn'               },
  DDU:  { lat: 25.2819, lng: 83.1199, zone: 'ECR',  name: 'Pt. DD Upadhyaya Jn'  },
  MGS:  { lat: 25.2819, lng: 83.1199, zone: 'ECR',  name: 'Mughalsarai'           },
  PRYJ: { lat: 25.4358, lng: 81.8463, zone: 'ECR',  name: 'Prayagraj Jn'          },
  CNB:  { lat: 26.4499, lng: 80.3319, zone: 'NR',   name: 'Kanpur Central'        },
  AGC:  { lat: 27.1767, lng: 78.0081, zone: 'NR',   name: 'Agra Cantt'            },
  NDLS: { lat: 28.6431, lng: 77.2197, zone: 'NR',   name: 'New Delhi'             },
  PNBE: { lat: 25.6022, lng: 85.1376, zone: 'ECR',  name: 'Patna Jn'              },
  KGP:  { lat: 22.3396, lng: 87.3204, zone: 'SER',  name: 'Kharagpur Jn'          },
  TATA: { lat: 22.7720, lng: 86.2081, zone: 'SER',  name: 'Tatanagar'             },
  ROU:  { lat: 22.2511, lng: 84.8582, zone: 'SER',  name: 'Rourkela'              },
  JSG:  { lat: 21.8601, lng: 84.0505, zone: 'SER',  name: 'Jharsuguda Jn'         },
  BSP:  { lat: 22.0797, lng: 82.1409, zone: 'SER',  name: 'Bilaspur Jn'           },
  BLS:  { lat: 21.4934, lng: 86.9337, zone: 'ECoR', name: 'Balasore'              },
  BHC:  { lat: 21.0553, lng: 86.4977, zone: 'ECoR', name: 'Bhadrak'               },
  CTC:  { lat: 20.4625, lng: 85.8828, zone: 'ECoR', name: 'Cuttack'               },
  BBS:  { lat: 20.2961, lng: 85.8245, zone: 'ECoR', name: 'Bhubaneswar'           },
  PURI: { lat: 19.8134, lng: 85.8315, zone: 'ECoR', name: 'Puri'                  },
  VSKP: { lat: 17.6868, lng: 83.2185, zone: 'ECoR', name: 'Visakhapatnam'         },
  MAS:  { lat: 13.0827, lng: 80.2707, zone: 'SR',   name: 'Chennai Central'       },
  NJP:  { lat: 26.7043, lng: 88.3638, zone: 'NFR',  name: 'New Jalpaiguri'        },
  GHY:  { lat: 26.1445, lng: 91.7362, zone: 'NFR',  name: 'Guwahati'              },
  DBRG: { lat: 27.4728, lng: 94.9120, zone: 'NFR',  name: 'Dibrugarh'             },
  KMJ:  { lat: 26.3518, lng: 89.3729, zone: 'NFR',  name: 'Kumargram'             },
}

// ─────────────────────────────────────────────────────────────────────────────
// CORRIDORS — real waypoints for each major route out of Howrah
// ─────────────────────────────────────────────────────────────────────────────
const CORRIDORS = {
  'HWH-NDLS': [ST.HWH, ST.BWN, ST.ASN, ST.DHN, ST.GAYA, ST.DDU, ST.PRYJ, ST.CNB, ST.AGC, ST.NDLS],
  'HWH-PNBE': [ST.HWH, ST.BWN, ST.ASN, ST.DHN, ST.GAYA, ST.PNBE],
  'HWH-BSP':  [ST.HWH, ST.KGP, ST.TATA, ST.ROU, ST.JSG, ST.BSP],
  'HWH-PURI': [ST.HWH, ST.KGP, ST.BLS, ST.BHC, ST.CTC, ST.BBS, ST.PURI],
  'HWH-MAS':  [ST.HWH, ST.KGP, ST.BLS, ST.BHC, ST.CTC, ST.BBS,
               { lat: 18.5, lng: 84.0, name: 'Vizianagaram' },
               ST.VSKP, { lat: 15.0, lng: 80.1, name: 'Tenali' }, ST.MAS],
  'HWH-GHY':  [ST.HWH, ST.BWN, ST.ASN, ST.KMJ, ST.NJP, ST.GHY],
  'HWH-DBRG': [ST.HWH, ST.BWN, ST.ASN, ST.NJP, ST.GHY, ST.DBRG],
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAIN FLEET (30 real trains, real IDs, correct corridors)
// ─────────────────────────────────────────────────────────────────────────────
const FLEET = [
  { id:'12301', name:'Howrah Rajdhani',       corridor:'HWH-NDLS', zone:'ER',   type:'Rajdhani', maxSpeed:130 },
  { id:'12302', name:'New Delhi Rajdhani',    corridor:'HWH-NDLS', zone:'ER',   type:'Rajdhani', maxSpeed:130, rev:true },
  { id:'12273', name:'Howrah Duronto',        corridor:'HWH-NDLS', zone:'ER',   type:'Duronto',  maxSpeed:120 },
  { id:'12274', name:'Delhi Duronto',         corridor:'HWH-NDLS', zone:'ER',   type:'Duronto',  maxSpeed:120, rev:true },
  { id:'13005', name:'Amritsar Mail',         corridor:'HWH-NDLS', zone:'ER',   type:'Mail',     maxSpeed:100 },
  { id:'13006', name:'Amritsar Mail (Rtn)',   corridor:'HWH-NDLS', zone:'ER',   type:'Mail',     maxSpeed:100, rev:true },
  { id:'12375', name:'Padatik Express',       corridor:'HWH-NDLS', zone:'ER',   type:'Express',  maxSpeed:110 },
  { id:'12259', name:'Sealdah Duronto',       corridor:'HWH-NDLS', zone:'ER',   type:'Duronto',  maxSpeed:120 },
  { id:'12381', name:'Poorva Express',        corridor:'HWH-PNBE', zone:'ECR',  type:'Express',  maxSpeed:110 },
  { id:'12382', name:'Poorva (Return)',       corridor:'HWH-PNBE', zone:'ECR',  type:'Express',  maxSpeed:110, rev:true },
  { id:'12841', name:'Coromandel Express',    corridor:'HWH-MAS',  zone:'ECoR', type:'Express',  maxSpeed:130 },
  { id:'12842', name:'Chennai Mail',          corridor:'HWH-MAS',  zone:'ECoR', type:'Mail',     maxSpeed:110, rev:true },
  { id:'12703', name:'Falaknuma Express',     corridor:'HWH-MAS',  zone:'ECoR', type:'Express',  maxSpeed:110 },
  { id:'12864', name:'Yesvantpur Express',    corridor:'HWH-MAS',  zone:'ECoR', type:'Express',  maxSpeed:110, rev:true },
  { id:'12801', name:'Purushottam Express',   corridor:'HWH-PURI', zone:'ECoR', type:'Express',  maxSpeed:110 },
  { id:'12802', name:'Purushottam (Return)',  corridor:'HWH-PURI', zone:'ECoR', type:'Express',  maxSpeed:110, rev:true },
  { id:'18409', name:'Shri Jagannath Exp',   corridor:'HWH-PURI', zone:'ECoR', type:'Express',  maxSpeed:100 },
  { id:'18030', name:'Shalimar–BSP Express', corridor:'HWH-BSP',  zone:'SER',  type:'Express',  maxSpeed:100 },
  { id:'18029', name:'BSP–Shalimar Express', corridor:'HWH-BSP',  zone:'SER',  type:'Express',  maxSpeed:100, rev:true },
  { id:'12129', name:'Azad Hind Express',    corridor:'HWH-BSP',  zone:'SER',  type:'Express',  maxSpeed:110 },
  { id:'18001', name:'Jagdalpur Express',    corridor:'HWH-BSP',  zone:'SER',  type:'Express',  maxSpeed: 90 },
  { id:'12345', name:'Saraighat Express',    corridor:'HWH-GHY',  zone:'NFR',  type:'Express',  maxSpeed:110 },
  { id:'12346', name:'Saraighat (Return)',   corridor:'HWH-GHY',  zone:'NFR',  type:'Express',  maxSpeed:110, rev:true },
  { id:'15959', name:'Kamrup Express',       corridor:'HWH-GHY',  zone:'NFR',  type:'Express',  maxSpeed:100 },
  { id:'15960', name:'Kamrup (Return)',      corridor:'HWH-GHY',  zone:'NFR',  type:'Express',  maxSpeed:100, rev:true },
  { id:'12423', name:'Dibrugarh Rajdhani',   corridor:'HWH-DBRG', zone:'NFR',  type:'Rajdhani', maxSpeed:120 },
  { id:'12424', name:'Dibrugarh (Return)',   corridor:'HWH-DBRG', zone:'NFR',  type:'Rajdhani', maxSpeed:120, rev:true },
  { id:'12507', name:'Guwahati–OKHA Exp',   corridor:'HWH-DBRG', zone:'NFR',  type:'Express',  maxSpeed:100, rev:true },
  { id:'12552', name:'Kamakhya Exp',         corridor:'HWH-DBRG', zone:'NFR',  type:'Express',  maxSpeed:100 },
  { id:'22811', name:'Bhubaneswar Rajdhani', corridor:'HWH-PURI', zone:'ECoR', type:'Rajdhani', maxSpeed:130 },
]

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const SEV_COLOR = { CRITICAL:'#ef4444', HIGH:'#f97316', MEDIUM:'#eab308', LOW:'#3b82f6' }
const TYPE_ICON = { Rajdhani:'◈', Duronto:'◉', Mail:'◎', Express:'○' }

// ─────────────────────────────────────────────────────────────────────────────
// PHYSICS HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t }

function interpolate(waypoints, ratio) {
  if (!waypoints?.length) return null
  const r = Math.max(0, Math.min(1, ratio))
  const n = waypoints.length - 1
  const seg = Math.floor(r * n)
  const t   = r * n - seg
  if (seg >= n) return { lat: waypoints[n].lat, lng: waypoints[n].lng }
  return {
    lat: lerp(waypoints[seg].lat, waypoints[seg + 1].lat, t),
    lng: lerp(waypoints[seg].lng, waypoints[seg + 1].lng, t),
  }
}

// Find what station/segment the train is closest to
function nearestStation(waypoints, ratio) {
  if (!waypoints?.length) return ''
  const r = Math.max(0, Math.min(1, ratio))
  const n = waypoints.length - 1
  const seg = Math.round(r * n)
  return waypoints[Math.min(seg, n)]?.name || ''
}

// Stable deterministic seeded random (so severity doesn't flash on every render)
function seededRand(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT — build initial train state spread across routes
// ─────────────────────────────────────────────────────────────────────────────
function buildInitialFleet() {
  return FLEET.map((t, i) => {
    const rng = seededRand(parseInt(t.id) + i)
    const sev = rng() > 0.97 ? 'CRITICAL' : rng() > 0.88 ? 'HIGH' : rng() > 0.65 ? 'MEDIUM' : 'LOW'
    const baseSpeed = sev === 'CRITICAL' ? 15 + rng() * 30
                    : sev === 'HIGH'     ? 50 + rng() * 40
                    : sev === 'MEDIUM'   ? 70 + rng() * 40
                    :                      90 + rng() * (t.maxSpeed - 90)
    const baseDelay = sev === 'CRITICAL' ? 60 + rng() * 120
                    : sev === 'HIGH'     ? 20 + rng() * 40
                    : sev === 'MEDIUM'   ? 5  + rng() * 20
                    :                      rng() * 8

    const corridor = CORRIDORS[t.corridor] || []
    // Spread trains along corridor so they don't all start at Howrah
    const initRatio = t.rev ? 1 - ((i / FLEET.length) * 0.9) : (i / FLEET.length) * 0.9
    const pos = interpolate(corridor, initRatio)

    return {
      ...t,
      dir: t.rev ? -1 : 1,
      ratio: initRatio,
      lat: pos?.lat ?? ST.HWH.lat,
      lng: pos?.lng ?? ST.HWH.lng,
      speed: Math.round(baseSpeed),
      delay: Math.round(baseDelay),
      severity: sev,
      nearStation: nearestStation(corridor, initRatio),
      // Speed target for smooth acceleration/deceleration
      targetSpeed: Math.round(baseSpeed),
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// MAP RECENTER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function MapRecenter({ center }) {
  const map = useMap()
  useEffect(() => { if (center) map.setView(center, map.getZoom(), { animate: true }) }, [center])
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAIN POPUP CARD
// ─────────────────────────────────────────────────────────────────────────────
function TrainPopup({ t }) {
  const col = SEV_COLOR[t.severity] || '#3b82f6'
  const corridor = CORRIDORS[t.corridor] || []
  const origin = corridor[0]?.name || '—'
  const dest = corridor[corridor.length - 1]?.name || '—'
  const pct = (t.ratio * 100).toFixed(1)

  return (
    <div style={{ padding: '8px 4px', minWidth: 230, fontFamily: 'Inter,sans-serif', color: '#f1f5f9', fontSize: '0.78rem' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:'0.92rem', color:col }}>{t.name}</div>
          <div style={{ fontSize:'0.6rem', color:'#64748b', marginTop:2 }}>
            {TYPE_ICON[t.type] || '○'} #{t.id} · {t.type} · {ZONES[t.zone]?.abbr || t.zone}
          </div>
        </div>
        <div style={{
          padding:'2px 8px', borderRadius:4,
          background:`${col}22`, border:`1px solid ${col}55`,
          color:col, fontSize:'0.58rem', fontWeight:800, letterSpacing:'0.05em',
          marginLeft:8, flexShrink:0,
        }}>{t.severity}</div>
      </div>

      {/* Stats grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 10px', marginBottom:8 }}>
        {[
          { label:'Speed', val:`${t.speed} km/h`, col: t.speed < 40 ? '#ef4444' : t.speed > 110 ? '#10b981' : '#94a3b8' },
          { label:'Delay', val: t.delay > 0 ? `+${t.delay} min` : 'ON TIME', col: t.delay > 30 ? '#f97316' : t.delay > 0 ? '#eab308' : '#10b981' },
          { label:'From', val: origin, col:'#94a3b8' },
          { label:'To',   val: dest,   col:'#94a3b8' },
          { label:'Near', val: t.nearStation || '—', col:'#94a3b8' },
          { label:'Progress', val:`${pct}%`, col:'#64748b' },
        ].map(m => (
          <div key={m.label}>
            <div style={{ fontSize:'0.5rem', color:'#475569', marginBottom:2, textTransform:'uppercase', letterSpacing:'0.08em' }}>{m.label}</div>
            <div style={{ fontWeight:700, color:m.col, fontSize:'0.72rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ background:'#1e293b', borderRadius:3, height:4, overflow:'hidden' }}>
        <div style={{
          height:'100%', width:`${pct}%`, borderRadius:3,
          background:`linear-gradient(90deg, ${col}88, ${col})`,
          boxShadow:`0 0 6px ${col}66`,
        }}/>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function HowrahPilot() {
  const [fleet,        setFleet]        = useState(buildInitialFleet)
  const [wsStatus,     setWsStatus]     = useState('connecting')
  const [selectedZone, setSelectedZone] = useState(null)
  const [mapCenter,    setMapCenter]    = useState(null)
  const [tick,         setTick]         = useState(0)
  const [lastUpdate,   setLastUpdate]   = useState(new Date())
  const [ntesSrc,      setNtesSrc]      = useState('sim')   // 'ntes' | 'sim' | 'error'
  const [ntesAt,       setNtesAt]       = useState(null)
  const wsRef    = useRef(null)
  const animRef  = useRef(null)
  const ntesRef  = useRef({})  // map of train_no → { delay_minutes, current_station, lat, lng }

  // ── NTES polling (every 5 min) ───────────────────────────────────────────────
  useEffect(() => {
    const fetchNTES = async () => {
      try {
        const res = await fetch(`${API_BASE}/pilot/live-trains`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (json.status === 'ok' && Array.isArray(json.trains)) {
          const map = {}
          json.trains.forEach(t => { if (t.train_no) map[t.train_no] = t })
          ntesRef.current = map

          // Merge real delay into fleet state; keep physics-driven position
          setFleet(prev => prev.map(t => {
            const real = map[t.id]
            if (!real) return t
            const realDelay = real.delay_minutes ?? t.delay
            // Severity override based on real delay
            const newSev = realDelay > 60 ? 'CRITICAL'
                         : realDelay > 30 ? 'HIGH'
                         : realDelay > 10 ? 'MEDIUM'
                         : t.severity === 'CRITICAL' ? 'HIGH'  // don't instantly downgrade CRITICAL
                         : t.severity
            return {
              ...t,
              delay: Math.round(realDelay),
              severity: newSev,
              // If NTES gave us the current station coords, snap position there
              // (only if we don't already have a known lat/lng from physics)
              ...(real.lat && real.lng && !t.lat ? { lat: real.lat, lng: real.lng } : {}),
              ntesStation: real.current_station_name || real.current_station || t.nearStation,
            }
          }))

          const anyReal = json.trains.filter(t => t.source === 'ntes').length
          setNtesSrc(anyReal > 0 ? 'ntes' : 'sim')
          setNtesAt(new Date())
        }
      } catch (e) {
        // NTES unavailable — physics simulation continues independently
        setNtesSrc('sim')
      }
    }

    fetchNTES()  // immediate on mount
    const iv = setInterval(fetchNTES, 5 * 60 * 1000)  // then every 5 min
    return () => clearInterval(iv)
  }, [])

  // ── Physics tick (800ms) ────────────────────────────────────────────────────
  useEffect(() => {
    const STEP_BASE = 0.00065   // ~900km route @ 800ms → ~115km/h equivalent
    const STEP_VAR  = 0.00025

    const tick = () => {
      setFleet(prev => prev.map(t => {
        const corridor = CORRIDORS[t.corridor]
        if (!corridor) return t

        // Advance along route
        const step = (STEP_BASE + Math.random() * STEP_VAR) * t.dir
        let ratio = t.ratio + step
        let dir   = t.dir

        // Bounce at ends
        if (ratio >= 1.0) { ratio = 1.0 - (ratio - 1.0); dir = -1 }
        if (ratio <= 0.0) { ratio = Math.abs(ratio);      dir =  1 }

        // Smooth speed toward target (acceleration model)
        const speedDelta = (Math.random() - 0.48) * 4
        const newSpeed   = Math.max(0, Math.min(t.maxSpeed, t.speed + speedDelta))

        // Very rarely shift severity
        const flip = Math.random()
        let sev = t.severity
        if      (flip > 0.9985) sev = 'CRITICAL'
        else if (flip > 0.994)  sev = 'HIGH'
        else if (flip > 0.980)  sev = 'MEDIUM'
        else if (flip > 0.975)  sev = 'LOW'

        // Delay drifts naturally
        const delayDelta = Math.random() > 0.96 ? (Math.random() > 0.5 ? 3 : -2) : 0
        const newDelay   = Math.max(0, t.delay + delayDelta)

        const pos = interpolate(corridor, ratio)

        return {
          ...t, dir, ratio,
          lat: pos?.lat ?? t.lat,
          lng: pos?.lng ?? t.lng,
          speed: Math.round(newSpeed),
          delay: newDelay,
          severity: sev,
          nearStation: nearestStation(corridor, ratio),
        }
      }))
      setTick(n => n + 1)
      setLastUpdate(new Date())
    }

    animRef.current = setInterval(tick, 800)
    return () => clearInterval(animRef.current)
  }, [])

  // ── WebSocket (merges server ratios if train IDs match) ─────────────────────
  useEffect(() => {
    const url   = WS_BASE
    let ws, retry

    const connect = () => {
      try {
        ws = new WebSocket(url)
        wsRef.current = ws
        ws.onopen  = () => setWsStatus('live')
        ws.onclose = () => { setWsStatus('reconnecting'); retry = setTimeout(connect, 4000) }
        ws.onerror = () => setWsStatus('sim')

        ws.onmessage = evt => {
          try {
            const msg = JSON.parse(evt.data)
            if (msg.type === 'telemetry' && Array.isArray(msg.data)) {
              const map = {}
              msg.data.forEach(d => { map[d.id] = d })
              setFleet(prev => prev.map(t => {
                const s = map[t.id]
                if (!s) return t
                const pos = interpolate(CORRIDORS[t.corridor], s.ratio ?? t.ratio)
                return {
                  ...t,
                  ratio:    s.ratio    ?? t.ratio,
                  severity: s.severity ?? t.severity,
                  lat: pos?.lat ?? t.lat,
                  lng: pos?.lng ?? t.lng,
                }
              }))
            }
          } catch { /* ignore */ }
        }
      } catch { setWsStatus('sim') }
    }

    connect()
    return () => { clearTimeout(retry); try { ws?.close() } catch {} }
  }, [])

  // ── Derived stats ────────────────────────────────────────────────────────────
  const zoneStats = useMemo(() => {
    const s = {}
    Object.keys(ZONES).forEach(z => {
      const trains = fleet.filter(t => t.zone === z)
      const critical = trains.filter(t => t.severity === 'CRITICAL').length
      const high     = trains.filter(t => t.severity === 'HIGH').length
      const med      = trains.filter(t => t.severity === 'MEDIUM').length
      const avgSpeed = trains.length ? Math.round(trains.reduce((a, t) => a + t.speed, 0) / trains.length) : 0
      const avgDelay = trains.length ? Math.round(trains.reduce((a, t) => a + t.delay, 0) / trains.length) : 0
      const load     = Math.min(100, Math.round(((critical * 5 + high * 3 + med * 1.5) / (trains.length * 5 || 1)) * 100))
      s[z] = { count: trains.length, critical, high, med, avgSpeed, avgDelay, load }
    })
    return s
  }, [tick])

  const visible     = selectedZone ? fleet.filter(t => t.zone === selectedZone) : fleet
  const critCount   = fleet.filter(t => t.severity === 'CRITICAL').length
  const highCount   = fleet.filter(t => t.severity === 'HIGH').length
  const totalDelay  = Math.round(fleet.reduce((a, t) => a + t.delay, 0) / fleet.length)
  const avgSpeed    = Math.round(fleet.reduce((a, t) => a + t.speed, 0) / fleet.length)

  // Handle zone click → pan map
  const selectZone = useCallback(zid => {
    if (zid === selectedZone) { setSelectedZone(null); setMapCenter(null); return }
    setSelectedZone(zid)
    const z = ZONES[zid]
    if (z) setMapCenter(z.center ? z.center : null)
  }, [selectedZone])

  const fmtTime = d => d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false })

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#02040f', fontFamily:'Inter,sans-serif', overflow:'hidden' }}>

      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div style={{
        padding:'8px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)',
        background:'rgba(4,7,26,0.98)',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap',
      }}>
        {/* Title */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width:8, height:8, borderRadius:'50%', flexShrink:0,
            background: wsStatus==='live' ? '#10b981' : '#f59e0b',
            boxShadow:  wsStatus==='live' ? '0 0 10px #10b981' : '0 0 6px #f59e0b',
            animation:  'pulse-dot 1.4s ease-in-out infinite',
          }}/>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:900, fontSize:'0.92rem', color:'#e2e8f0' }}>Howrah Zone</span>
              <span style={{ fontWeight:600, fontSize:'0.78rem', color:'#64748b' }}>— Live Command Centre</span>
              <span style={{
                fontSize:'0.52rem', fontWeight:800, padding:'2px 6px', borderRadius:8,
                background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.35)',
                color:'#60a5fa', letterSpacing:'0.08em',
              }}>PILOT v2</span>
            </div>
            <div style={{ fontSize:'0.57rem', color:'#475569', marginTop:1 }}>
              {fleet.length} trains · 5 zones · ER SER ECR ECoR NFR ·&nbsp;
              {ntesSrc === 'ntes'
                ? <span style={{color:'#10b981'}}>⬤ NTES delay data live{ntesAt ? ` (${ntesAt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})})` : ''}</span>
                : <span style={{color:'#f59e0b'}}>◎ physics sim · NTES updating…</span>
              }
            </div>
          </div>
        </div>

        {/* Global telemetry pills */}
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          {[
            { label:'CRITICAL', val:critCount,  col:'#ef4444' },
            { label:'HIGH',     val:highCount,   col:'#f97316' },
            { label:'AVG SPD',  val:`${avgSpeed} km/h`, col:'#10b981' },
            { label:'AVG DLY',  val:`+${totalDelay}m`, col: totalDelay>15 ? '#f97316' : '#64748b' },
          ].map(p => (
            <div key={p.label} style={{
              padding:'3px 8px', borderRadius:5, background:`${p.col}13`,
              border:`1px solid ${p.col}44`, textAlign:'center',
            }}>
              <div style={{ fontSize:'0.48rem', color:'#475569', letterSpacing:'0.08em' }}>{p.label}</div>
              <div style={{ fontSize:'0.72rem', fontWeight:800, color:p.col, fontFamily:'IBM Plex Mono,monospace' }}>{p.val}</div>
            </div>
          ))}

          {/* WS badge */}
          <div style={{
            padding:'4px 10px', borderRadius:5, fontSize:'0.6rem', fontWeight:700,
            background: wsStatus==='live' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
            color:       wsStatus==='live' ? '#10b981' : '#f59e0b',
            border:`1px solid ${wsStatus==='live' ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'}`,
          }}>
            {wsStatus==='live' ? '⚡ WS LIVE' : wsStatus==='reconnecting' ? '↻ …' : '◎ SIM'}
          </div>
        </div>
      </div>

      {/* ── ZONE PRESSURE STRIP ─────────────────────────────────────────────── */}
      <div style={{
        display:'flex', gap:5, padding:'5px 12px',
        background:'rgba(4,7,26,0.96)', borderBottom:'1px solid rgba(255,255,255,0.05)',
        overflowX:'auto', flexShrink:0,
      }}>
        {/* ALL ZONES toggle */}
        <div onClick={() => { setSelectedZone(null); setMapCenter(null) }} style={{
          cursor:'pointer', borderRadius:7, padding:'6px 10px',
          background: !selectedZone ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
          border:`1px solid ${!selectedZone ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.07)'}`,
          display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center',
          minWidth:60, transition:'all 0.2s',
        }}>
          <div style={{ fontSize:'0.6rem', fontWeight:800, color:'#e2e8f0' }}>ALL</div>
          <div style={{ fontSize:'0.75rem', fontWeight:900, color:'#60a5fa', fontFamily:'monospace' }}>{fleet.length}</div>
          <div style={{ fontSize:'0.45rem', color:'#475569' }}>trains</div>
        </div>

        {Object.entries(ZONES).map(([zid, z]) => {
          const s   = zoneStats[zid] || {}
          const col = s.critical > 0 ? '#ef4444' : s.high > 0 ? '#f97316' : z.color
          const active = selectedZone === zid

          return (
            <div key={zid} onClick={() => selectZone(zid)} style={{
              cursor:'pointer', flex:'1 1 0', minWidth:120,
              background: active ? `${col}14` : 'rgba(255,255,255,0.02)',
              border:`1px solid ${active ? col+'55' : 'rgba(255,255,255,0.06)'}`,
              borderRadius:7, padding:'6px 10px', transition:'all 0.2s',
              boxShadow: active ? `0 0 12px ${col}22` : 'none',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                <div>
                  <div style={{ fontSize:'0.65rem', fontWeight:900, color:col, letterSpacing:'0.04em' }}>{zid}</div>
                  <div style={{ fontSize:'0.48rem', color:'#475569', marginTop:1 }}>{z.abbr}</div>
                  <div style={{ fontSize:'0.44rem', color:'#334155', marginTop:1 }}>HQ: {z.hq}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:'0.95rem', fontWeight:900, color:col, fontFamily:'monospace', lineHeight:1 }}>{s.count||0}</div>
                  <div style={{ fontSize:'0.43rem', color:'#475569' }}>trains</div>
                </div>
              </div>

              {/* Load bar */}
              <div style={{ background:'#0f172a', borderRadius:2, height:3, overflow:'hidden', marginBottom:3 }}>
                <div style={{
                  height:'100%', width:`${s.load||0}%`, borderRadius:2,
                  background: col, transition:'width 0.8s ease',
                  boxShadow: s.critical > 0 ? `0 0 6px ${col}` : 'none',
                }}/>
              </div>

              <div style={{ display:'flex', gap:5, fontSize:'0.47rem', flexWrap:'wrap' }}>
                {s.critical > 0 && <span style={{ color:'#ef4444', fontWeight:700 }}>⚑{s.critical}</span>}
                {s.high > 0     && <span style={{ color:'#f97316', fontWeight:700 }}>▲{s.high}</span>}
                <span style={{ color:'#475569', marginLeft:'auto' }}>{s.avgSpeed} km/h</span>
                {s.avgDelay > 5 && <span style={{ color:'#f59e0b' }}>+{s.avgDelay}m</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── MAP + SIDEBAR ───────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>

        {/* Map */}
        <div style={{ flex:1, position:'relative' }}>
          <MapContainer
            center={[23.0, 87.0]} zoom={7} minZoom={5} maxZoom={13}
            maxBounds={[[8.0, 67.0], [30.0, 98.0]]} maxBoundsViscosity={0.85}
            style={{ height:'100%', width:'100%', background:'#02040f' }}
          >
            <TileLayer
              url={CARTO_DARK_TILES}
              attribution="DRISHTI·HWH Pilot v2 · © CARTO"
            />
            {/* OpenRailwayMap overlay for actual track lines */}
            <TileLayer url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png" opacity={0.28} />

            {mapCenter && <MapRecenter center={mapCenter} />}

            {/* Corridor polylines */}
            {Object.entries(CORRIDORS).map(([key, pts]) => (
              <Polyline
                key={key}
                positions={pts.map(p => [p.lat, p.lng])}
                pathOptions={{ color:'#60a5fa', weight:2, opacity:0.3, dashArray:'8 10' }}
              />
            ))}

            {/* Station nodes */}
            {Object.values(ST).filter(s => ZONES[s.zone]).map((s, i) => {
              const col = ZONES[s.zone]?.color || '#60a5fa'
              const key = Object.keys(ST)[i]
              const major = ['HWH','KGP','GHY','PNBE','BBS','NJP','NDLS','MAS','ASN','DHN'].includes(key)
              return (
                <CircleMarker key={key} center={[s.lat, s.lng]}
                  radius={major ? 5 : 3.5}
                  pathOptions={{ color:col, fillColor:col, fillOpacity:major?0.85:0.55, weight:major?1.5:1 }}>
                  <Tooltip permanent={major} direction="top" offset={[0,-7]} className="drishti-tooltip">
                    <span style={{ fontSize:'0.58rem', fontWeight:700, color:col }}>{key}</span>
                  </Tooltip>
                  <Popup className="drishti-popup" maxWidth={200}>
                    <div style={{ padding:'6px 4px', fontFamily:'Inter,sans-serif', color:'#f1f5f9', fontSize:'0.75rem' }}>
                      <div style={{ fontWeight:800, color:col, marginBottom:2 }}>{s.name}</div>
                      <div style={{ fontSize:'0.58rem', color:'#64748b' }}>{s.zone} · {key}</div>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}

            {/* Train markers */}
            {visible.filter(t => t.lat && t.lng).map(t => {
              const col  = SEV_COLOR[t.severity] || '#3b82f6'
              const crit = t.severity === 'CRITICAL'
              const high = t.severity === 'HIGH'

              return [
                /* outer pulse ring for CRITICAL/HIGH */
                (crit || high) && (
                  <CircleMarker key={`ring-${t.id}`} center={[t.lat, t.lng]}
                    radius={crit ? 16 : 12}
                    pathOptions={{ color:col, fillColor:col, fillOpacity:0.06, weight:1, opacity:0.25 }}
                    interactive={false}
                  />
                ),
                /* main dot */
                <CircleMarker key={t.id} center={[t.lat, t.lng]}
                  radius={crit ? 9 : high ? 7.5 : 6}
                  pathOptions={{
                    color:'#ffffff', weight: crit ? 2 : 1.5,
                    fillColor:col, fillOpacity: crit ? 1 : 0.88,
                  }}>
                  <Tooltip direction="top" offset={[0,-10]} opacity={0.97}>
                    <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:'0.62rem', color:col, fontWeight:700 }}>
                      {t.id} · {t.speed} km/h{t.delay > 5 ? ` · +${t.delay}m` : ''}
                    </span>
                  </Tooltip>
                  <Popup className="drishti-popup" maxWidth={260}>
                    <TrainPopup t={t} />
                  </Popup>
                </CircleMarker>,
              ].filter(Boolean)
            })}
          </MapContainer>

          {/* Map data source label */}
          <div style={{
            position:'absolute', bottom:8, left:8, zIndex:1000,
            background:'rgba(4,7,26,0.88)', border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:5, padding:'4px 8px', fontSize:'0.5rem', color:'#475569',
            fontFamily:'IBM Plex Mono,monospace',
          }}>
            ◎ Positions: physics sim on real GPS corridors · Map: CARTO dark + OpenRailwayMap
          </div>
        </div>

        {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
        <div style={{
          width:265, background:'rgba(4,7,26,0.99)',
          borderLeft:'1px solid rgba(255,255,255,0.06)',
          display:'flex', flexDirection:'column', overflow:'hidden',
        }}>
          {/* Sidebar header */}
          <div style={{ padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:'0.58rem', fontWeight:800, color:'#64748b', letterSpacing:'0.1em' }}>
                ACTIVE TRAINS{selectedZone ? ` · ${selectedZone}` : ''}
              </div>
              <div style={{ fontSize:'0.55rem', fontFamily:'monospace', color:'#334155' }}>
                {visible.length} / {fleet.length}
              </div>
            </div>
          </div>

          {/* Sorted list */}
          <div style={{ flex:1, overflowY:'auto' }}>
            {[...visible]
              .sort((a, b) => {
                const o = { CRITICAL:0, HIGH:1, MEDIUM:2, LOW:3 }
                return (o[a.severity] ?? 3) - (o[b.severity] ?? 3)
              })
              .map(t => {
                const col = SEV_COLOR[t.severity] || '#3b82f6'
                return (
                  <div key={t.id} style={{
                    padding:'7px 12px',
                    borderBottom:'1px solid rgba(255,255,255,0.035)',
                    borderLeft:`3px solid ${t.severity==='CRITICAL' ? col : t.severity==='HIGH' ? col : 'transparent'}`,
                    background: t.severity==='CRITICAL' ? 'rgba(239,68,68,0.05)' : 'transparent',
                    transition:'background 0.3s',
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'0.68rem', fontWeight:700, color:'#e2e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {TYPE_ICON[t.type]} {t.name}
                        </div>
                        <div style={{ fontSize:'0.52rem', color:'#475569', marginTop:1 }}>
                          #{t.id} · {t.nearStation || CORRIDORS[t.corridor]?.[0]?.name || '—'}
                        </div>
                      </div>
                      <div style={{
                        padding:'1px 5px', borderRadius:3, fontSize:'0.48rem', fontWeight:800,
                        background:`${col}20`, color:col, border:`1px solid ${col}40`,
                        flexShrink:0, marginLeft:6, letterSpacing:'0.04em',
                      }}>{t.severity}</div>
                    </div>

                    <div style={{ display:'flex', gap:8, marginTop:4, fontSize:'0.57rem' }}>
                      <span style={{ color:'#10b981', fontFamily:'monospace' }}>{t.speed} km/h</span>
                      {t.delay > 0
                        ? <span style={{ color: t.delay > 30 ? '#ef4444' : '#f97316', fontFamily:'monospace' }}>+{t.delay}m</span>
                        : <span style={{ color:'#10b981', opacity:0.7 }}>on time</span>}
                      <span style={{ color:'#1e293b', marginLeft:'auto', fontFamily:'monospace', fontSize:'0.5rem' }}>
                        {(t.ratio * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>

          {/* Critical footer */}
          {critCount > 0 && (
            <div style={{
              padding:'7px 12px', flexShrink:0,
              background:'rgba(239,68,68,0.1)',
              borderTop:'1px solid rgba(239,68,68,0.3)',
              display:'flex', alignItems:'center', gap:8,
            }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#ef4444', animation:'pulse-dot 1s infinite', flexShrink:0 }}/>
              <div style={{ fontSize:'0.58rem', fontWeight:700, color:'#ef4444' }}>
                {critCount} CRITICAL · {highCount} HIGH — ACTIVE INCIDENTS
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity:1; transform:scale(1); }
          50%       { opacity:0.35; transform:scale(1.4); }
        }
        .drishti-popup .leaflet-popup-content-wrapper {
          background: rgba(4,7,26,0.97) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 10px !important;
          box-shadow: 0 12px 40px rgba(0,0,0,0.7) !important;
          color: #f1f5f9 !important;
          padding: 0 !important;
        }
        .drishti-popup .leaflet-popup-content { margin: 0 !important; }
        .drishti-popup .leaflet-popup-tip     { background: rgba(4,7,26,0.97) !important; }
        .drishti-popup .leaflet-popup-close-button { color: #475569 !important; top:8px !important; right:8px !important; }
        .drishti-tooltip .leaflet-tooltip {
          background: rgba(4,7,26,0.95) !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          color: #e2e8f0 !important; font-size: 0.6rem !important;
          border-radius: 4px !important; padding: 3px 7px !important;
        }
      `}</style>
    </div>
  )
}
