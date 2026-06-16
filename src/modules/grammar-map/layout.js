import dagre from 'dagre'

export const NODE_W = 190
export const NODE_H = 96
const GROUP_COLS = 3
const GAP = 12
const PAD = 14
const GROUP_HEADER = 26

function groupKey(prereqs) {
  return [...prereqs].sort().join('|')
}

function estimateCardHeight() {
  return NODE_H
}

// Lays out nodes into independent columns with consistent per-column gaps.
// Returns childPositions (relative to group top-left) and group dimensions.
function layoutGroupColumns(nodes) {
  const cols = Math.min(GROUP_COLS, nodes.length)

  // Round-robin distribution: node i → column (i % cols)
  const columns = Array.from({ length: cols }, () => [])
  nodes.forEach((n, i) => columns[i % cols].push(n))

  const childPositions = {}
  const colContentHeights = columns.map((colNodes, c) => {
    let y = 0
    colNodes.forEach(n => {
      const h = estimateCardHeight(n)
      childPositions[n.id] = { x: PAD + c * (NODE_W + GAP), y: GROUP_HEADER + PAD + y }
      y += h + GAP
    })
    return y - GAP  // remove trailing gap
  })

  const contentH = Math.max(...colContentHeights)
  return {
    cols,
    width: cols * (NODE_W + GAP) - GAP + PAD * 2,
    height: GROUP_HEADER + PAD * 2 + contentH,
    childPositions,
  }
}

const COL_GAP = 100  // fixed horizontal gap between columns
const ROW_GAP = 48   // fixed vertical gap between items within a column

function runDagre(nodes, edges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: COL_GAP, nodesep: ROW_GAP })
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

// Trello-style layout: BFS longest-path assigns each node a column,
// then items stack vertically within each column with a fixed gap.
// Each column is independently laid out; columns are evenly spaced.
function runTrelloLayout(nodes, edges) {
  const adj = {}
  const inDeg = {}
  nodes.forEach(n => { adj[n.id] = []; inDeg[n.id] = 0 })
  edges.forEach(({ source: s, target: t }) => {
    if (s in adj && t in inDeg) { adj[s].push(t); inDeg[t]++ }
  })

  // Kahn's BFS, taking the longest path for each node's column
  const colOf = {}
  const queue = nodes.filter(n => inDeg[n.id] === 0).map(n => n.id)
  queue.forEach(id => { colOf[id] = 0 })
  while (queue.length) {
    const id = queue.shift()
    adj[id].forEach(next => {
      colOf[next] = Math.max(colOf[next] ?? 0, colOf[id] + 1)
      if (--inDeg[next] === 0) queue.push(next)
    })
  }

  // Bucket nodes into columns
  const byCol = {}
  nodes.forEach(n => {
    const c = colOf[n.id] ?? 0
    if (!byCol[c]) byCol[c] = []
    byCol[c].push(n)
  })

  // Position: each column independent, fixed COL_GAP between them
  const positions = {}
  let x = 0
  Object.keys(byCol).map(Number).sort((a, b) => a - b).forEach(col => {
    const items = byCol[col]
    const colW = Math.max(...items.map(n => n.width ?? NODE_W))
    let y = 0
    items.forEach(n => {
      positions[n.id] = { x, y }
      y += (n.height ?? NODE_H) + ROW_GAP
    })
    x += colW + COL_GAP
  })

  return nodes.map(n => ({ ...n, position: positions[n.id] ?? { x: 0, y: 0 } }))
}

// Simple flat layout — used when grouping is disabled
export function computeLayout(nodes, edges) {
  return runDagre(nodes, edges)
}

// Grouped layout — nodes sharing the same prereq set are clustered into a box
export function computeGroupedLayout(grammarNodes, { minGroupSize = 2 } = {}) {
  // 1. Find nodes that are prerequisites for at least one other visible node
  const hasDependent = new Set()
  grammarNodes.forEach(n => n.prereqs.forEach(p => hasDependent.add(p)))

  // 2. Bucket nodes by prereq key
  const buckets = {}
  grammarNodes.forEach(n => {
    const key = groupKey(n.prereqs)
    if (!buckets[key]) buckets[key] = { key, prereqs: n.prereqs, nodes: [] }
    buckets[key].nodes.push(n)
  })

  const groups = []   // buckets with >= minGroupSize members
  const soloNodes = [] // buckets with 1 member (left ungrouped)

  const childPositions = {}

  function addGroup(id, meta, nodes) {
    const { cols, width, height, childPositions: cp } = layoutGroupColumns(nodes)
    Object.assign(childPositions, cp)
    groups.push({ ...meta, id, nodes, cols, width, height })
  }

  Object.values(buckets).forEach(b => {
    if (b.key === '') {
      const foundations = b.nodes.filter(n => !hasDependent.has(n.id))
      const gateways = b.nodes.filter(n => hasDependent.has(n.id))

      if (foundations.length >= minGroupSize) addGroup('grp:root', { prereqs: [], key: '' }, foundations)
      else soloNodes.push(...foundations)

      if (gateways.length >= minGroupSize) addGroup('grp:gateways', { prereqs: [], key: '' }, gateways)
      else soloNodes.push(...gateways)
    } else {
      if (b.nodes.length >= minGroupSize) addGroup(`grp:${b.key}`, b, b.nodes)
      else soloNodes.push(...b.nodes)
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

  // 4. Trello-style layout on compressed graph
  const dagreNodes = [
    ...soloNodes.map(n => ({ id: n.id })),
    ...groups.map(g => ({ id: g.id, width: g.width, height: g.height })),
  ]
  const positioned = runTrelloLayout(dagreNodes, compressedEdges)
  const posMap = Object.fromEntries(positioned.map(n => [n.id, n.position]))

  return { groups, soloNodes, posMap, childPositions, nodeToRep }
}
