// color is deliberately NOT set here — it must live in the .attribution-link
// CSS class (global.css) so the :hover rule can actually override it. An
// inline style color always wins over a class's :hover color, which is why
// this used to render with no visible hover effect.
const LINK_STYLE = { textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.3)' }

// Renders a credit's segment array ({ text } or { text, href }, from
// src/data/attributions.js) as inline JSX. Shared by AttributionFooter.jsx
// and the contextual Voicevox credit line under the "Text to speech" picker
// (VocabPage.jsx/VocabSrsModule.jsx). Kept out of AttributionFooter.jsx (a
// component file) to satisfy react-refresh lint, same reasoning as
// src/utils/vocabMap.js.
export function renderAttributionSegments(segments) {
  return segments.map((seg, i) => (
    seg.href
      ? <a key={i} href={seg.href} target="_blank" rel="noreferrer" className="attribution-link" style={LINK_STYLE}>{seg.text}</a>
      : <span key={i}>{seg.text}</span>
  ))
}
