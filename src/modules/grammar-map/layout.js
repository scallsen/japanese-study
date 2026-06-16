import dagre from 'dagre'

export const NODE_W = 190
export const NODE_H = 72
const GROUP_COLS = 3
const GAP = 12
const PAD = 14
const GROUP_HEADER = 26

function groupKey(prereqs) {
  return [...prereqs].sort().join('|')
}

function groupDimensions(nodeCount) {
  const cols = Math.min(GROUP_COLS, nodeCount)
  const rows = Math.ceil(nodeCount / cols)
  return {
    cols,
    width: cols * (NODE_W + GAP) - GAP + PAD * 2,
    height: rows * (NODE_H + GAP) - GAP + PAD * 2 + GROUP_HEADER,
  }
}

function runDagre(nodes, edges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: 100, nodesep: 32 })
  nodes.forEach(n => g.setNode(n.id, { width: n.width ?? NODE_W, height: n.height ?? NODE_H }))
  edges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map(n => {
    const pos = g.node(n.id)
    const w = n.width ?? NODE_W
    const h = n.height ?? NODE_H
    return { ...n, position: { x: pos.x - w / 2, y: pos.y - h / 2 } }
  })
}

// Simple flat layout — used when grouping is disabled
export function computeLayout(nodes, edges) {
  return runDagre(nodes, edges)
}

// Grouped layout — nodes sharing the same prereq set are clustered into a box
export function computeGroupedLayout(grammarNodes, { minGroupSize = 2 } = {}) {
  // 1. Bucket nodes by prereq key
  const buckets = {}
  grammarNodes.forEach(n => {
    const key = groupKey(n.prereqs)
    if (!buckets[key]) buckets[key] = { key, prereqs: n.prereqs, nodes: [] }
    buckets[key].nodes.push(n)
  })

  const groups = []   // buckets with >= minGroupSize members
  const soloNodes = [] // buckets with 1 member (left ungrouped)

  Object.values(buckets).forEach(b => {
    if (b.nodes.length >= minGroupSize) {
      const { cols, width, height } = groupDimensions(b.nodes.length)
      groups.push({ ...b, id: `grp:${b.key || 'root'}`, cols, width, height })
    } else {
      soloNodes.push(...b.nodes)
    }
  })

  // 2. Map every node ID → its dagre representative (group ID or own ID)
  const nodeToRep = {}
  groups.forEach(g => g.nodes.forEach(n => { nodeToRep[n.id] = g.id }))
  soloNodes.forEach(n => { nodeToRep[n.id] = n.id })
  const getRep = id => nodeToRep[id] ?? id

  // 3. Build compressed edge list (deduped, skip intra-group)
  const edgeSet = new Set()
  const compressedEdges = []
  grammarNodes.forEach(n => {
    const tgt = getRep(n.id)
    n.prereqs.forEach(p => {
      const src = getRep(p)
      if (src === tgt) return
      const key = `${src}→${tgt}`
      if (!edgeSet.has(key)) { edgeSet.add(key); compressedEdges.push({ source: src, target: tgt }) }
    })
  })

  // 4. Run dagre on compressed graph
  const dagreNodes = [
    ...soloNodes.map(n => ({ id: n.id })),
    ...groups.map(g => ({ id: g.id, width: g.width, height: g.height })),
  ]
  const positioned = runDagre(dagreNodes, compressedEdges)
  const posMap = Object.fromEntries(positioned.map(n => [n.id, n.position]))

  // 5. Grid-lay children within each group (relative coords)
  const childPositions = {}
  groups.forEach(g => {
    g.nodes.forEach((n, i) => {
      const col = i % g.cols
      const row = Math.floor(i / g.cols)
      childPositions[n.id] = {
        x: PAD + col * (NODE_W + GAP),
        y: GROUP_HEADER + PAD + row * (NODE_H + GAP),
      }
    })
  })

  return { groups, soloNodes, posMap, childPositions, nodeToRep }
}
