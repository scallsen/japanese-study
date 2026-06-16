import grammarList from './grammar-list.json'
import grammarDeps from './grammar-deps.json'

const listMap = Object.fromEntries(grammarList.map(e => [e.term, e]))

export const GRAMMAR_NODES = grammarDeps.map(e => ({
  id: e.term,
  label: e.term,
  sublabel: listMap[e.term]?.meaning ?? '',
  description: listMap[e.term]?.description ?? '',
  example: listMap[e.term]?.example ?? null,
  level: e.level,
  jlptLevel: listMap[e.term]?.jlptLevel ?? null,
  prereqs: e.prereqs,
  position: { x: 0, y: 0 }, // overwritten by dagre layout
}))
