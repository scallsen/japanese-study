// Splits a flat token stream into dialogue lines. Expects the model's
// 名前「セリフ」 line format; anything that doesn't parse becomes narration.
// Entries keep their global token index so activeIdx/popup highlighting
// stays consistent across bubbles.
export function parseDialogue(tokens) {
  const rawLines = []
  let current = []
  for (let gi = 0; gi < tokens.length; gi++) {
    const tok = tokens[gi]
    if (tok.t.includes('\n')) {
      if (current.length) rawLines.push(current)
      current = []
    } else {
      current.push({ tok, gi })
    }
  }
  if (current.length) rawLines.push(current)

  return rawLines.map(line => {
    const open = line.findIndex(e => e.tok.t.includes('「'))
    let close = -1
    for (let i = line.length - 1; i >= 0; i--) {
      if (line[i].tok.t.includes('」')) { close = i; break }
    }
    if (open > 0 && close > open) {
      const speaker = line.slice(0, open).map(e => e.tok.t).join('').replace(/[:：]\s*$/, '')
      const content = line.slice(open + 1, close)
      if (speaker && content.length) return { speaker, entries: content }
    }
    return { speaker: null, entries: line }
  })
}
