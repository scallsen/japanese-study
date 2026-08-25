// Heuristic (not measured) font-size step-down for the fixed-size flashcard
// faces in VocabCard.jsx / VocabSrsDrill.jsx (issue #71). The card's own
// dimensions never change — instead these scale down the cqw-based font
// sizes for the main word/kanji and for the secondary rows (translation,
// sentence, kanji-meaning bar) as a proxy for how much text is being asked
// to fit, tuned against the issue's repro cases (産婦人科, 枚数, long Tanaka
// sentences, and multiple optional rows stacked at once).

const MAIN_STEPS = [
  { minLength: 0, scale: 1 },
  { minLength: 6, scale: 0.85 },
  { minLength: 8, scale: 0.7 },
]

const SECONDARY_STEPS = [
  { minScore: 0, scale: 1 },
  { minScore: 60, scale: 0.9 },
  { minScore: 110, scale: 0.8 },
  { minScore: 160, scale: 0.7 },
]

function stepScale(steps, value, key) {
  let scale = steps[0].scale
  for (const step of steps) {
    if (value >= step[key]) scale = step.scale
  }
  return scale
}

// For the large word/kanji display (front or back) — scales down only once
// the text itself is long enough to risk overflowing the card's fixed width,
// independent of anything else on the card.
export function getMainTextScale(text) {
  return stepScale(MAIN_STEPS, text?.length ?? 0, 'minLength')
}

// For the stack of optional back-face rows (translation / sentence /
// kanji-meaning bar) — scales down as their combined length and count grows,
// since any one of them can be short while several together still overflow.
export function getSecondaryTextScale({ translation, sentence, sentenceEnglish, showKanjiMeaning }) {
  const score =
    (translation?.length ?? 0) +
    (sentence?.length ?? 0) +
    (sentenceEnglish?.length ?? 0) * 0.6 +
    (showKanjiMeaning ? 20 : 0)
  return stepScale(SECONDARY_STEPS, score, 'minScore')
}

export function cqw(base, scale) {
  return `${(base * scale).toFixed(2)}cqw`
}
