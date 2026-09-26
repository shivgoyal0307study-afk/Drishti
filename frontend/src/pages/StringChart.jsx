import { useState, useMemo } from 'react'
import { soundFx } from '../utils/audio'
import EmergencyDispatchModal from '../components/EmergencyDispatchModal'

const STATIONS = [
  { code: 'HWH', name: 'Howrah Jn', km: 0 },
  { code: 'SRP', name: 'Serampore', km: 20 },
  { code: 'BDC', name: 'Bandel Jn', km: 40 },
  { code: 'BWN', name: 'Bardhaman Jn', km: 107 },
  { code: 'PAN', name: 'Panagarh', km: 148 },
  { code: 'DGR', name: 'Durgapur', km: 171 },
  { code: 'ASN', name: 'Asansol Jn', km: 200 },
]

const INITIAL_TRAINS = [
  {
    id: '12301',
    name: 'Howrah Rajdhani Express',
    type: 'UP',
    color: '#ef4444',
    speed: 110,
    startTime: 6.0,
    delay: 0,
    halts: { BWN: 5, DGR: 3 },
  },
  {
    id: '22301',
    name: 'Howrah Vande Bharat',
    type: 'UP',
    color: '#06b6d4',
    speed: 130,
    startTime: 6.8,
    delay: 0,
    halts: { BWN: 4 },
  },
  {
    id: '12314',
    name: 'Sealdah Rajdhani (Down)',
    type: 'DOWN',
    color: '#f59e0b',
    speed: 105,
    startTime: 6.2,
    delay: 0,
    halts: { DGR: 4, BWN: 5 },
  },
  {
    id: 'BOXN-882',
    name: 'Coal Freight Consignment',
    type: 'UP',
    color: '#8b5cf6',
    speed: 55,
    startTime: 5.5,
    delay: 0,
    halts: { BDC: 20, PAN: 15 },
  },
  {
    id: '13009',
    name: 'Doon Express',
    type: 'UP',
    color: '#10b981',
    speed: 75,
    startTime: 7.2,
    delay: 0,
    halts: { SRP: 3, BDC: 5, BWN: 10 },
  }
]

