import { createContext, useContext } from 'react'

// Every module carries its own accent as a deliberate identity signal (anime
// vocab pink, immersion red, grammar map purple…). Passing that accent as a
// prop to every accent-aware component at every call site is easy to forget,
// and forgetting it fails silently — the component just renders in core teal
// inside a pink module. Making it ambient removes that whole failure mode.
//
// Source of truth for the values themselves stays `accent` in
// src/data/modules.js; a module root passes its own down:
//
//   <ModuleThemeProvider accent={ANIME_ACCENT}>…</ModuleThemeProvider>
//
// Outside any provider the core teal is used, which is correct for the
// dashboard and other cross-module surfaces.
const CORE_ACCENT = '#3ABDA4'

const ModuleThemeContext = createContext(CORE_ACCENT)

export function ModuleThemeProvider({ accent, children }) {
  return (
    <ModuleThemeContext.Provider value={accent ?? CORE_ACCENT}>
      {children}
    </ModuleThemeContext.Provider>
  )
}

// Components call this with their own `accent` prop, if any — an explicit
// prop always wins over the ambient module accent, so a one-off override
// stays possible without reaching for a nested provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useAccent(override) {
  const contextAccent = useContext(ModuleThemeContext)
  return override ?? contextAccent
}
