import { useState, useMemo } from 'react'
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import PageHeader from '../../components/PageHeader.jsx'
import SectionHeader from '../../components/SectionHeader.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, FS_CONTENT_HEADING } from '../../data/theme.js'
import { GRAMMAR_NODES } from './grammarNodes.js'
import { computeGroupedLayout } from './layout.js'
import GrammarNode from './GrammarNode.jsx'
import GrammarGroupNode from './GrammarGroupNode.jsx'
import { useIsMobile } from '../../hooks/useIsMobile.js'

const ACCENT = '#8B7CF8'
const STORAGE_KEY = 'grammar-map-known'
const nodeTypes = { grammarNode: GrammarNode, grammarGroup: GrammarGroupNode }
const PANEL_W = 380
const CHEVRON_W = 28
const PANEL_CONTENT_W = PANEL_W - CHEVRON_W

function loadKnown() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) }
  catch { return new Set() }
}

function saveKnown(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
}

const CORE_LEVELS = new Set(['N5', 'N4'])

export default function GrammarMapModule() {
  const { user, signIn, loading: authLoading } = useAuth()
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

  const layout = useMemo(() => computeGroupedLayout(visibleGrammarNodes), [visibleGrammarNodes])

  const selectedNode = selectedId ? GRAMMAR_NODES.find(n => n.id === selectedId) : null
  const visibleIds = useMemo(() => new Set(visibleGrammarNodes.map(n => n.id)), [visibleGrammarNodes])
  const unlockedCount = visibleGrammarNodes.filter(n =>
    n.prereqs.filter(p => visibleIds.has(p)).every(p => known.has(p))
  ).length

  const nodes = useMemo(() => {
    const { groups, soloNodes, posMap, childPositions } = layout

    const groupNodes = groups.map(g => ({
      id: g.id,
      type: 'grammarGroup',
      position: posMap[g.id],
      style: { width: g.width, height: g.height },
      data: {
        label: g.id === 'grp:gateways' ? 'Gateways' : g.prereqs.length === 0 ? 'Foundations' : g.prereqs.join(' + '),
        count: g.nodes.length,
        isGateway: g.id === 'grp:gateways',
      },
    }))

    const childNodes = groups.flatMap(g =>
      g.nodes.map(n => ({
        id: n.id,
        type: 'grammarNode',
        parentId: g.id,
        extent: 'parent',
        position: childPositions[n.id],
        data: {
          label: n.label,
          sublabel: n.sublabel,
          isUnlocked: n.prereqs.filter(p => visibleIds.has(p)).every(p => known.has(p)),
          isKnown: known.has(n.id),
          isSelected: n.id === selectedId,
          onToggle: () => toggleKnown(n.id),
          accent: ACCENT,
          hideHandles: true,
          category: n.category,
        },
      }))
    )

    const soloFlowNodes = soloNodes.map(n => ({
      id: n.id,
      type: 'grammarNode',
      position: posMap[n.id],
      data: {
        label: n.label,
        sublabel: n.sublabel,
        isUnlocked: n.prereqs.filter(p => visibleIds.has(p)).every(p => known.has(p)),
        isKnown: known.has(n.id),
        isSelected: n.id === selectedId,
        onToggle: () => toggleKnown(n.id),
        accent: ACCENT,
        category: n.category,
      },
    }))

    return [...groupNodes, ...childNodes, ...soloFlowNodes]
  }, [layout, visibleIds, known, selectedId])

  const edges = useMemo(() => {
    const { nodeToRep } = layout
    const getRep = id => nodeToRep[id] ?? id

    // Build visible edges: between actual node IDs, deduped at the group level
    const edgeSet = new Set()
    const result = []
    visibleGrammarNodes.forEach(n => {
      n.prereqs.forEach(prereqId => {
        if (!visibleIds.has(prereqId)) return
        const srcRep = getRep(prereqId)
        const tgtRep = getRep(n.id)
        if (srcRep === tgtRep) return // skip intra-group

        // Deduplicate at the representative level (group→group or node→node)
        const edgeKey = `${srcRep}→${tgtRep}`
        if (edgeSet.has(edgeKey)) return
        edgeSet.add(edgeKey)

        const isKnownEdge = known.has(prereqId)
        result.push({
          id: edgeKey,
          source: srcRep,
          target: tgtRep,
          style: { stroke: isKnownEdge ? ACCENT : '#333', strokeWidth: isKnownEdge ? 2 : 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: isKnownEdge ? ACCENT : '#333' },
        })
      })
    })
    return result
  }, [layout, visibleGrammarNodes, visibleIds, known])

  if (!authLoading && !user) {
    return (
      <div style={{ width: '100vw', height: '100dvh', background: '#1E1E1E', fontFamily: FONT, letterSpacing: TRACKING, display: 'flex', flexDirection: 'column', color: TEXT }}>
        <PageHeader crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'Grammar Map' }]} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ fontSize: FS_BASE, color: TEXT }}>Sign in to use Grammar Map</div>
          <button
            onClick={signIn}
            style={{ padding: '10px 24px', background: ACCENT, border: 'none', borderRadius: 8, color: '#fff', fontFamily: FONT, fontSize: FS_BASE, letterSpacing: TRACKING, cursor: 'pointer' }}
          >
            Sign in with GitHub
          </button>
        </div>
      </div>
    )
  }

  function renderPanelContent(px = 16) {
    if (selectedNode) {
      const prereqNodes = selectedNode.prereqs.map(pId => GRAMMAR_NODES.find(n => n.id === pId)).filter(Boolean)
      const dependents = GRAMMAR_NODES.filter(n => n.prereqs.includes(selectedNode.id))
      const isKnownSelected = known.has(selectedNode.id)
      const selectedUnlocked = selectedNode.prereqs
        .filter(p => visibleIds.has(p))
        .every(p => known.has(p))

      return (
        <div style={{ padding: `16px ${px}px` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: FS_CONTENT_HEADING, color: TEXT, marginBottom: 4 }}>{selectedNode.label}</div>
              {selectedNode.sublabel && (
                <div style={{ fontSize: FS_CAPTION, color: ACCENT }}>{selectedNode.sublabel}</div>
              )}
            </div>
            <button
              onClick={() => setSelectedId(null)}
              style={{
                background: 'none', border: 'none', color: TEXT_MUTED,
                fontSize: FS_BASE, cursor: 'pointer', padding: '0 0 0 8px',
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
              fontSize: FS_BASE,
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
              fontSize: FS_CAPTION,
              color: TEXT_MUTED,
              lineHeight: 1.65,
              marginBottom: 20,
              fontStyle: 'italic',
            }}>
              {selectedNode.example}
            </div>
          )}

          {(selectedUnlocked || isKnownSelected) && (
            <button
              onClick={() => toggleKnown(selectedNode.id)}
              style={{
                width: '100%',
                padding: '8px 0',
                marginBottom: 20,
                background: isKnownSelected ? `${ACCENT}22` : 'transparent',
                border: `1px solid ${isKnownSelected ? `${ACCENT}88` : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 6,
                color: isKnownSelected ? ACCENT : TEXT_MUTED,
                fontSize: FS_BASE,
                cursor: 'pointer',
                fontFamily: FONT,
                letterSpacing: TRACKING,
                transition: 'all 120ms',
              }}
            >
              {isKnownSelected ? 'Known ✓' : 'Mark as known'}
            </button>
          )}

          {prereqNodes.length > 0 && (
            <>
              <SectionHeader title="Prerequisites" />
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
                    <span style={{ fontSize: FS_BASE, color: known.has(pNode.id) ? ACCENT : TEXT }}>{pNode.label}</span>
                    {pNode.sublabel && <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginLeft: 8 }}>{pNode.sublabel}</span>}
                  </div>
                  {known.has(pNode.id) && <span style={{ fontSize: FS_CAPTION, color: ACCENT }}>✓</span>}
                </div>
              ))}
              <div style={{ marginBottom: 20 }} />
            </>
          )}

          {dependents.length > 0 && (
            <>
              <SectionHeader title="Unlocks" />
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
                    <span style={{ fontSize: FS_BASE, color: TEXT }}>{dNode.label}</span>
                    {dNode.sublabel && <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, marginLeft: 8 }}>{dNode.sublabel}</span>}
                  </div>
                  {known.has(dNode.id) && <span style={{ fontSize: FS_CAPTION, color: ACCENT }}>✓</span>}
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
        <SectionHeader title="Progress" />
        <div style={{ marginBottom: 20 }}>
          {[
            { label: 'Known', value: `${known.size} / ${total}` },
            { label: 'Unlocked', value: `${unlockedCount} / ${total}` },
            { label: 'Locked', value: `${total - unlockedCount} / ${total}` },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: FS_BASE }}>
              <span style={{ color: TEXT_MUTED }}>{label}</span>
              <span style={{ color: TEXT }}>{value}</span>
            </div>
          ))}
        </div>

        <SectionHeader title="View" />
        <div
          onClick={() => setCoreOnly(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 0', cursor: 'pointer', marginBottom: 4,
          }}
        >
          <span style={{ fontSize: FS_BASE, color: TEXT }}>Core grammar only</span>
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
        <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, lineHeight: 1.55, marginBottom: 20 }}>
          {coreOnly
            ? `Showing ${visibleGrammarNodes.length} core grammar points (N5 + N4)`
            : `Showing all ${GRAMMAR_NODES.length} grammar points`}
        </div>

        <SectionHeader title="How to use" />
        <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, lineHeight: 1.65 }}>
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
            <span style={{ fontSize: FS_BASE, color: TEXT_MUTED }}>
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
            onNodeClick={(e, node) => { if (node.type === 'grammarGroup') return; setSelectedId(node.id); setShowOptions(true) }}
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
              color: 'rgba(255,255,255,0.5)', fontSize: FS_BASE,
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
