// Labels and descriptions for the FSRS-derived card states, shared by the
// module home (DistributionBar legend) and the browse page (state tabs and
// badges). Colours are SEGMENT_COLORS in theme.js — same keys.
export const STATE_SEGMENTS = [
  { key: 'new', label: 'Unlearned', description: 'Never reviewed — waiting for its first study session' },
  { key: 'learning', label: 'Learning', description: 'Answered correctly once, but not yet graduated to a real spaced interval' },
  { key: 'young', label: 'Young', description: 'Graduated, but its current interval is under 21 days — still fragile' },
  { key: 'mature', label: 'Mature', description: 'Graduated with a 21+ day interval — well established' },
  { key: 'relearning', label: 'Relearning', description: 'Was graduated, just answered wrong — cooling down before rejoining the queue' },
]

export const STATE_LABELS = Object.fromEntries(STATE_SEGMENTS.map(s => [s.key, s.label]))
export const STATE_DESCRIPTIONS = Object.fromEntries(STATE_SEGMENTS.map(s => [s.key, s.description]))

export const SUSPENDED_DESCRIPTION = 'Paused after too many lapses (leech threshold) — won\'t appear in reviews until its progress is reset'
