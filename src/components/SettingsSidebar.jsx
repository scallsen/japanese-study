import { useState } from 'react'
import { FS_BASE } from '../data/theme.js'

const PANEL_W = 420
const CHEVRON_W = 28
const PANEL_CONTENT_W = PANEL_W - CHEVRON_W

// Keeps focused rows (e.g. a Select opened via keyboard) inside the
// scrollable panel instead of letting the browser's default focus-scroll
// yank the whole page.
function handleSidebarFocus(e) {
  const container = e.currentTarget
  const target = e.target
  const cRect = container.getBoundingClientRect()
  const tRect = target.getBoundingClientRect()
  if (tRect.top < cRect.top + 8) container.scrollTop += tRect.top - cRect.top - 8
  else if (tRect.bottom > cRect.bottom - 8) container.scrollTop += tRect.bottom - cRect.bottom + 8
}

// Settings sidebar — desktop: a persistent chevron strip that widens/collapses
// an adjoining panel (flex siblings of the main content). Mobile: the chevron
// is hidden and `open` instead renders a full-screen overlay with a "Back"
// header. Extracted from VocabPage.jsx's own sidebar so every drill screen
// that wants Vocab Drill's settings UI (VocabPage, Anime Vocab's EpisodeDrill)
// shares the exact same component rather than a lookalike reimplementation.
//
// Expects to be rendered as a flex sibling of the main content inside a
// `position: relative` row with a defined height (mirrors VocabPage's own
// layout) — the mobile overlay positions `absolute` against that ancestor.
//
// `children` is a render-prop `(paddingH) => node` so callers can match
// VocabPage's own panel-content padding convention (16 desktop / 20 mobile).
export default function SettingsSidebar({ open, onToggle, onClose, isMobile, children }) {
  const [chevronHovered, setChevronHovered] = useState(false)

  return (
    <>
      {/* ── Desktop sidebar ── */}
      {!isMobile && (
        <>
          <div
            onClick={onToggle}
            onMouseEnter={() => setChevronHovered(true)}
            onMouseLeave={() => setChevronHovered(false)}
            style={{
              flexShrink: 0,
              width: CHEVRON_W,
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              borderRight: open ? '1px solid rgba(255,255,255,0.1)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              background: chevronHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
              transition: 'background 130ms',
            }}>
            <button style={{
              width: CHEVRON_W, height: 44,
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.5)', fontSize: FS_BASE,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit', padding: 0,
            }}>
              {open ? '›' : '‹'}
            </button>
          </div>
          <div style={{
            flexShrink: 0,
            width: open ? PANEL_CONTENT_W : 0,
            overflow: 'hidden',
            transition: 'width 220ms ease',
          }}>
            <div className="sidebar-scroll" style={{ width: PANEL_CONTENT_W, height: '100%', overflowY: 'auto' }} onFocus={handleSidebarFocus}>
              {children(16)}
            </div>
          </div>
        </>
      )}

      {/* ── Mobile overlay ── */}
      {isMobile && open && (
        <>
          <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 20 }} />
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 30, background: '#2E2E2E',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ color: '#fff', fontSize: FS_BASE, fontWeight: 700 }}>Options</div>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: FS_BASE, fontFamily: 'inherit', cursor: 'pointer', padding: 0 }}
              >
                Back
              </button>
            </div>
            <div className="sidebar-scroll" style={{ flex: 1, overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom)' }} onFocus={handleSidebarFocus}>
              {children(20)}
            </div>
          </div>
        </>
      )}
    </>
  )
}
