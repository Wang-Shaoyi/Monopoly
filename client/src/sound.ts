let audio: AudioContext | null = null

function ctx(): AudioContext | null {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!audio) audio = new AC()
  if (audio.state === 'suspended') void audio.resume()
  return audio
}

export function unlockAudio() {
  ctx()
}

function tone(freq: number, duration: number, type: OscillatorType, peak = 0.06, delay = 0) {
  const c = ctx()
  if (!c) return
  const t = c.currentTime + delay
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(t)
  osc.stop(t + duration + 0.02)
}

function noise(duration: number, peak = 0.04, freq = 900, delay = 0) {
  const c = ctx()
  if (!c) return
  const t = c.currentTime + delay
  const length = Math.max(1, Math.floor(c.sampleRate * duration))
  const buffer = c.createBuffer(1, length, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  const source = c.createBufferSource()
  source.buffer = buffer
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = 0.8
  const gain = c.createGain()
  gain.gain.setValueAtTime(peak, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(c.destination)
  source.start(t)
  source.stop(t + duration + 0.02)
}

export const sfx = {
  roll() {
    noise(0.42, 0.045, 1300)
    tone(190, 0.07, 'square', 0.03, 0.05)
    tone(240, 0.06, 'square', 0.025, 0.16)
    tone(160, 0.08, 'square', 0.028, 0.28)
  },
  step() {
    tone(280, 0.05, 'triangle', 0.045)
  },
  land() {
    tone(150, 0.12, 'sine', 0.07)
    tone(90, 0.16, 'triangle', 0.03, 0.02)
  },
  coin() {
    tone(880, 0.1, 'sine', 0.05)
    tone(1320, 0.14, 'sine', 0.04, 0.08)
  },
  shuffle() {
    noise(0.28, 0.04, 2100)
    noise(0.18, 0.03, 1600, 0.12)
  },
  reveal() {
    tone(523, 0.1, 'triangle', 0.05)
    tone(784, 0.16, 'triangle', 0.04, 0.08)
  },
  jail() {
    tone(98, 0.22, 'sawtooth', 0.035)
    tone(62, 0.3, 'triangle', 0.04, 0.05)
  },
  thud() {
    tone(110, 0.12, 'triangle', 0.04)
  },
  tap() {
    tone(440, 0.05, 'sine', 0.03)
  },
  win() {
    ;[523, 659, 784, 1046].forEach((freq, index) => tone(freq, 0.18, 'triangle', 0.05, index * 0.12))
  },
}
