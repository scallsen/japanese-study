import { useRef } from 'react'

// Web Audio API playback instead of HTMLMediaElement.play(), because the
// latter re-checks the browser's autoplay/user-activation policy on every
// call. Gamepad button presses (used for Bluetooth remote flip controls)
// never grant user activation per spec, so play() intermittently rejects
// when triggered that way. An AudioContext only needs activation once, at
// resume() time, and then stays usable for any later scheduled playback.
async function getCtx(ctxRef) {
  if (!ctxRef.current) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    ctxRef.current = new Ctx()
  }
  if (ctxRef.current.state === 'suspended') await ctxRef.current.resume()
  return ctxRef.current
}

export function useVoicevoxPlayer() {
  const ctxRef = useRef(null)
  const bufferCacheRef = useRef(new Map()) // url -> Promise<AudioBuffer>
  const sourceRef = useRef(null)
  const tokenRef = useRef(0)

  function loadBuffer(url) {
    const cache = bufferCacheRef.current
    let entry = cache.get(url)
    if (!entry) {
      entry = fetch(url)
        .then(res => res.arrayBuffer())
        .then(async data => (await getCtx(ctxRef)).decodeAudioData(data))
      cache.set(url, entry)
    }
    return entry
  }

  function preload(url) {
    loadBuffer(url).catch(() => {})
  }

  function trimPreload(urls) {
    const keep = new Set(urls)
    for (const url of bufferCacheRef.current.keys()) {
      if (!keep.has(url)) bufferCacheRef.current.delete(url)
    }
  }

  function stop() {
    tokenRef.current++
    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch { /* already stopped */ }
      sourceRef.current = null
    }
  }

  async function play(url) {
    stop()
    const token = tokenRef.current
    try {
      const [ctx, buffer] = await Promise.all([getCtx(ctxRef), loadBuffer(url)])
      if (token !== tokenRef.current) return // superseded by a newer play()/stop() while loading
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start()
      sourceRef.current = source
    } catch {
      // network/decode failure — nothing to play
    }
  }

  return { play, stop, preload, trimPreload }
}
