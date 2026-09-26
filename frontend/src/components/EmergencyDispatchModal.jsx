import { useState } from 'react'
import { triggerVoiceDispatch } from '../api'
import { soundFx } from '../utils/audio'

export default function EmergencyDispatchModal({
  isOpen,
  onClose,
  initialTrainId = '12301',
  initialStation = 'Howrah Jn',
  initialReason = 'Point detection anomaly at interlocking crossover. Reverse points not locked to main line.'
}) {
  if (!isOpen) return null

  const [role, setRole] = useState('Loco Pilot')
  const [phone, setPhone] = useState('+916268069612')
  const [trainId, setTrainId] = useState(initialTrainId)
  const [station, setStation] = useState(initialStation)
  const [reason, setReason] = useState(initialReason)
  const [actionOrder, setActionOrder] = useState('Immediate speed reduction to 15 km/h. Halt at outer home signal.')
  const [callState, setCallState] = useState('idle') // idle | dialing | ringing | connected | done | error
  const [callDetails, setCallDetails] = useState(null)
  const [activeChannel, setActiveChannel] = useState('voice') // 'voice' | 'sms'

  const quickReasons = [
    'Point Interlocking Crossover Mismatch — Reverse points not locked to main line',
    'Signal Passed At Danger (SPAD) Warning — Headway compression detected',
    'Track Obstruction & Rail Fracture Detected ahead on corridor',
    'Hot Axle Bearing Thermal Anomaly exceeding safety threshold',
  ]

  const quickOrders = [
    'Immediate speed reduction to 15 km/h and stand by for Kavach auto-drop.',
    'Halt train immediately at outer home signal. Do not advance past point.',
    'Emergency brake application ordered by Section Controller. Isolate traction.',
  ]

  const handleDispatch = async (channel = 'voice') => {
    setActiveChannel(channel)
    setCallState('dialing')
    soundFx.playRadioChirp()

    try {
      const res = await triggerVoiceDispatch({
        phone,
        train_id: trainId,
        station,
        role,
        reason,
        action: actionOrder,
        channel,
        message: `${reason}. Order: ${actionOrder}`,
      })

      if (res && res.status === 'ok') {
        if (channel === 'sms') {
          setCallState('done')
          setCallDetails(res)
          soundFx.playChime()
        } else {
          setCallState('ringing')
          setTimeout(() => {
            setCallState('connected')
            soundFx.playChime()
          }, 1200)

          setTimeout(() => {
            setCallState('done')
            setCallDetails(res)
          }, 3000)
        }
      } else {
        setCallState('error')
        setCallDetails(res)
      }
    } catch (err) {
      setCallState('error')
      setCallDetails({ error: err.message })
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
        maxWidth: 620,
        maxHeight: '92vh',
        overflowY: 'auto',
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
                EMERGENCY DISPATCH CONSOLE
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3, #94a3b8)', letterSpacing: '0.05em' }}>
                TWILIO VOICE & SMS DIRECT INTERVENTION GATEWAY
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--t3, #94a3b8)',
              fontSize: 22,
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 20 }}>
          {callState === 'idle' && (
            <>
              {/* Recipient Role Selection */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3, #94a3b8)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Target Recipient Crew
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['Loco Pilot', 'Station Master', 'Guard', 'Section Controller'].map(r => (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      style={{
                        flex: 1,
                        padding: '7px 10px',
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
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

              {/* 1. Explicit Reason for Call */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase' }}>
                    📢 1. Emergency Reason (Spoken Loudly & Repeated by AI Voice)
                  </label>
                  <span style={{ fontSize: 10, color: 'var(--t4, #64748b)' }}>Twilio Polly.Aditi voice</span>
                </div>
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Point detection failure at crossover circuit"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-raised, #1e293b)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: 6,
                    color: '#fef2f2',
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                  {quickReasons.map(qr => (
                    <button
                      key={qr}
                      onClick={() => setReason(qr)}
                      style={{
                        fontSize: 10.5,
                        padding: '3px 7px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 4,
                        color: 'var(--t3, #94a3b8)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      ⚡ {qr.split('—')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Controller Action Order */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3, #94a3b8)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  🛑 2. Controller Action Order
                </label>
                <input
                  type="text"
                  value={actionOrder}
                  onChange={e => setActionOrder(e.target.value)}
                  placeholder="e.g. Immediate speed reduction to 15 km/h"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-raised, #1e293b)',
                    border: '1px solid var(--border, #334155)',
                    borderRadius: 6,
                    color: '#f8fafc',
                    fontSize: 12.5,
                  }}
                />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                  {quickOrders.map(qo => (
                    <button
                      key={qo}
                      onClick={() => setActionOrder(qo)}
                      style={{
                        fontSize: 10.5,
                        padding: '3px 7px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 4,
                        color: 'var(--t3, #94a3b8)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      ⚡ {qo.split('.')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Audio Script Preview Box */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid #1e293b',
                borderRadius: 6,
                padding: '10px 12px',
                marginBottom: 18,
                fontSize: 11,
                lineHeight: 1.5,
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.05em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🎙️ TWILIO LIVE VOICE PREVIEW (What the {role} will hear):</span>
                </div>
                <div style={{ color: '#cbd5e1', fontStyle: 'italic' }}>
                  "(2s pause)... Emergency Alert. Emergency Alert. Calling {role} of train {trainId} approaching {station}. <strong style={{ color: '#f87171' }}>The critical reason for this emergency call is: {reason || 'Safety alert'}. I repeat, the reason for this emergency call is: {reason || 'Safety alert'}.</strong> Direct order from Section Controller: {actionOrder}. Acknowledge and comply immediately. (2s pause & repeats)..."
                </div>
              </div>

              {/* Action Buttons: Direct Voice Call & Direct SMS */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid var(--border, #334155)',
                    background: 'transparent',
                    color: 'var(--t3, #94a3b8)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleDispatch('sms')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      border: '1px solid #0284c7',
                      background: 'rgba(2, 132, 199, 0.15)',
                      color: '#38bdf8',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>💬 Send Direct SMS</span>
                  </button>
                  <button
                    onClick={() => handleDispatch('voice')}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 6,
                      border: '1px solid #ef4444',
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: '#ffffff',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>⚡ 📞 Dispatch Voice Call</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {callState !== 'idle' && (
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
                {callState === 'dialing' && (activeChannel === 'sms' ? 'TRANSMITTING EMERGENCY SMS VIA GATEWAY...' : 'CONNECTING TWILIO VOICE GATEWAY...')}
                {callState === 'ringing' && `RINGING CAB PHONE (${phone})...`}
                {callState === 'connected' && 'CALL ACTIVE: SPEAKING EMERGENCY REASON (Polly.Aditi)...'}
                {callState === 'done' && (activeChannel === 'sms' ? 'EMERGENCY SMS DISPATCHED' : 'EMERGENCY VOICE CALL TRANSMITTED')}
                {callState === 'error' && 'DISPATCH TIMEOUT / RETRY REQUIRED'}
              </div>

              <div style={{ fontSize: 13, color: 'var(--t3, #94a3b8)', maxWidth: 460, margin: '0 auto 20px', lineHeight: 1.5 }}>
                {callState === 'done' ? (
                  <span>
                    Emergency dispatch completed to <b>{role}</b> of Train <b>{trainId}</b> at {station}.
                    <br />
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#38bdf8' }}>
                      SID: {callDetails?.call_sid || callDetails?.message_sid || 'CA9283f94082'}
                    </span>
                  </span>
                ) : (
                  <span>
                    Spoken Reason: "<i>{reason}</i>"
                  </span>
                )}
              </div>

              {(callState === 'done' || callState === 'error') && (
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
                    {callState === 'error' ? 'Retry Dispatch' : 'Dispatch Another Transmission'}
                  </button>
                  <button
                    onClick={onClose}
                    style={{
                      padding: '8px 20px',
                      borderRadius: 6,
                      border: callState === 'error' ? '1px solid #ef4444' : '1px solid #22c55e',
                      background: callState === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                      color: callState === 'error' ? '#f87171' : '#4ade80',
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
