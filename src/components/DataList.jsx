import SelectableRow from './SelectableRow.jsx'
import SelectAllCheckbox from './SelectAllCheckbox.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION, SPACE_4, SPACE_8, SPACE_12, SPACE_16 } from '../data/theme.js'
import { useAccent } from '../context/ModuleThemeContext.jsx'

const SURFACE = '#2A2A2A'
const HAIRLINE = 'rgba(255,255,255,0.08)'
const ROW_HAIRLINE = 'rgba(255,255,255,0.05)'

function cellStyle(column) {
  return {
    flex: column.flex ?? (column.width ? `0 0 ${column.width}px` : '1 1 0'),
    minWidth: 0,
    textAlign: column.align ?? 'left',
  }
}

function Cell({ column, row, editable, onFieldChange }) {
  if (editable) {
    return (
      <input
        value={row[column.key] ?? ''}
        onChange={e => onFieldChange(row, column.key, e.target.value)}
        onClick={e => e.stopPropagation()}
        style={{
          ...cellStyle(column),
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 4,
          padding: `${SPACE_4}px ${SPACE_8}px`,
          color: TEXT,
          fontFamily: FONT,
          fontSize: FS_BASE,
        }}
      />
    )
  }

  return (
    <div
      style={{
        ...cellStyle(column),
        display: 'flex',
        alignItems: 'center',
        justifyContent: column.align === 'right' ? 'flex-end' : column.align === 'center' ? 'center' : 'flex-start',
        gap: SPACE_4,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: column.wrap ? 'normal' : 'nowrap',
        fontFamily: column.fontFamily ?? FONT,
        letterSpacing: TRACKING,
        fontSize: column.fontSize ?? FS_BASE,
        color: column.tone === 'muted' ? TEXT_MUTED : TEXT,
      }}
    >
      {column.render ? column.render(row) : row[column.key]}
    </div>
  )
}

// Bare checkbox (not SelectableRow's label-wraps-everything version) — used
// only when the row body has its OWN click behavior (navigate/expand), so the
// checkbox needs to opt itself out of that click instead of triggering it.
//
// Once a navigate row can render as a real <a> (navigate.href below),
// stopPropagation alone isn't enough: an ancestor <a>'s native navigation is
// governed by the click event's canceled flag, which stopPropagation doesn't
// set — only preventDefault does. But preventDefault on a checkbox's own
// click also cancels ITS default action (the checked-state toggle), so the
// native 'change' event this relies on would never fire — onToggle is
// called directly from onClick instead. onChange is kept as a no-op target
// only to satisfy React's "checked without onChange" controlled-input check.
function RowCheckbox({ checked, onToggle }) {
  const ACCENT = useAccent()
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onToggle}
      onClick={e => { e.stopPropagation(); e.preventDefault(); onToggle() }}
      style={{ flexShrink: 0, width: 16, height: 16, margin: 0, accentColor: ACCENT }}
    />
  )
}

function Row({ row, rowKey, columns, selection, navigate, expand, editableFields, onFieldChange, gap, padding, isLast, rowState }) {
  const id = rowKey(row)
  const cells = columns.map(col => (
    <Cell key={col.key} column={col} row={row} editable={editableFields?.includes(col.key)} onFieldChange={onFieldChange} />
  ))

  const isSelected = !!selection?.selected?.has(id)
  const isExpanded = !!expand?.expanded?.has(id)
  const disabled = !!rowState?.(row)?.disabled
  // The container already draws the outer border; a divider under the final
  // row doubles up against it and reads as a 2px seam.
  const divider = isLast ? 'none' : `1px solid ${ROW_HAIRLINE}`

  // Bulk-select with no independent row-click behavior: the row IS the
  // toggle target, so this can just be the real SelectableRow (click
  // anywhere toggles) — same component/behavior as EpisodeVocabBrowser today.
  if (selection && !navigate && !expand) {
    return (
      <SelectableRow selected={isSelected} onToggle={() => selection.onToggle(id)} gap={gap} padding={padding} borderBottom={divider}>
        {cells}
      </SelectableRow>
    )
  }

  // rowState: per-row disabled/busy — e.g. MediaSearch dims only the one
  // result tile/row being selected while a click is pending, not the whole
  // list. Mirrors rowKey's own "function called per row" convention rather
  // than asking the caller to keep a parallel Set in sync.
  const clickable = (!!navigate || !!expand) && !disabled
  const href = navigate?.href ? navigate.href(row) : undefined
  function handleRowClick() {
    if (navigate?.onClick) navigate.onClick(row)
    else if (expand) expand.onToggle(id)
  }

  // href renders the row as a real <a> — cmd/ctrl/middle-click, right-click
  // "open in new tab", and hover-preview all work natively, which a div +
  // onClick can't offer. onClick (if also given) still fires on top of it.
  const RowTag = href ? 'a' : 'div'
  const rowBody = (
    <RowTag
      href={href}
      onClick={clickable ? handleRowClick : undefined}
      className={clickable ? 'data-list-row' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap, padding,
        // An expanded row's divider belongs under its detail panel, not
        // between the row and its own content.
        borderBottom: isExpanded ? 'none' : divider,
        fontFamily: 'inherit', letterSpacing: TRACKING,
        cursor: clickable ? 'pointer' : 'default',
        opacity: disabled ? 0.5 : 1,
        textDecoration: href ? 'none' : undefined,
        color: href ? 'inherit' : undefined,
      }}
    >
      {selection && <RowCheckbox checked={isSelected} onToggle={() => selection.onToggle(id)} />}
      {cells}
      {expand && (
        <span style={{
          flexShrink: 0, width: 16, display: 'flex', justifyContent: 'center',
          color: TEXT_MUTED, fontSize: FS_BASE,
          transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms',
        }}>
          &#8250;
        </span>
      )}
    </RowTag>
  )

  if (expand && isExpanded) {
    return (
      <div>
        {rowBody}
        {/* 14px horizontal matches `padding` so detail content lines up with
            the row's own text. Vertical is the standard SPACE_12 — the panel
            needs to breathe from the row above it, not hug it. */}
        <div style={{ padding: `${SPACE_12}px 14px`, borderBottom: divider }}>
          {expand.render(row)}
        </div>
      </div>
    )
  }

  return rowBody
}

