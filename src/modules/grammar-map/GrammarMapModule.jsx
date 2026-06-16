import { useState, useMemo, useEffect } from 'react'
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import PageHeader from '../../components/PageHeader.jsx'
import DrawerSectionHeader from '../../components/DrawerSectionHeader.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED } from '../../data/theme.js'
import { GRAMMAR_NODES } from './grammarNodes.js'
import { computeLayout } from './layout.js'
import GrammarNode from './GrammarNode.jsx'

const ACCENT = '#8B7CF8'
const STORAGE_KEY = 'grammar-map-known'
const nodeTypes = { grammarNode: GrammarNode }
const PANEL_W = 380
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

const CORE_LEVELS = new Set(['N5', 'N4'])

// All edges — filtered per render based on visible node set
const ALL_EDGES = GRAMMAR_NODES.flatMap(n =>
  n.prereqs.map(prereqId => ({
    id: `${prereqId}-${n.id}`,
    source: prereqId,
    target: n.id,
  }))
)

export default function GrammarMapModule() {
  const [known, setKnown] = useState(loadKnown)
  const [selectedId, setSelectedId] = useState(null)
  const [showOptions, setShowOptions] = useState(true)
  const [chevronHovered, setChevronHovered] = useState(false)
  const [coreOnly, setCoreOnly] = useState(false)
  const isMobile = useIsMobile()

  const toggleKnown = (id) => {
    setKnown(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveKnown(next)
      return next
    })
  }

  const visibleGrammarNodes = useMemo(() =>
    coreOnly ? GRAMMAR_NODES.filter(n => CORE_LEVELS.has(n.jlptLevel)) : GRAMMAR_NODES
  , [coreOnly])

  const visibleIds = useMemo(() => new Set(visibleGrammarNodes.map(n => n.id)), [visibleGrammarNodes])

  const visibleEdges = useMemo(() =>
    ALL_EDGES.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))
  , [visibleIds])

  const positionMap = useMemo(() => {
    const laid = computeLayout(
      visibleGrammarNodes.map(n => ({ id: n.id, position: n.position })),
      visibleEdges
    )
    return Object.fromEntries(laid.map(n => [n.id, n.position]))
  }, [visibleGrammarNodes, visibleEdges])

  const selectedNode = selectedId ? GRAMMAR_NODES.find(n => n.id === selectedId) : null
  const unlockedCount = visibleGrammarNodes.filter(n => n.prereqs.every(p => known.has(p))).length

  const nodes = useMemo(() => visibleGrammarNodes.map(n => ({
    id: n.id,
    type: 'grammarNode',
    position: positionMap[n.id],
    data: {
      label: n.label,
      sublabel: n.sublabel,
      isUnlocked: n.prereqs.filter(p => visibleIds.has(p)).every(p => known.has(p)),
      isKnown: known.has(n.id),
      isSelected: n.id === selectedId,
      onToggle: () => toggleKnown(n.id),
      accent: ACCENT,
    },
  })), [visibleGrammarNodes, positionMap, visibleIds, known, selectedId])

  const edges = useMemo(() => visibleEdges.map(e => ({
    ...e,
    style: {
      stroke: known.has(e.source) ? ACCENT : '#333',
      strokeWidth: known.has(e.source) ? 2 : 1.5,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: known.has(e.source) ? ACCENT : '#333',
    },
  })), [visibleEdges, known])

  function renderPanelContent(px = 16) {
    if (selectedNode) {
      const prereqNodes = selectedNode.prereqs.map(pId => GRAMMAR_NODES.find(n => n.id === pId)).filter(Boolean)
      const dependents = GRAMMAR_NODES.filter(n => n.prereqs.includes(selectedNode.id))

      return (
        <div style={{ padding: `16px ${px}px` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 22, color: TEXT, marginBottom: 4 }}>{selectedNode.label}</div>
              {selectedNode.sublabel && (
                <div style={{ fontSize: 12, color: ACCENT }}>{selectedNode.sublabel}</div>
              )}
            </div>
            <button
              onClick={() => setSelectedId(null)}
              style={{
                background: 'none', border: 'none', color: TEXT_MUTED,
                fontSize: 18, cursor: 'pointer', padding: '0 0 0 8px',
                fontFamily: FONT, lineHeight: 1, flexShrink: 0,
              }}
            >✕</button>
          </div>

          {selectedNode.description && (
            <div style={{
              padding: 12,
              background: 'rgba(139,124,248,0.06)',
              border: '1px solid rgba(139,124,248,0.15)',
              borderRadius: 6,
              fontSize: 13,
              color: TEXT,
              lineHeight: 1.65,
              marginBottom: selectedNode.example ? 0 : 20,
            }}>
              {selectedNode.description}
            </div>
          )}

          {selectedNode.example && (
            <div style={{
              padding: 12,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderTop: selectedNode.description ? 'none' : undefined,
              borderRadius: selectedNode.description ? '0 0 6px 6px' : 6,
              fontSize: 12,
              color: TEXT_MUTED,
              lineHeight: 1.65,
              marginBottom: 20,
              fontStyle: 'italic',
            }}>
              {selectedNode.example}
            </div>
          )}

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
                    {pNode.sublabel && <span style={{ fontSize: 11, color: TEXT_MUTED, marginLeft: 8 }}>{pNode.sublabel}</span>}
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
                    {dNode.sublabel && <span style={{ fontSize: 11, color: TEXT_MUTED, marginLeft: 8 }}>{dNode.sublabel}</span>}
                  </div>
                  {known.has(dNode.id) && <span style={{ fontSize: 11, color: ACCENT }}>✓</span>}
                </div>
              ))}
            </>
          )}
        </div>
      )
    }

    const total = visibleGrammarNodes.length
    return (
      <div style={{ padding: `16px ${px}px` }}>
        <DrawerSectionHeader title="Progress" />
        <div style={{ marginBottom: 20 }}>
          {[
            { label: 'Known', value: `${known.size} / ${total}` },
            { label: 'Unlocked', value: `${unlockedCount} / ${total}` },
            { label: 'Locked', value: `${total - unlockedCount} / ${total}` },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
              <span style={{ color: TEXT_MUTED }}>{label}</span>
              <span style={{ color: TEXT }}>{value}</span>
            </div>
          ))}
        </div>

        <DrawerSectionHeader title="View" />
        <div
          onClick={() => setCoreOnly(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 0', cursor: 'pointer', marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 13, color: TEXT }}>Core grammar only</span>
          <div style={{
            width: 32, height: 18, borderRadius: 9,
            background: coreOnly ? ACCENT : 'rgba(255,255,255,0.12)',
            position: 'relative', transition: 'background 150ms', flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute', top: 3, left: coreOnly ? 17 : 3,
              width: 12, height: 12, borderRadius: '50%',
              background: '#fff', transition: 'left 150ms',
            }} />
          </div>
        </div>
        <div style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 1.55, marginBottom: 20 }}>
          {coreOnly
            ? `Showing ${visibleGrammarNodes.length} core grammar points (N5 + N4)`
            : `Showing all ${GRAMMAR_NODES.length} grammar points`}
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
            fitViewOptions={{ padding: 0.1 }}
            minZoom={0.08}
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
