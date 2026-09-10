import { createContext, useContext } from 'react'
import { BRAND } from '../data/theme.js'

// Per-module accents are gone (see brand/BRAND.md §3, §7) — Lantern has one
// brand colour, not a hue per module. This context now always provides
// BRAND regardless of what a module root passes as `accent`; the prop stays
// accepted (rather than deleting it at every one of ~260 call sites) but is
// ignored, so module roots can be migrated off it call by call in a later
// pass without this provider needing to change again.
const CORE_ACCENT = BRAND

const ModuleThemeContext = createContext(CORE_ACCENT)

export function ModuleThemeProvider({ children }) {
  return (
    <ModuleThemeContext.Provider value={CORE_ACCENT}>
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
