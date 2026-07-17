import { useEffect, useRef } from 'react'

// Standard gamepad button indices
const BTN_A            = 0
const BTN_B            = 1
const BTN_X            = 2
const BTN_Y            = 3
const BTN_LEFT_SHOULDER  = 4
const BTN_RIGHT_SHOULDER = 5

export function useGamepad({ onA, onB, onX, onY, onLeftShoulder, onRightShoulder } = {}) {
  const cbRef = useRef({})
  cbRef.current = { onA, onB, onX, onY, onLeftShoulder, onRightShoulder }

  useEffect(() => {
    let rafId
    const prevPressed = {}

    function poll() {
      for (const gp of navigator.getGamepads()) {
        if (!gp) continue
        const prev = prevPressed[gp.index] ??= new Array(gp.buttons.length).fill(false)
        gp.buttons.forEach((btn, i) => {
          if (btn.pressed && !prev[i]) {
            const { onA, onB, onX, onY, onLeftShoulder, onRightShoulder } = cbRef.current
            if (i === BTN_A             && onA)             onA()
            if (i === BTN_B             && onB)             onB()
            if (i === BTN_X             && onX)              onX()
            if (i === BTN_Y             && onY)              onY()
            if (i === BTN_LEFT_SHOULDER  && onLeftShoulder)  onLeftShoulder()
            if (i === BTN_RIGHT_SHOULDER && onRightShoulder) onRightShoulder()
          }
          prev[i] = btn.pressed
        })
      }
      rafId = requestAnimationFrame(poll)
    }

    rafId = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(rafId)
  }, [])
}
