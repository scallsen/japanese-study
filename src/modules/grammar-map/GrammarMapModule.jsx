import { useState, useCallback, useMemo, useEffect } from 'react'
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import PageHeader from '../../components/PageHeader.jsx'
import DrawerSectionHeader from '../../components/DrawerSectionHeader.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED } from '../../data/theme.js'
import { GRAMMAR_NODES } from './grammarNodes.js'
import GrammarNode from './GrammarNode.jsx'

const ACCENT = '#8B7CF8'
const STORAGE_KEY = 'grammar-map-known'
const nodeTypes = { grammarNode: GrammarNode }
const PANEL_W = 360
const CHEVRON_W = 28
const PANEL_CONTENT_W = PANEL_W - CHEVRON_W

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const handler = e => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

function loadKnown() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) }
  catch { return new Set() }
}

function saveKnown(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
}

export default function GrammarMapModule() {
  const [known, setKnown] = useState(loadKnown)
  const [selectedId, setSelectedId] = useState(null)
  const [showOptions, setShowOptions] = useState(true)
  const [chevronHovered, setChevronHovered] = useState(false)
  const isMobile = useIsMobile()

  const toggleKnown = useCallback((id) => {
    setKnown(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveKnown(next)
      return next
    })
  }, [])

  const selectedNode = selectedId ? GRAMMAR_NODES.find(n => n.id === selectedId) : null
  const unlockedCount = GRAMMAR_NODES.filter(n => n.prereqs.every(p => known.has(p))).length

  const nodes = useMemo(() => GRAMMAR_NODES.map(n => ({
    id: n.id,
    type: 'grammarNode',
    position: n.position,
    data: {
      label: n.label,
      sublabel: n.sublabel,
      isUnlocked: n.prereqs.every(p => known.has(p)),
      isKnown: known.has(n.id),
      isSelected: n.id === selectedId,
      onToggle: () => toggleKnown(n.id),
      accent: ACCENT,
    },
  })), [known, toggleKnown, selectedId])

  const edges = useMemo(() => GRAMMAR_NODES.flatMap(n =>
    n.prereqs.map(prereqId => ({
      id: `${prereqId}-${n.id}`,
      source: prereqId,
      target: n.id,
      style: {
        stroke: known.has(prereqId) ? ACCENT : '#333',
        strokeWidth: known.has(prereqId) ? 2 : 1.5,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: known.has(prereqId) ? ACCENT : '#333',
      },
    }))
  ), [known])

  function renderPanelContent(px = 16) {
    if (selectedNode) {
      const prereqNodes = selectedNode.prereqs.map(pId => GRAMMAR_NODES.find(n => n.id === pId)).filter(Boolean)
      const dependents = GRAMMAR_NODES.filter(n => n.prereqs.includes(selectedNode.id))

      return (
        <div style={{ padding: `16px ${px}px` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 20, color: TEXT, marginBottom: 4 }}>{selectedNode.label}</div>
              <div style={{ fontSize: 12, color: TEXT_MUTED }}>{selectedNode.sublabel}</div>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              style={{
                background: 'none', border: 'none', color: TEXT_MUTED,
                fontSize: 18, cursor: 'pointer', padding: '0 0 0 8px',
                fontFamily: FONT, lineHeight: 1, flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>

          <div style={{
            padding: '14px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 6,
            fontSize: 12,
            color: TEXT_MUTED,
            lineHeight: 1.7,
            marginBottom: 20,
          }}>
            Grammar detail coming soon.
          </div>

          {prereqNodes.length > 0 && (
            <>
              <DrawerSectionHeader title="Prerequisites" />
              {prereqNodes.map(pNode => (
                <div
                  key={pNode.id}
                  onClick={() => setSelectedId(pNode.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 0', cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 13, color: known.has(pNode.id) ? ACCENT : TEXT }}>{pNode.label}</span>
                    <span style={{ fontSize: 11, color: TEXT_MUTED, marginLeft: 8 }}>{pNode.sublabel}</span>
                  </div>
                  {known.has(pNode.id) && <span style={{ fontSize: 11, color: ACCENT }}>✓</span>}
                </div>
              ))}
              <div style={{ marginBottom: 20 }} />
            </>
          )}

          {dependents.length > 0 && (
            <>
              <DrawerSectionHeader title="Unlocks" />
              {dependents.map(dNode => (
                <div
                  key={dNode.id}
                  onClick={() => setSelectedId(dNode.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 0', cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 13, color: TEXT }}>{dNode.label}</span>
                    <span style={{ fontSize: 11, color: TEXT_MUTED, marginLeft: 8 }}>{dNode.sublabel}</span>
                  </div>
                  {known.has(dNode.id) && <span style={{ fontSize: 11, color: ACCENT }}>✓</span>}
                </div>
              ))}
            </>
          )}
        </div>
      )
    }

    return (
      <div style={{ padding: `16px ${px}px` }}>
        <DrawerSectionHeader title="Progress" />
        <div style={{ marginBottom: 20 }}>
          {[
            { label: 'Known', value: `${known.size} / ${GRAMMAR_NODES.length}` },
            { label: 'Unlocked', value: `${unlockedCount} / ${GRAMMAR_NODES.length}` },
            { label: 'Locked', value: `${GRAMMAR_NODES.length - unlockedCount} / ${GRAMMAR_NODES.length}` },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
              <span style={{ color: TEXT_MUTED }}>{label}</span>
              <span style={{ color: TEXT }}>{value}</span>
            </div>
          ))}
        </div>

        <DrawerSectionHeader title="How to use" />
        <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.65 }}>
          Click any node to view its details. Mark nodes as known to unlock dependent grammar points.
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      position: 'relative',
      width: '100vw',
      height: '100dvh',
      background: '#1E1E1E',
      fontFamily: FONT,
      letterSpacing: TRACKING,
      overflow: 'hidden',
    }}>

      {/* ── Main content column ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <PageHeader
          crumbs={[
            { label: 'Japanese Study', href: '#/' },
            { label: 'Grammar Map' },
          ]}
          rightSlot={
            <span style={{ fontSize: 13, color: TEXT_MUTED }}>
              {known.size} / {GRAMMAR_NODES.length} known
            </span>
          }
        />
        <div style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.25}
            maxZoom={2}
            colorMode="dark"
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
            onNodeClick={(e, node) => { setSelectedId(node.id); setShowOptions(true) }}
            onPaneClick={() => setSelectedId(null)}
          >
            <Background color="#282828" gap={24} />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {/* ── Desktop sidebar ── */}
      {!isMobile && (
        <>
          <div
            onClick={() => setShowOptions(v => !v)}
            onMouseEnter={() => setChevronHovered(true)}
            onMouseLeave={() => setChevronHovered(false)}
            style={{
              flexShrink: 0,
              width: CHEVRON_W,
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              borderRight: showOptions ? '1px solid rgba(255,255,255,0.1)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              background: chevronHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
              transition: 'background 130ms',
            }}
          >
            <button style={{
              width: CHEVRON_W, height: 44,
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.5)', fontSize: 14,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit', padding: 0,
            }}>
              {showOptions ? '›' : '‹'}
            </button>
          </div>
          <div style={{
            flexShrink: 0,
            width: showOptions ? PANEL_CONTENT_W : 0,
            overflow: 'hidden',
            transition: 'width 220ms ease',
          }}>
            <div style={{ width: PANEL_CONTENT_W, height: '100%', overflowY: 'auto' }}>
              {renderPanelContent(16)}
            </div>
          </div>
        </>
      )}

    </div>
  )
}
