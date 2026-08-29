import { Chip } from './Chip.jsx'
import { useAccent } from '../context/ModuleThemeContext.jsx'

const SUCCESS = '#6BCB6B'

const TONES = {
  accent: null, // null → fall through to the module accent
  success: SUCCESS,
}

/**
 * A standalone on/off control whose *label* changes with its state —
 * Follow/Unfollow, On/Off. Distinct from two neighbours it could be confused
 * with:
 *
 *  - Not a `Button` variant. Button's hover is derived from its variant and
 *    always reinforces the resting state. A toggle's label, colour, and
 *    (with `destructiveHover`) the meaning of hovering all change with
 *    state — expressing that on Button would mean four toggle-only props on
 *    a component ~50 non-toggle call sites also use.
 *  - Not a `Chip`. A chip picks one option out of a set and keeps a fixed
 *    label; a toggle is a standalone binary that renames itself. They share
 *    a visual language deliberately, which is why this composes Chip rather
 *    than restyling a button from scratch.
 *
 * `activeTone` picks the "on" colour: 'accent' (the module's own — deck
 * On/Off) or 'success' green (something you've followed/saved).
 * `destructiveHover` reddens the active state on hover to preview that
 * clicking will undo it — right for Follow/Unfollow, wrong for On/Off,
 * where turning a deck off isn't destructive.
 */
export default function ToggleButton({
  active,
  labels,
  onClick,
  size = 'sm',
  activeTone = 'accent',
  destructiveHover = false,
  disabled = false,
}) {
  const moduleAccent = useAccent()
  const accent = TONES[activeTone] ?? moduleAccent

  return (
    <Chip
      label={active ? labels.on : labels.off}
      active={active}
      onClick={onClick}
      size={size}
      accent={accent}
      disabled={disabled}
      destructiveHover={destructiveHover}
    />
  )
}
