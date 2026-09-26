/**
 * Web Audio API Sound Synthesizer for DRISHTI Operations Room.
 * Generates zero-dependency, authentic railway operations audio cues
 * (Emergency siren, Kavach airbrake release, and VHF radio chirps).
 */

class AudioEngine {
  constructor() {
    this.ctx = null
    this.muted = localStorage.getItem('drishti-audio-muted') === 'true'
  }

  _initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  isMuted() {
    return this.muted
  }

  setMuted(muted) {
    this.muted = muted
    localStorage.setItem('drishti-audio-muted', String(muted))
  }

  toggleMute() {
    this.setMuted(!this.muted)
    return this.muted
  }

  /**
   * Two-tone emergency siren for CRITICAL alerts
   */
  playEmergencySiren() {
    if (this.muted) return
    this._initContext()
    if (!this.ctx) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sawtooth'
    // Modulate pitch between 880Hz and 660Hz (alert warble)
    osc.frequency.setValueAtTime(880, now)
    osc.frequency.setValueAtTime(660, now + 0.15)
    osc.frequency.setValueAtTime(880, now + 0.3)
    osc.frequency.setValueAtTime(660, now + 0.45)
    osc.frequency.setValueAtTime(880, now + 0.6)

    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8)

    osc.connect(gain)
    gain.connect(this.ctx.destination)

    osc.start(now)
    osc.stop(now + 0.8)
  }

  /**
   * Heavy airbrake decompression sound for Kavach TCAS auto-braking
   */
  playKavachBrake() {
    if (this.muted) return
    this._initContext()
    if (!this.ctx) return

    const now = this.ctx.currentTime
    const bufferSize = this.ctx.sampleRate * 1.2
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const noise = this.ctx.createBufferSource()
    noise.buffer = buffer

    // Lowpass filter sweeping downwards to simulate escaping air & slowing wheels
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1400, now)
    filter.frequency.exponentialRampToValueAtTime(200, now + 1.1)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.ctx.destination)

    noise.start(now)
    noise.stop(now + 1.2)
  }

  /**
   * VHF railway radio beep when initiating Twilio emergency voice dispatch
   */
  playRadioChirp() {
    if (this.muted) return
    this._initContext()
    if (!this.ctx) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200, now)
    osc.frequency.setValueAtTime(1800, now + 0.04)

    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12)

    osc.connect(gain)
    gain.connect(this.ctx.destination)

    osc.start(now)
    osc.stop(now + 0.12)
  }

  /**
   * Subtle alert chime for standard notification arrivals
   */
  playChime() {
    if (this.muted) return
    this._initContext()
    if (!this.ctx) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(520, now)
    osc.frequency.setValueAtTime(650, now + 0.08)

    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3)

    osc.connect(gain)
    gain.connect(this.ctx.destination)

    osc.start(now)
    osc.stop(now + 0.3)
  }
}

export const soundFx = new AudioEngine()
