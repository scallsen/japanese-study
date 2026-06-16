export const GRAMMAR_NODES = [
  // Root — foundational particles and forms, no prereqs
  { id: 'wa-ga',    label: 'は / が',      sublabel: 'Topic & Subject',   prereqs: [], position: { x: 0,   y: 80  } },
  { id: 'desu-masu', label: 'です / ます', sublabel: 'Polite Forms',      prereqs: [], position: { x: 0,   y: 300 } },
  { id: 'wo-ni-de', label: 'を / に / で', sublabel: 'Object & Location', prereqs: [], position: { x: 0,   y: 520 } },

  // Level 2 — conjugation paradigms and basic connectors
  { id: 'ga-kedo',  label: '〜が / けど',  sublabel: 'Contrast',          prereqs: ['wa-ga'],     position: { x: 260, y: 0   } },
  { id: 'te-form',  label: 'て-form',      sublabel: 'Connective Form',   prereqs: ['desu-masu'], position: { x: 260, y: 240 } },
  { id: 'nai-form', label: 'ない-form',    sublabel: 'Negative Form',     prereqs: ['desu-masu'], position: { x: 260, y: 400 } },
  { id: 'ni-iku',   label: '〜に行く',     sublabel: 'Going to Do',       prereqs: ['wo-ni-de'],  position: { x: 260, y: 540 } },

  // Level 3 — patterns that build on conjugation forms
  { id: 'no-de',    label: '〜ので / から', sublabel: 'Reason / Because', prereqs: ['te-form'],  position: { x: 520, y: 80  } },
  { id: 'tai',      label: '〜たい',        sublabel: 'Want to Do',       prereqs: ['te-form'],  position: { x: 520, y: 210 } },
  { id: 'te-iru',   label: '〜ている',      sublabel: 'Progressive',      prereqs: ['te-form'],  position: { x: 520, y: 340 } },
  { id: 'te-kara',  label: '〜てから',      sublabel: 'After Doing',      prereqs: ['te-form'],  position: { x: 520, y: 460 } },
  { id: 'tara-ba',  label: '〜たら / ば',   sublabel: 'Conditional',      prereqs: ['nai-form'], position: { x: 520, y: 560 } },
  { id: 'nakereba', label: '〜なければ',    sublabel: 'Must / Have To',   prereqs: ['nai-form'], position: { x: 520, y: 660 } },

  // Level 4 — advanced nuance built on level 3
  { id: 'te-shimau', label: '〜てしまう',   sublabel: 'Completion / Regret', prereqs: ['te-iru'], position: { x: 780, y: 340 } },
]
