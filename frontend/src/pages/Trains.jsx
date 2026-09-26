import { useState, useEffect } from 'react'
import { getCurrentTrains, triggerKavachOverride } from '../api'
import { soundFx } from '../utils/audio'
import EmergencyDispatchModal from '../components/EmergencyDispatchModal'

const SEVERITIES = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'STABLE']
const ZONES      = ['ALL', 'NR', 'CR', 'WR', 'ER', 'SR', 'SER', 'NFR', 'NWR', 'SCR']

const SEV_MAP = {
  CRITICAL: { color: 'var(--red)',    bg: 'var(--red-bg)',    border: 'var(--red-border)' },
  HIGH:     { color: 'var(--orange)', bg: 'var(--orange-bg)', border: 'var(--orange-border)' },
  MEDIUM:   { color: 'var(--yellow)', bg: 'var(--yellow-bg)', border: 'var(--yellow-border)' },
  LOW:      { color: 'var(--green)',  bg: 'var(--green-bg)',  border: 'var(--green-border)' },
  STABLE:   { color: 'var(--blue)',   bg: 'var(--blue-light)', border: 'var(--blue-border)' },
}

export default function Trains() {
  const [trains,       setTrains]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [sev,          setSev]          = useState('ALL')
  const [zone,         setZone]         = useState('ALL')
  const [search,       setSearch]       = useState('')
  const [sortKey,      setSortKey]      = useState('train_id')
  const [sortAsc,      setSortAsc]      = useState(true)
  const [live,         setLive]         = useState(false)
  const [haltedTrains, setHaltedTrains] = useState({})
  const [dispatchData, setDispatchData] = useState(null)
  const [kavachNotice, setKavachNotice] = useState(null)

  const handleKavach = async (t) => {
    soundFx.playKavachBrake()
    setHaltedTrains(prev => ({ ...prev, [t.train_id]: true }))
    setKavachNotice({
      trainId: t.train_id,
      trainName: t.train_name,
      time: new Date().toLocaleTimeString('en-IN'),
    })
    try {
      await triggerKavachOverride(t.train_id, 'Section Controller Manual TCAS Trigger', 'OPERATOR-CONSOLE')
    } catch {}
    setTimeout(() => setKavachNotice(null), 8000)
  }

  const load = async () => {
    try {
      const d = await getCurrentTrains()
      setTrains(d)
      setLive(true)
    } catch { setLive(false) }
    setLoading(false)
  }

  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv) }, [])

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  const filtered = trains
    .filter(t => sev === 'ALL' || t.stress_level === sev)
    .filter(t => zone === 'ALL' || t.zone === zone)
    .filter(t => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        (t.train_id?.toLowerCase().includes(q)) ||
        (t.train_name?.toLowerCase().includes(q)) ||
        (t.current_station?.toLowerCase().includes(q))
      )
    })
    .sort((a, b) => {
      let av = a[sortKey] ?? ''
      let bv = b[sortKey] ?? ''
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

  const counts = SEVERITIES.reduce((acc, s) => {
    acc[s] = s === 'ALL' ? trains.length : trains.filter(t => t.stress_level === s).length
    return acc
  }, {})

  const SortTh = ({ k, label }) => (
    <th onClick={() => toggleSort(k)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      {label} {sortKey === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <div className="page-header-title">Live Train Tracker</div>
            <div className={`live-pill ${live ? 'online' : 'offline'}`}>
              <span className="pulse-dot" style={{ background: live ? 'var(--green)' : 'var(--t4)', animation: live ? 'pulse-dot 2s ease-in-out infinite' : 'none' }} />
              {live ? 'LIVE' : 'OFFLINE'}
            </div>
          </div>
          <div className="page-header-sub">All active trains across Indian Railway zones — real-time stress monitoring</div>
        </div>
        <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue)' }}>{trains.length}</div>
      </div>

      <div className="container" style={{ paddingTop: 16 }}>

        {/* ── Summary strip ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {['CRITICAL','HIGH','MEDIUM','LOW','STABLE'].map(s => {
            const m = SEV_MAP[s]
            return (
              <button
                key={s}
                className={`btn-filter ${sev === s ? `active-${s.toLowerCase()}` : ''}`}
                onClick={() => setSev(sev === s ? 'ALL' : s)}
              >
                {s} ({counts[s]})
              </button>
            )
          })}
          <div style={{ flex: 1 }} />
          <button className={`btn-filter ${sev === 'ALL' ? 'active-all' : ''}`} onClick={() => setSev('ALL')}>
            ALL ({counts.ALL})
          </button>
        </div>

        {/* ── Filters row ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <input
            placeholder="Search train ID, name, station…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 220,
              padding: '7px 12px', fontSize: 13,
              border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
              background: 'var(--bg-surface)', color: 'var(--t1)',
            }}
          />
          <select
            value={zone}
            onChange={e => setZone(e.target.value)}
            style={{
              padding: '7px 12px', fontSize: 12, borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--t1)',
            }}
          >
            {ZONES.map(z => <option key={z} value={z}>{z === 'ALL' ? 'All Zones' : z}</option>)}
          </select>
        </div>

        {/* ── Kavach Notice Banner ── */}
        {kavachNotice && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.25), rgba(15, 23, 42, 0.7))',
            border: '1px solid #ef4444',
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>⚡</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#f87171' }}>
                  KAVACH TCAS EMERGENCY BRAKE ENGAGED: Train {kavachNotice.trainId} ({kavachNotice.trainName})
                </div>
                <div style={{ fontSize: 11, color: '#cbd5e1' }}>
                  Traction cut commanded · Electro-pneumatic brake cylinders pressurized · Speed clamped to 0 km/h · {kavachNotice.time}
                </div>
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: '#ef4444', color: '#fff', padding: '3px 8px', borderRadius: 4 }}>
              TRIP HALT ACTIVE
            </span>
          </div>
        )}

        {/* ── Main table ── */}
        <div className="card">
          {loading ? (
            <div className="empty-state">
              <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 12 }} />
              <div className="empty-state-sub">Loading telemetry…</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <SortTh k="train_id"       label="TRAIN ID" />
                    <SortTh k="train_name"     label="NAME" />
                    <SortTh k="current_station"label="STATION" />
                    <SortTh k="zone"           label="ZONE" />
                    <SortTh k="stress_level"   label="STRESS" />
                    <SortTh k="speed"          label="SPEED" />
                    <SortTh k="delay_minutes"  label="DELAY" />
                    <th style={{ textAlign: 'right' }}>COMMAND ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8}>
                      <div className="empty-state">
                        <div className="empty-state-icon">⊡</div>
                        <div className="empty-state-title">No trains found</div>
                        <div className="empty-state-sub">
                          {trains.length === 0
                            ? 'Telemetry producer may still be warming up'
                            : 'Try adjusting filters'}
                        </div>
                      </div>
                    </td></tr>
                  ) : filtered.map(t => {
                    const isHalted = !!haltedTrains[t.train_id]
                    return (
                      <tr key={t.train_id} className={isHalted ? 'row-critical' : t.stress_level === 'CRITICAL' ? 'row-critical' : t.stress_level === 'HIGH' ? 'row-high' : ''}>
                        <td>
                          <span className="mono" style={{ fontWeight: 700, color: 'var(--blue)', fontSize: 12 }}>
                            {t.train_id}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500, color: 'var(--t1)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.train_name || '—'}
                        </td>
                        <td>
                          <span className="mono" style={{ fontSize: 12 }}>{t.current_station || '—'}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--t2)' }}>{t.zone || '—'}</span>
                        </td>
                        <td>
                          {isHalted ? (
                            <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', fontWeight: 800 }}>
                              ⚡ KAVACH HALTED
                            </span>
                          ) : (
                            <span className={`badge badge-${(t.stress_level || 'STABLE').toLowerCase()}`}>
                              {t.stress_level || 'STABLE'}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="mono" style={{ fontSize: 12, color: isHalted ? 'var(--red)' : 'inherit', fontWeight: isHalted ? 800 : 500 }}>
                            {isHalted ? '0 km/h' : t.speed != null ? `${Math.round(t.speed)} km/h` : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="mono" style={{ fontSize: 12, color: t.delay_minutes > 30 ? 'var(--red)' : 'var(--t2)' }}>
                            {t.delay_minutes != null ? `${Math.round(t.delay_minutes)} min` : '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              onClick={() => handleKavach(t)}
                              title="Engage Kavach TCAS Emergency Auto-Braking"
                              style={{
                                padding: '3px 8px',
                                borderRadius: 4,
                                border: isHalted ? '1px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.4)',
                                background: isHalted ? '#ef4444' : 'rgba(239, 68, 68, 0.1)',
                                color: isHalted ? '#fff' : '#f87171',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {isHalted ? '✓ Halted' : '⚡ Kavach'}
                            </button>
                            <button
                              onClick={() => setDispatchData({ isOpen: true, trainId: t.train_id, station: t.current_station || 'Howrah Division' })}
                              title="Place Emergency Voice Call to Loco Pilot"
                              style={{
                                padding: '3px 8px',
                                borderRadius: 4,
                                border: '1px solid var(--border)',
                                background: 'var(--bg-raised)',
                                color: 'var(--t2)',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              📞 Call
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer count */}
        {filtered.length > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--t4)', marginTop: 10, textAlign: 'right' }}>
            Showing {filtered.length} of {trains.length} trains · Updates every 10s
          </div>
        )}
      </div>

      {dispatchData && (
        <EmergencyDispatchModal
          isOpen={dispatchData.isOpen}
          onClose={() => setDispatchData(null)}
          initialTrainId={dispatchData.trainId}
          initialStation={dispatchData.station}
          initialReason="Critical telemetry anomaly: Pilot immediate attention requested"
        />
      )}
    </div>
  )
}
