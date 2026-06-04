import { useRef } from 'react'

async function getCtx(ctxRef) {
  if (!ctxRef.current) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    ctxRef.current = new Ctx()
  }
  if (ctxRef.current.state === 'suspended') await ctxRef.current.resume()
  return ctxRef.current
}

function tone(ctx, { freq, freqEnd, vol, type = 'triangle', duration, offset = 0 }) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  const t = ctx.currentTime + offset
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration)
  gain.gain.setValueAtTime(vol, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
  osc.start(t)
  osc.stop(t + duration + 0.01)
}

export function useSFX() {
  const ctxRef = useRef(null)

  async function play(name, { pitchFactor = 1 } = {}) {
    const ctx = await getCtx(ctxRef)
    if (name === 'flip_card') {
      tone(ctx, { freq: 1000, freqEnd: 500, vol: 0.15, duration: 0.1 })
    } else if (name === 'draw_card') {
      tone(ctx, { freq: 900, freqEnd: 300, vol: 0.12, duration: 0.1, offset: 0 })
      tone(ctx, { freq: 400, freqEnd: 900, vol: 0.15, duration: 0.1, offset: 0.14 })
    } else if (name === 'flip_card_correct') {
      tone(ctx, { freq: 350 * pitchFactor, freqEnd: 600 * pitchFactor, vol: 0.18, type: 'sine', duration: 0.1, offset: 0 })
      tone(ctx, { freq: 600 * pitchFactor, freqEnd: 1100 * pitchFactor, vol: 0.18, type: 'sine', duration: 0.12, offset: 0.12 })
    } else if (name === 'flip_card_wrong') {
      tone(ctx, { freq: 330, freqEnd: 240, vol: 0.18, type: 'triangle', duration: 0.18, offset: 0 })
      tone(ctx, { freq: 240, freqEnd: 140, vol: 0.18, type: 'triangle', duration: 0.24, offset: 0.16 })
    } else if (name === 'undo') {
      tone(ctx, { freq: 900, freqEnd: 70, vol: 0.22, type: 'sawtooth', duration: 0.12, offset: 0 })
      tone(ctx, { freq: 700, freqEnd: 55, vol: 0.18, type: 'sawtooth', duration: 0.12, offset: 0.17 })
    } else if (name === 'best_streak_broken') {
      tone(ctx, { freq: 420, freqEnd: 330, vol: 0.26, type: 'triangle', duration: 0.16, offset: 0 })
      tone(ctx, { freq: 350, freqEnd: 270, vol: 0.26, type: 'triangle', duration: 0.16, offset: 0.14 })
      tone(ctx, { freq: 260, freqEnd: 120, vol: 0.32, type: 'triangle', duration: 0.38, offset: 0.28 })
    }
  }

  return { play }
}
