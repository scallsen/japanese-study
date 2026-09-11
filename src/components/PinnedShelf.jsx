import FeedCard from './FeedCard.jsx'
import Button from './Button.jsx'
import { SPACE_12 } from '../data/theme.js'

// Matches MediaSearch's own result-tile grid (repeat(auto-fill, minmax(140px,
// 1fr))) — a pinned item and a search result should read as the same object.
const TILE_WIDTH = 140

/**
 * A small, user-curated set of pinned items — "Currently studying" is the
 * first caller. Renders as one row of cover tiles that scrolls sideways
 * instead of stacking down, so pinning a 20th item never pushes the rest of
 * the page further away than pinning a 2nd one did.
 *
 * Deliberately not the same component as a "recently read/viewed" history
 * list (see CLAUDE.md's Style Guide section, settled decision #8): this one
 * is a small set the user explicitly adds to and removes from; a history is
 * an unbounded, auto-populated trail nobody curates. They can share this
 * shelf's bounded-scroll shape later without sharing its remove affordance.
 *
 * Each tile is a FeedCard in its `image` mode — the same tile ResultTile
 * uses for search results — so this stays a thin composition, not a new
 * visual language.
 */
export default function PinnedShelf({ items, onSelect, onRemove }) {
  if (items.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: SPACE_12, overflowX: 'auto', paddingBottom: 4 }}>
      {items.map(item => (
        <div key={item.id} style={{ position: 'relative', width: TILE_WIDTH, flexShrink: 0 }}>
          <FeedCard
            image={{ src: item.coverUrl, aspectRatio: '5 / 7' }}
            title={item.title}
            badges={item.badges}
            onClick={onSelect ? () => onSelect(item) : undefined}
          />
          {onRemove && (
            <div style={{ position: 'absolute', top: 6, right: 6, borderRadius: 6, background: 'rgba(20,20,20,0.6)' }}>
              <Button
                variant="ghost-muted"
                size="sm"
                icon="×"
                label={`Stop tracking ${item.title}`}
                onClick={e => { e.stopPropagation(); onRemove(item.id) }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