export default function StringChart() {
  const [trains, setTrains] = useState(INITIAL_TRAINS)
  const [selectedTrain, setSelectedTrain] = useState(null)
  const [activeConflict, setActiveConflict] = useState(null)
  const [simulatedDelay, setSimulatedDelay] = useState(0)
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false)
  const [kavachActive, setKavachActive] = useState(false)
  const [loopResolved, setLoopResolved] = useState(false)

  // Chart dimensions
  const width = 850
  const height = 480
  const padLeft = 80
  const padRight = 30
  const padTop = 40
  const padBottom = 40

  const timeStart = 5.0
  const timeEnd = 11.0

  // Coordinate scales
  const timeToX = (t) => padLeft + ((t - timeStart) / (timeEnd - timeStart)) * (width - padLeft - padRight)
  const kmToY = (km) => padTop + (km / 200) * (height - padTop - padBottom)

  // Trajectory generator
  const trajectories = useMemo(() => {
    return trains.map(t => {
      const isUp = t.type === 'UP'
      const startKm = isUp ? 0 : 200
      const endKm = isUp ? 200 : 0
      
      const effectiveDelay = t.id === '12301' ? simulatedDelay : t.delay
      let curTime = t.startTime + (effectiveDelay / 60)
      const points = []

      // If loop siding resolved, freight sits at Bardhaman loop
      const isFreight = t.id === 'BOXN-882'
      const freightHalt = isFreight && loopResolved ? 45 : (t.halts.BDC || 0)

      if (isUp) {
        points.push({ time: curTime, km: 0, station: 'HWH' })
        // SRP
        curTime += (20 / t.speed) + ((t.halts.SRP || 0) / 60)
        points.push({ time: curTime, km: 20, station: 'SRP' })
        // BDC
        curTime += (20 / t.speed) + (freightHalt / 60)
        points.push({ time: curTime, km: 40, station: 'BDC' })
        // BWN
        curTime += (67 / t.speed) + ((t.halts.BWN || 0) / 60)
        points.push({ time: curTime, km: 107, station: 'BWN' })
        // PAN
        curTime += (41 / t.speed) + ((t.halts.PAN || 0) / 60)
        points.push({ time: curTime, km: 148, station: 'PAN' })
        // DGR
        curTime += (23 / t.speed) + ((t.halts.DGR || 0) / 60)
        points.push({ time: curTime, km: 171, station: 'DGR' })
        // ASN
        curTime += (29 / t.speed)
        points.push({ time: curTime, km: 200, station: 'ASN' })
      } else {
        points.push({ time: curTime, km: 200, station: 'ASN' })
        // DGR
        curTime += (29 / t.speed) + ((t.halts.DGR || 0) / 60)
        points.push({ time: curTime, km: 171, station: 'DGR' })
        // BWN
        curTime += (64 / t.speed) + ((t.halts.BWN || 0) / 60)
        points.push({ time: curTime, km: 107, station: 'BWN' })
        // HWH
        curTime += (107 / t.speed)
        points.push({ time: curTime, km: 0, station: 'HWH' })
      }

      return {
        ...t,
        points,
        svgPath: points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${timeToX(p.time)} ${kmToY(p.km)}`).join(' ')
      }
    })
  }, [trains, simulatedDelay, loopResolved])

  // Conflict calculation (crossing of paths on single/shared blocks or close headway)
  const conflicts = useMemo(() => {
    if (loopResolved) return [] // Conflict eliminated by loop siding
    // Look at Rajdhani (12301) vs Freight (BOXN-882) around km 40-70 if delayed
    if (simulatedDelay > 20) {
      return [{
        id: 'conf-1',
        km: 55,
        time: 7.45,
        train1: '12301 Rajdhani',
        train2: 'BOXN-882 Freight',
        location: 'Near Bandel – Bardhaman Section',
        severity: 'CRITICAL HEADWAY CONFLICT',
        description: 'Vande Bharat / Rajdhani rapid overtake requires freight diversion into Bandel Loop Line to prevent SPAD violation.',
      }]
    }
    return []
  }, [simulatedDelay, loopResolved])

  const handleApplyDelay = (mins) => {
    setSimulatedDelay(mins)
    soundFx.playChime()
  }

  const handleTriggerKavach = () => {
    setKavachActive(true)
    soundFx.playKavachBrake()
  }

  const handleResolveLoop = () => {
    setLoopResolved(true)
    soundFx.playRadioChirp()
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <div className="page-header-title">Section Controller String Chart (MAREE)</div>
            <span className="live-pill online">
              <span className="pulse-dot" style={{ background: 'var(--blue)' }} />
              HOWRAH – ASANSOL SECTION
            </span>
          </div>
          <div className="page-header-sub">
            Time-Distance Graphical Trajectory Engine · Conflict Prediction & Dynamic Loop Diversion Simulation
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setDispatchModalOpen(true)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              border: '1px solid #ef4444',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📞 Voice Dispatch</span>
          </button>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 16 }}>
        {/* Interactive Simulation Strip */}
        <div className="card" style={{ marginBottom: 16, padding: '14px 18px', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>
                Counterfactual "What-If" Sectional Perturbation Simulator
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                Inject schedule variations to observe downstream string intersections and automatic TCAS collision warnings.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)' }}>
                Rajdhani Delay: <b style={{ color: simulatedDelay > 0 ? '#ef4444' : '#38bdf8' }}>+{simulatedDelay} min</b>
              </span>
              <button
                className="btn-filter"
                onClick={() => handleApplyDelay(0)}
                style={{ padding: '4px 10px', fontSize: 11 }}
              >
                On-Time
              </button>
              <button
                className="btn-filter"
                onClick={() => handleApplyDelay(25)}
                style={{ padding: '4px 10px', fontSize: 11, color: '#f59e0b', borderColor: '#f59e0b44' }}
              >
                +25m Delay
              </button>
              <button
                className="btn-filter"
                onClick={() => handleApplyDelay(45)}
                style={{ padding: '4px 10px', fontSize: 11, color: '#ef4444', borderColor: '#ef444444' }}
              >
                +45m Heavy Cascading
              </button>

              {conflicts.length > 0 && !loopResolved && (
                <button
                  onClick={handleResolveLoop}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 6,
                    background: 'rgba(34, 197, 94, 0.2)',
                    border: '1px solid #22c55e',
                    color: '#4ade80',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ✓ Route Freight to Loop Siding
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Conflict Warning Banner */}
        {conflicts.length > 0 && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.2), rgba(15, 23, 42, 0.6))',
            border: '1px solid #ef4444',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 24, animation: 'pulse 1s infinite' }}>⚠️</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#f87171', letterSpacing: '0.04em' }}>
                  {conflicts[0].severity}: {conflicts[0].train1} ⚡ {conflicts[0].train2}
                </div>
                <div style={{ fontSize: 11.5, color: '#cbd5e1' }}>
                  {conflicts[0].description} at {conflicts[0].location} (KM {conflicts[0].km}).
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleTriggerKavach}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: '#ef4444',
                  border: 'none',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {kavachActive ? '✓ Kavach Brake Tripped' : '⚡ Trip Kavach Auto-Brake'}
              </button>
            </div>
          </div>
        )}

        {/* Main String Chart SVG Canvas */}
        <div className="card" style={{ padding: 16, overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', background: 'var(--bg-canvas, #080d1a)', borderRadius: 8 }}>
            <defs>
              <linearGradient id="gridGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e293b" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#1e293b" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {/* Station horizontal gridlines */}
            {STATIONS.map(s => {
              const y = kmToY(s.km)
              return (
                <g key={s.code}>
                  <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                  <text x={padLeft - 10} y={y + 3} textAnchor="end" fill="var(--t3, #94a3b8)" fontSize="10" fontFamily="monospace">
                    {s.code} ({s.km}k)
                  </text>
                </g>
              )
            })}

            {/* Time vertical gridlines (every 30 mins) */}
            {[5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0, 10.5, 11.0].map(t => {
              const x = timeToX(t)
              const hour = Math.floor(t)
              const min = Math.round((t - hour) * 60)
              const timeLabel = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
              const isMajor = min === 0
              return (
                <g key={t}>
                  <line x1={x} y1={padTop} x2={x} y2={height - padBottom} stroke={isMajor ? '#334155' : '#1e293b'} strokeWidth={isMajor ? '1.5' : '1'} />
                  <text x={x} y={height - padBottom + 16} textAnchor="middle" fill="var(--t3, #94a3b8)" fontSize="10" fontFamily="monospace">
                    {timeLabel}
                  </text>
                  <text x={x} y={padTop - 8} textAnchor="middle" fill="var(--t4, #64748b)" fontSize="9" fontFamily="monospace">
                    {timeLabel}
                  </text>
                </g>
              )
            })}

            {/* Trajectory String Lines */}
            {trajectories.map(t => {
              const isSelected = selectedTrain === t.id
              return (
                <g key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTrain(t.id)}>
                  {/* Glow outline on selection */}
                  {isSelected && (
                    <path
                      d={t.svgPath}
                      fill="none"
                      stroke={t.color}
                      strokeWidth="7"
                      strokeOpacity="0.4"
                    />
                  )}
                  {/* Main path line */}
                  <path
                    d={t.svgPath}
                    fill="none"
                    stroke={t.color}
                    strokeWidth={isSelected ? '3.5' : '2.2'}
                    strokeDasharray={t.type === 'DOWN' ? '6 3' : 'none'}
                  />
                  {/* Station waypoint dots */}
                  {t.points.map((p, pi) => (
                    <circle
                      key={pi}
                      cx={timeToX(p.time)}
                      cy={kmToY(p.km)}
                      r={isSelected ? '4' : '2.5'}
                      fill={t.color}
                      stroke="#080d1a"
                      strokeWidth="1"
                    />
                  ))}
                  {/* Train label on head */}
                  <text
                    x={timeToX(t.points[0].time) + (t.type === 'UP' ? 6 : -6)}
                    y={kmToY(t.points[0].km) + (t.type === 'UP' ? 14 : -8)}
                    fill={t.color}
                    fontSize="9.5"
                    fontWeight="700"
                    textAnchor={t.type === 'UP' ? 'start' : 'end'}
                    fontFamily="Inter, sans-serif"
                  >
                    {t.id} ({t.name.split(' ')[0]})
                  </text>
                </g>
              )
            })}

            {/* Conflict Intersection Marker */}
            {conflicts.map(c => (
              <g key={c.id}>
                <circle
                  cx={timeToX(c.time)}
                  cy={kmToY(c.km)}
                  r="14"
                  fill="rgba(239, 68, 68, 0.25)"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
                <circle
                  cx={timeToX(c.time)}
                  cy={kmToY(c.km)}
                  r="5"
                  fill="#ef4444"
                />
                <text
                  x={timeToX(c.time)}
                  y={kmToY(c.km) - 18}
                  fill="#f87171"
                  fontSize="10"
                  fontWeight="800"
                  textAnchor="middle"
                  fontFamily="Inter, sans-serif"
                >
                  ⚡ SPAD CONFLICT
                </text>
              </g>
            ))}
          </svg>

          {/* Legend and Active Train Details */}
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {trains.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTrain(t.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11.5,
                    cursor: 'pointer',
                    opacity: selectedTrain && selectedTrain !== t.id ? 0.4 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  <div style={{ width: 12, height: 3, background: t.color, borderRadius: 2 }} />
                  <span style={{ fontWeight: 600, color: 'var(--t1)' }}>{t.id}</span>
                  <span style={{ color: 'var(--t3)', fontSize: 10.5 }}>{t.name}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: 'var(--t4)' }}>
              Solid Line = UP (Towards ASN) · Dashed Line = DOWN (Towards HWH) · Slope = Speed (km/h)
            </div>
          </div>
        </div>
      </div>

      <EmergencyDispatchModal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        initialTrainId="12301"
        initialStation="Howrah – Bardhaman Section"
        initialReason="MAREE Sectional Conflict: Immediate Speed Reduction Order"
      />
    </div>
  )
}