/**
 * The one flexible list/table primitive. Three orthogonal, independently
 * optional concerns — combine any of them:
 *
 *  - `selection`  — a checkbox column + bulk multi-select.
 *                    { selected: Set, onToggle(id), bulkHeader?: boolean }
 *  - `navigate`   — clicking a row's body (not its checkbox) opens something.
 *                    { onClick(row) } and/or { href(row) }. href renders the
 *                    row as a real <a> — needed for actual cross-route links
 *                    (DictionaryPage's EntryRow, DictionaryEntryPage's
 *                    DeckRow) so cmd/ctrl/middle-click and hover-preview keep
 *                    working; onClick alone (a div, no real link) suits
 *                    same-app navigation via a hash assignment side effect
 *                    (EpisodeList, TrackedAnimeSection). Both may be given
 *                    together if a real link also needs an onClick side effect.
 *  - `expand`     — clicking a row's body reveals inline detail. Mutually
 *                    exclusive with `navigate` (a click can't do both).
 *                    { expanded: Set, onToggle(id), render(row) }
 *
 * None of the three: rows are purely informational (e.g. a list of example
 * sentences to read) — no checkbox, no cursor, no click handler.
 * `selection` alone: EpisodeVocabBrowser's word list — click anywhere toggles.
 * `selection` + `navigate` together: a Shopify-orders-list row — check the
 * box to bulk-select, click elsewhere on the row to open it. The checkbox
 * stops its own click from also firing `navigate.onClick`.
 *
 * columns: [{ key, render?(row), width?, flex?, align?, tone?: 'muted', wrap? }]
 * editableFields: string[] of column keys to render as inline text inputs
 * onFieldChange: (row, key, value) => void — required if editableFields is set
 * search: { value, onChange, placeholder } — renders a search row when present
 * footer: ReactNode rendered below the rows (e.g. a primary action button)
 * rowState?: (row) => { disabled?: boolean } — per-row disabled/busy (only
 *   the row being acted on dims and ignores clicks, not the whole list —
 *   MediaSearch while a result is being selected). Only affects navigate/
 *   expand rows.
 */
export default function DataList({
  columns,
  rows,
  rowKey = row => row.id,
  selection,
  navigate,
  expand,
  editableFields,
  onFieldChange,
  search,
  footer,
  emptyMessage = 'Nothing here yet.',
  gap = SPACE_12,
  padding = '10px 14px', // matches SelectableRow's own default — the two must stay visually consistent
  maxWidth = 640,
  rowState,
}) {
  const selected = selection?.selected ?? new Set()
  const allSelected = rows.length > 0 && rows.every(r => selected.has(rowKey(r)))
  const someSelected = rows.some(r => selected.has(rowKey(r)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: maxWidth, maxWidth: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', background: SURFACE, border: `1px solid ${HAIRLINE}`, borderRadius: 8, overflow: 'hidden' }}>
        {search && (
          <div style={{ padding, borderBottom: `1px solid ${HAIRLINE}` }}>
            <input
              type="text"
              value={search.value}
              onChange={e => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? 'Search...'}
              style={{ width: '100%', fontSize: FS_BASE, fontFamily: FONT, letterSpacing: 'normal', background: 'transparent', border: 'none', color: TEXT, outline: 'none' }}
            />
          </div>
        )}

        {selection?.bulkHeader && (
          // gap: 10 matches EpisodeVocabBrowser's real bulk-select header exactly —
          // not on the spacing scale, kept as a faithful port.
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding, borderBottom: `1px solid ${HAIRLINE}` }}>
            <SelectAllCheckbox
              checked={allSelected}
              indeterminate={!allSelected && someSelected}
              onChange={() => rows.forEach(r => {
                const id = rowKey(r)
                const isOn = selected.has(id)
                if (allSelected ? isOn : !isOn) selection.onToggle(id)
              })}
            />
            <span style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
              {selected.size} of {rows.length} selected
            </span>
          </div>
        )}

        {rows.length === 0 ? (
          <div style={{ padding: SPACE_16, fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
            {emptyMessage}
          </div>
        ) : (
          rows.map((row, i) => (
            <Row
              key={rowKey(row)}
              row={row}
              rowKey={rowKey}
              columns={columns}
              selection={selection}
              navigate={navigate}
              expand={expand}
              editableFields={editableFields}
              onFieldChange={onFieldChange}
              gap={gap}
              padding={padding}
              isLast={i === rows.length - 1}
              rowState={rowState}
            />
          ))
        )}
      </div>

      {footer && <div style={{ marginTop: SPACE_12, display: 'flex', justifyContent: 'flex-end' }}>{footer}</div>}
    </div>
  )
}
