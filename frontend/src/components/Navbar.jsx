import { useState, useEffect, useCallback } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { API_BASE } from '../api'

// ── Navigation groups ─────────────────────────────────────────────────────────
const GROUPS = [
  {
    label: 'Operations',
    items: [
      { to: '/dashboard',  label: 'Dashboard',  icon: '▣' },
      { to: '/trains',     label: 'Trains',      icon: '⊡' },
      { to: '/alerts',     label: 'Alerts',      icon: '⚑' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/ai',          label: 'AI Models',   icon: '◈' },
      { to: '/ai-decisions',label: 'Decisions',   icon: '⊕' },
      { to: '/inference',   label: 'Inference',   icon: '⊗' },
      { to: '/simulation',  label: 'Simulation',  icon: '⊘' },
    ],
  },
  {
    label: 'Network',
    items: [
      { to: '/network',  label: 'Map',        icon: '◎' },
      { to: '/pilot',    label: 'HWH Pilot',  icon: '⊛' },
      { to: '/system',   label: 'System',     icon: '⊞' },
    ],
  },
]

// ── IST Clock ─────────────────────────────────────────────────────────────────
function ISTClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      }))
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [])
  return (
    <div style={{ textAlign: 'right', lineHeight: 1.3, userSelect: 'none' }}>
      <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', letterSpacing: '0.04em' }}>{time}</div>
      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--t4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>IST</div>
    </div>
  )
}

// ── Dark Mode Toggle ──────────────────────────────────────────────────────────
function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('drishti-theme') === 'dark' } catch { return false }
  })

  const toggle = useCallback(() => {
    setDark(prev => {
      const next = !prev
      document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
      try { localStorage.setItem('drishti-theme', next ? 'dark' : 'light') } catch {}
      return next
    })
  }, [])

  return (
    <button
      onClick={toggle}
      title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        background: 'var(--bg-raised)',
        color: 'var(--t3)',
        fontSize: 12, fontWeight: 600,
        transition: 'all var(--fast)',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 14 }}>{dark ? '☀' : '☾'}</span>
      <span style={{ fontSize: 11 }}>{dark ? 'Light' : 'Dark'}</span>
    </button>
  )
}

// ── Main Navbar ───────────────────────────────────────────────────────────────
export default function Navbar() {
  const navigate = useNavigate()
  const [critCount, setCritCount] = useState(0)
  const [connected, setConnected] = useState(false)

  // Apply saved theme on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('drishti-theme')
      if (saved) document.documentElement.setAttribute('data-theme', saved)
    } catch {}
  }, [])

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`)
        const d = await res.json()
        setConnected(d.success === true || d.status === 'ok' || d.status === 'healthy')
      } catch { setConnected(false) }
    }
    check()
    const healthIv = setInterval(check, 30000)

    const loadAlerts = async () => {
      try {
        const res = await fetch(`${API_BASE}/alerts/history?limit=50`)
        if (res.ok) {
          const d = await res.json()
          const arr = Array.isArray(d) ? d : (d.alerts ?? [])
          setCritCount(arr.filter(a => a.severity === 'CRITICAL').length)
        }
      } catch { /* silent */ }
    }
    loadAlerts()
    const alertIv = setInterval(loadAlerts, 20000)

    return () => { clearInterval(healthIv); clearInterval(alertIv) }
  }, [])

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      height: 'var(--nav-h)',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      boxShadow: 'var(--shadow-xs)',
      display: 'flex', alignItems: 'center',
      padding: '0 20px',
      gap: 8,
      zIndex: 1000,
    }}>

      {/* ── Logo / Identity ── */}
      <button
        onClick={() => navigate('/')}
        style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, padding: '4px 8px', borderRadius: 'var(--r-sm)', transition: 'background var(--fast)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {/* Track icon */}
        <div style={{
          width: 30, height: 30, borderRadius: 6,
          background: 'var(--blue)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 1px 3px rgba(26,70,168,0.3)',
        }}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 900, lineHeight: 1 }}>D</span>
        </div>
        <div style={{ textAlign: 'left', lineHeight: 1.25 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--t1)', letterSpacing: '0.06em' }}>DRISHTI</div>
          <div style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--t4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Railway Intelligence Grid</div>
        </div>
      </button>

      {/* ── Vertical divider ── */}
      <div style={{ width: 1, height: 32, background: 'var(--border)', flexShrink: 0, margin: '0 4px' }} />

      {/* ── Navigation groups ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1, overflowX: 'auto' }}>
        {GROUPS.map((group, gi) => (
          <div key={group.label} style={{ display: 'flex', alignItems: 'center' }}>
            {gi > 0 && (
              <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 6px', flexShrink: 0 }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {group.items.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 11px',
                    borderRadius: 'var(--r-xs)',
                    color: isActive ? 'var(--blue)' : 'var(--t3)',
                    fontSize: 12.5, fontWeight: isActive ? 700 : 500,
                    background: isActive ? 'var(--blue-light)' : 'transparent',
                    border: isActive ? '1px solid var(--blue-border)' : '1px solid transparent',
                    textDecoration: 'none',
                    transition: 'all var(--fast)',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.01em',
                    position: 'relative',
                  })}
                  onMouseEnter={e => {
                    if (!e.currentTarget.style.background.includes('blue-light'))
                      e.currentTarget.style.background = 'var(--bg-raised)'
                  }}
                  onMouseLeave={e => {
                    const active = e.currentTarget.className.includes('active')
                    if (!e.currentTarget.getAttribute('aria-current'))
                      e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{icon}</span>
                  <span>{label}</span>
                  {/* Alerts badge */}
                  {to === '/alerts' && critCount > 0 && (
                    <span style={{
                      background: 'var(--red)',
                      color: '#fff',
                      fontSize: 9, fontWeight: 800,
                      padding: '1px 5px', borderRadius: 10,
                      lineHeight: 1.5, fontFamily: 'IBM Plex Mono, monospace',
                    }}>{critCount}</span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Right controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>

        <ISTClock />

        <div style={{ width: 1, height: 28, background: 'var(--border)' }} />

        <ThemeToggle />

        <div style={{ width: 1, height: 28, background: 'var(--border)' }} />

        {/* Connection status */}
        <div className={`live-pill ${connected ? 'online' : 'offline'}`}>
          <span
            className="pulse-dot"
            style={{
              background: connected ? 'var(--green)' : 'var(--t4)',
              animation: connected ? 'pulse-dot 1.8s ease-in-out infinite' : 'none',
            }}
          />
          {connected ? 'LIVE' : 'OFFLINE'}
        </div>
      </div>
    </nav>
  )
}
