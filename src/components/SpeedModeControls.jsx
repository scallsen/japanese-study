import DrillButtonRow, { DrillButton } from './DrillButton.jsx'
import { DRILL_COLORS } from '../data/theme.js'

// The speed-mode Incorrect/Correct pair, shared by VocabPage and Anime
// Vocab's EpisodeDrill. A named composition over DrillButton rather than
// each drill inlining the same two buttons — the keyboard hints and the
// pre-flip "Click to flip" placeholder are the whole point of it existing.
export default function SpeedModeControls({ isFlipped, transitioning, onVerdict }) {
  if (!isFlipped) return <DrillButtonRow placeholder="Click to flip" />

  return (
    <DrillButtonRow>
      <DrillButton label="Incorrect" hint="Z" color={DRILL_COLORS.again} onClick={() => onVerdict(false)} disabled={transitioning} />
      <DrillButton label="Correct" hint="X" color={DRILL_COLORS.good} onClick={() => onVerdict(true)} disabled={transitioning} />
    </DrillButtonRow>
  )
}
