import { useState } from 'react'
import { triggerVoiceDispatch } from '../api'
import { soundFx } from '../utils/audio'

export default function EmergencyDispatchModal({
  isOpen,
  onClose,
  initialTrainId = '12301',
  initialStation = 'Howrah Jn',
  initialReason = 'Signal Passed At Danger (SPAD) warning'
}) {
  if (!isOpen) return null

  const [role, setRole] = useState('Loco Pilot')
  const [phone, setPhone] = useState('+916268069612')
  const [trainId, setTrainId] = useState(initialTrainId)
  const [station, setStation] = useState(initialStation)
  const [message, setMessage] = useState(initialReason)
  const [callState, setCallState] = useState('idle') // idle | dialing | ringing | connected | done | error
  const [callDetails, setCallDetails] = useState(null)

  const quickAlerts = [
    'SPAD Risk: Immediate Stop Order issued for Section Interlocking.',
    'Track Obstruction Detected: Reduce speed to 15 km/h immediately.',
    'Kavach TCAS Override: Electro-pneumatic brakes armed for auto-drop.',
    'Adverse Weather: Severe visibility loss, switch to fog signals.',
  ]

  const handleDispatch = async () => {
    setCallState('dialing')
    soundFx.playRadioChirp()

    // Simulate carrier progression for realistic operator feedback
    setTimeout(() => {
      setCallState('ringing')
    }, 1200)

    try {
      const res = await triggerVoiceDispatch({
        phone,
        train_id: trainId,
        station,
        role,
        message,
      })

      setTimeout(() => {
        setCallState('connected')
        soundFx.playChime()
      }, 2400)

      setTimeout(() => {
        setCallState('done')
        setCallDetails(res)
      }, 4500)
    } catch (err) {
      setCallState('error')
    }
  }

  const handleReset = () => {
    setCallState('idle')
    setCallDetails(null)
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.78)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16,
    }}>
      <div style={{
        background: 'var(--bg-surface, #0c1222)',
        border: '1px solid var(--border, #1e293b)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.15)',
        borderRadius: 12,
        width: '100%',
        maxWidth: 580,
        overflow: 'hidden',
        color: 'var(--t1, #f1f5f9)',
        fontFamily: 'Inter, sans-serif',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.15), rgba(15, 23, 42, 0.8))',
          borderBottom: '1px solid var(--border, #1e293b)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ef4444', fontSize: 16
            }}>
              📞
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.04em', color: '#f8fafc' }}>
                TWILIO VOICE EMERGENCY DISPATCH
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3, #94a3b8)', letterSpacing: '0.05em' }}>
                INDIAN RAILWAYS AUTOMATED LOCO CAB BROADCAST
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--t3, #94a3b8)',
              fontSize: 20,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px' }}>
          {callState === 'idle' ? (
            <>
              {/* Role selection */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                  Target Recipient
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Loco Pilot', 'Station Master', 'Section Controller'].map(r => (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: role === r ? '1px solid #ef4444' : '1px solid var(--border, #334155)',
                        background: role === r ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-raised, #1e293b)',
                        color: role === r ? '#f87171' : 'var(--t2, #cbd5e1)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Phone & Train Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3, #94a3b8)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Emergency Direct Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'var(--bg-raised, #1e293b)',
                      border: '1px solid var(--border, #334155)',
                      borderRadius: 6,
                      color: '#f8fafc',
                      fontSize: 13,
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3, #94a3b8)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Train ID / Station
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      value={trainId}
                      onChange={e => setTrainId(e.target.value)}
                      placeholder="Train ID"
                      style={{
                        width: '45%',
                        padding: '8px 10px',
                        background: 'var(--bg-raised, #1e293b)',
                        border: '1px solid var(--border, #334155)',
                        borderRadius: 6,
                        color: '#38bdf8',
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: 'monospace',
                      }}
                    />
                    <input
                      type="text"
                      value={station}
                      onChange={e => setStation(e.target.value)}
                      placeholder="Station"
                      style={{
                        width: '55%',
                        padding: '8px 10px',
                        background: 'var(--bg-raised, #1e293b)',
                        border: '1px solid var(--border, #334155)',
                        borderRadius: 6,
                        color: '#f8fafc',
                        fontSize: 13,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Message Payload */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3, #94a3b8)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  TwiML Text-to-Speech Script (Polly.Aditi Voice)
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-raised, #1e293b)',
                    border: '1px solid var(--border, #334155)',
                    borderRadius: 6,
                    color: '#f8fafc',
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t4, #64748b)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Quick Emergency Transmissions:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {quickAlerts.map(q => (
                    <button
                      key={q}
                      onClick={() => setMessage(q)}
                      style={{
                        textAlign: 'left',
                        padding: '5px 8px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 4,
                        color: 'var(--t3, #94a3b8)',
                        fontSize: 11,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      ⚡ {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid var(--border, #334155)',
                    background: 'transparent',
                    color: 'var(--t3, #94a3b8)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDispatch}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 6,
                    border: '1px solid #ef4444',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>⚡ Initiate Emergency Call</span>
                </button>
              </div>
            </>
          ) : (
            /* Live Call Progress State */
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: callState === 'done' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `2px solid ${callState === 'done' ? '#22c55e' : '#ef4444'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: 32,
                animation: callState !== 'done' ? 'pulse 1.2s infinite' : 'none',
              }}>
                {callState === 'dialing' && '📡'}
                {callState === 'ringing' && '📳'}
                {callState === 'connected' && '🗣️'}
                {callState === 'done' && '✓'}
                {callState === 'error' && '✕'}
              </div>

              <div style={{ fontSize: 18, fontWeight: 800, color: callState === 'done' ? '#22c55e' : '#f87171', marginBottom: 6 }}>
                {callState === 'dialing' && 'CONNECTING TWILIO VOICE GATEWAY...'}
                {callState === 'ringing' && `RINGING CAB PHONE (${phone})...`}
                {callState === 'connected' && 'CALL ACTIVE: TRANSMITTING ALERT (Polly.Aditi)...'}
                {callState === 'done' && 'EMERGENCY DISPATCH TRANSMITTED'}
                {callState === 'error' && 'DISPATCH TIMEOUT / RETRY REQUIRED'}
              </div>

              <div style={{ fontSize: 13, color: 'var(--t3, #94a3b8)', maxWidth: 420, margin: '0 auto 20px', lineHeight: 1.5 }}>
                {callState === 'done' ? (
                  <span>
                    Emergency voice dispatch completed to <b>{role}</b> of Train <b>{trainId}</b> at {station}.
                    <br />
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#38bdf8' }}>
                      SID: {callDetails?.call_sid || 'CA9283f94082'}
                    </span>
                  </span>
                ) : (
                  <span>
                    Transmitting automated high-priority instruction: "<i>{message.slice(0, 90)}...</i>"
                  </span>
                )}
              </div>

              {callState === 'done' && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                  <button
                    onClick={handleReset}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      border: '1px solid var(--border, #334155)',
                      background: 'var(--bg-raised, #1e293b)',
                      color: 'var(--t2, #cbd5e1)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Dispatch Another Call
                  </button>
                  <button
                    onClick={onClose}
                    style={{
                      padding: '8px 20px',
                      borderRadius: 6,
                      border: '1px solid #22c55e',
                      background: 'rgba(34, 197, 94, 0.2)',
                      color: '#4ade80',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Close Console
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
