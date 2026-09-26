import { useState, useEffect } from 'react'
import { getAlerts, triggerAutoCriticalSMS } from '../api'
import EmergencyDispatchModal from '../components/EmergencyDispatchModal'

const SEVERITIES = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const ZONES = ['ALL', 'NR', 'CR', 'WR', 'ER', 'SR', 'SER', 'NFR', 'NWR', 'SCR']

const SEV_MAP = {
  CRITICAL: { color: 'var(--red)',    bg: 'var(--red-bg)',    border: 'var(--red-border)',    rowBg: '#FEF2F2' },
  HIGH:     { color: 'var(--orange)', bg: 'var(--orange-bg)', border: 'var(--orange-border)', rowBg: '#FFFBEB' },
  MEDIUM:   { color: 'var(--yellow)', bg: 'var(--yellow-bg)', border: 'var(--yellow-border)', rowBg: '#FEFCE8' },
  LOW:      { color: 'var(--green)',  bg: 'var(--green-bg)',  border: 'var(--green-border)',  rowBg: 'transparent' },
}

function AlertRow({ alert, expanded, onClick, onDispatch }) {
  const sev = alert.severity || 'LOW'
  const s = SEV_MAP[sev] || SEV_MAP.LOW
  const ts = alert.timestamp ? new Date(alert.timestamp) : null
  const timeStr = ts ? ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '--:--:--'
  const dateStr = ts ? ts.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''

  return (
    <>
      <tr
        onClick={onClick}
        style={{
          cursor: 'pointer',
          background: expanded ? s.bg : 'transparent',
          borderLeft: sev === 'CRITICAL' || sev === 'HIGH' ? `3px solid ${s.color}` : '3px solid transparent',
        }}
      >
        <td>
          <div className="mono" style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.3 }}>
            <div>{timeStr}</div>
            <div style={{ fontSize: 9.5, color: 'var(--t4)' }}>{dateStr}</div>
          </div>
        </td>
        <td>
          <span className={`badge badge-${sev.toLowerCase()}`}>{sev}</span>
        </td>
        <td>
          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.08)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(59, 130, 246, 0.25)', whiteSpace: 'nowrap' }}>
            {alert.train_id ? `🚂 ${alert.train_id}` : (alert.train_name ? alert.train_name : '12301')}
          </span>
        </td>
        <td>
          <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--t1)' }}>
            {alert.alert_type || 'System Alert'}
          </div>
          {alert.train_name && alert.train_id && (
            <div style={{ fontSize: 10.5, color: 'var(--t3)', marginTop: 1 }}>{alert.train_name}</div>
          )}
        </td>
        <td>
          <span className="mono" style={{ fontSize: 12 }}>{alert.station || alert.node_id || '—'}</span>
        </td>
        <td style={{ fontSize: 12 }}>{alert.zone || 'ALL'}</td>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 11, color: 'var(--t4)' }}>
              {expanded ? '▲' : '▼'}
            </span>
          </div>
        </td>
      </tr>

      {/* Expanded row */}
      {expanded && (
        <tr>
          <td colSpan={7} style={{ background: s.bg, padding: 0, borderBottom: `1px solid ${s.border}` }}>
            <div style={{ padding: '12px 20px 16px' }}>
              {alert.description && (
                <p style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.7, marginBottom: 12, maxWidth: 700 }}>
                  {alert.description}
                </p>
              )}
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ padding: '8px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
                  <div className="section-label" style={{ marginBottom: 4 }}>Train Number</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--blue)' }}>
                    {alert.train_id || '12301'}
                  </div>
                  {alert.train_name && (
                    <div style={{ fontSize: 10.5, color: 'var(--t3)', marginTop: 1 }}>{alert.train_name}</div>
                  )}
                </div>
                {alert.stress_score != null && (
                  <div style={{ padding: '8px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
                    <div className="section-label" style={{ marginBottom: 4 }}>Stress Score</div>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: s.color }}>
                      {(alert.stress_score * 100).toFixed(0)}%
                    </div>
                  </div>
                )}
                {alert.crs_match_score != null && (
                  <div style={{ padding: '8px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
                    <div className="section-label" style={{ marginBottom: 4 }}>CRS Signature Match</div>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)' }}>
                      {(alert.crs_match_score * 100).toFixed(0)}%
                    </div>
                  </div>
                )}
                {alert.speed != null && (
                  <div style={{ padding: '8px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
                    <div className="section-label" style={{ marginBottom: 4 }}>Speed</div>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--blue)' }}>
                      {Math.round(alert.speed)} km/h
                    </div>
                  </div>
                )}
                {alert.bayesian_risk != null && (
                  <div style={{ padding: '8px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
                    <div className="section-label" style={{ marginBottom: 4 }}>Bayesian Risk</div>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--purple)' }}>
                      {(alert.bayesian_risk * 100).toFixed(0)}%
                    </div>
                  </div>
                )}
              </div>

              {alert.models?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="section-label" style={{ marginBottom: 6 }}>Models Triggered</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {alert.models.map((m, i) => (
                      <span key={i} style={{
                        padding: '3px 10px', borderRadius: 4,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        fontSize: 11, fontFamily: 'IBM Plex Mono, monospace',
                        color: 'var(--t2)', fontWeight: 600,
                      }}>{m}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Emergency Voice Dispatch Button on Critical/High Alerts */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {(sev === 'CRITICAL' || sev === 'HIGH') && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDispatch && onDispatch(alert); }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      border: '1px solid #ef4444',
                      color: '#ffffff',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 0 12px rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    <span>⚡ 📞 Dispatch Emergency Voice Call</span>
                  </button>
                )}
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>
                  Direct Section Controller cab intervention for {alert.train_id || 'Train'}
                </span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function Alerts() {
  const [alerts,        setAlerts]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [severity,      setSeverity]      = useState('ALL')
  const [zone,          setZone]          = useState('ALL')
  const [expanded,      setExpanded]      = useState(null)
  const [live,          setLive]          = useState(false)
  const [dispatchAlert, setDispatchAlert] = useState(null)

  const load = async () => {
    try {
      const d = await getAlerts(200)
      setAlerts(d)
      setLive(true)
      // Tier-1: Automatically trigger SMS alert for CRITICAL incidents (with built-in 60s cooldown & deduplication)
      const firstCrit = d.find(a => a.severity === 'CRITICAL')
      if (firstCrit) {
        triggerAutoCriticalSMS(firstCrit).catch(() => {})
      }
    } catch { setLive(false) }
    setLoading(false)
  }
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv) }, [])

  const filtered = alerts
    .filter(a => severity === 'ALL' || a.severity === severity)
    .filter(a => zone === 'ALL' || a.zone === zone)
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))

  const counts = SEVERITIES.reduce((acc, s) => {
    acc[s] = s === 'ALL' ? alerts.length : alerts.filter(a => a.severity === s).length
    return acc
  }, {})

  const recentCrit = alerts.filter(a => a.severity === 'CRITICAL').slice(0, 5)
  const crsMatches = alerts.filter(a => a.crs_match_score > 0.5).slice(0, 5)

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
            <div className="page-header-title">Alert Command Centre</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 20,
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                fontSize: 11,
                fontWeight: 600,
                color: '#4ade80',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                <span>Tier-1 Auto SMS: Armed (+916268069612 on CRITICAL)</span>
              </div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 20,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                fontSize: 11,
                fontWeight: 600,
                color: '#f87171',
              }}>
                <span>📞 Voice Call: Manual Dispatch Only</span>
              </div>
              <div className={`live-pill ${live ? 'warning' : 'offline'}`}>
                <span className="pulse-dot" style={{ background: live ? 'var(--orange)' : 'var(--t4)', animation: live ? 'pulse-dot 1s ease-in-out infinite' : 'none' }} />
                {live ? 'MONITORING' : 'OFFLINE'}
              </div>
            </div>
          </div>
          <div className="page-header-sub">Real-time safety alerts and CRS historical signature analysis · DRISHTI AI</div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 16 }}>

        {/* ── Summary strip ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Total',    value: counts.ALL,      color: 'var(--t1)' },
            { label: 'Critical', value: counts.CRITICAL, color: 'var(--red)' },
            { label: 'High',     value: counts.HIGH,     color: 'var(--orange)' },
            { label: 'Medium',   value: counts.MEDIUM,   color: 'var(--yellow)' },
            { label: 'Low',      value: counts.LOW,      color: 'var(--green)' },
            { label: 'CRS Matches', value: crsMatches.length, color: 'var(--purple)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="stat-card" style={{ flex: 'none', minWidth: 'auto', padding: '10px 16px' }}>
              <div className="stat-card-label">{label}</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16 }}>

          {/* ── Alert table ── */}
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {SEVERITIES.map(s => (
                <button
                  key={s}
                  className={`btn-filter ${severity === s ? `active-${s.toLowerCase()}` : ''}`}
                  onClick={() => setSeverity(s)}
                >
                  {s}{s !== 'ALL' && counts[s] > 0 ? ` (${counts[s]})` : ''}
                </button>
              ))}
              <select
                value={zone}
                onChange={e => setZone(e.target.value)}
                style={{
                  padding: '4px 10px', fontSize: 11.5, borderRadius: 20,
                  border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--t2)',
                  fontFamily: 'IBM Plex Mono, monospace',
                }}
              >
                {ZONES.map(z => <option key={z} value={z}>{z === 'ALL' ? 'All Zones' : z}</option>)}
              </select>
            </div>

            <div className="card">
              {loading ? (
                <div className="empty-state"><div className="empty-state-sub">Loading alerts…</div></div>
              ) : filtered.length === 0 ? (
                <div className="empty-state">
                  <div style={{ fontSize: 24, color: 'var(--green)', marginBottom: 8 }}>✓</div>
                  <div className="empty-state-title">Network Stable</div>
                  <div className="empty-state-sub">No alerts match current filters</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>TIME</th>
                        <th>SEVERITY</th>
                        <th>TRAIN NO.</th>
                        <th>EVENT</th>
                        <th>LOCATION</th>
                        <th>ZONE</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((a, i) => (
                        <AlertRow
                          key={i}
                          alert={a}
                          expanded={expanded === i}
                          onClick={() => setExpanded(expanded === i ? null : i)}
                          onDispatch={(al) => setDispatchAlert(al)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── Right panel ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* CRS Matches */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">CRS Signature Matches</span>
                <span className="badge badge-info">AI</span>
              </div>
              <div className="card-body" style={{ padding: '8px 0 0' }}>
                {crsMatches.length > 0 ? crsMatches.map((a, i) => (
                  <div key={i} style={{ padding: '8px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="mono" style={{ color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.1)', padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                          🚂 {a.train_id || '12301'}
                        </span>
                        <span>{a.station || a.node_id || '—'}</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--t4)', marginTop: 3 }}>{a.alert_type || '—'}</div>
                    </div>
                    <span className="mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--red)' }}>
                      {(a.crs_match_score * 100).toFixed(0)}%
                    </span>
                  </div>
                )) : (
                  <div className="empty-state" style={{ padding: '24px 16px' }}>
                    <div style={{ fontSize: 18, color: 'var(--green)', marginBottom: 4 }}>✓</div>
                    <div className="empty-state-sub">No CRS matches</div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Critical */}
            <div className="card" style={{ borderTop: '3px solid var(--red)' }}>
              <div className="card-header">
                <span className="card-title" style={{ color: 'var(--red)' }}>⚑ Recent Critical</span>
              </div>
              <div className="card-body" style={{ padding: '8px 0 0' }}>
                {recentCrit.length > 0 ? recentCrit.map((a, i) => (
                  <div key={i} style={{ padding: '8px 18px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.1)', padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                        🚂 Train {a.train_id || '12301'}
                      </span>
                      <span style={{ fontSize: 10.5, color: 'var(--t4)' }}>{a.zone || 'ALL'}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', marginTop: 4 }}>{a.alert_type || '—'}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--t4)', marginTop: 1 }}>
                      {a.station || a.node_id || '—'}
                    </div>
                  </div>
                )) : (
                  <div className="empty-state" style={{ padding: '24px 16px' }}>
                    <div style={{ fontSize: 18, color: 'var(--green)', marginBottom: 4 }}>✓</div>
                    <div className="empty-state-sub">No critical alerts</div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {dispatchAlert && (
        <EmergencyDispatchModal
          isOpen={!!dispatchAlert}
          onClose={() => setDispatchAlert(null)}
          initialTrainId={dispatchAlert.train_id || dispatchAlert.node_id || '12301'}
          initialStation={dispatchAlert.station || dispatchAlert.zone || 'Active Corridor'}
          initialReason={dispatchAlert.description || dispatchAlert.alert_type || 'Emergency Safety Intervention'}
        />
      )}
    </div>
  )
}
