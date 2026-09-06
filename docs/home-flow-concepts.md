# Learn → remember: three shapes for the loop

Bench: `#/dev/home-flow` (`src/pages/HomeFlowLabPage.jsx`). Three concepts over
one fabricated learner (Genki 1, three lessons drilled and sent, four SRS
decks). Every control in the frame changes that state, so a full lap can be
walked in each concept: start the current lesson, finish it, answer the
send-to-SRS prompt, look at the decks. Home cards are real `PrimaryCard`s;
pages are mocks built from the component library.

## The problem

The home page now carries the two primary actions — "Start Lesson N" on the
textbook card, "Start reviews" on the review card — but both cards still link
down into index pages designed before the cards existed:

- `#/vocab`'s home screen is a source dropdown, a chapter tile grid with
  multi-select, drill-mode chips and a settings sidebar. It doesn't know
  which book is chosen or which chapter is current; the pointer is written
  only by the home card. Its "Send to SRS" button is hardcoded disabled.
  The card's "View all chapters" link goes to a chapters page that was never
  built (review log: "Not yet built: the chapters page … and the
  end-of-lesson send to SRS prompt").
- `#/vocab-srs`'s home is a queue summary, a Start button and two import
  buttons. Deck On/Off and "Manage cards" live in the settings sidebar. The
  summary and the button now duplicate the home card exactly.

So the question is not "how do we tidy these pages" but "what is left for
them to do".

## Rules shared by every concept

1. **One pointer, one rule.** The current chapter is the only progress
   state. A drill started from the home card's primary button advances it
   on completion; a drill started from anywhere else is a free drill and
   never touches it. "Free drill" is therefore not a mode — it is every
   drill that is not the current lesson. This makes the card's one button
   always read "Start <current>", which also settles the review log's open
   Continue/Start-next alignment call.
2. **Every drill ends the same way.** One done screen. Its send-to-SRS
   prompt defaults to a deck named after the book (created on first send),
   with the deck picker there to override. Skipping asks once. A chapter
   already in the SRS gets no prompt. "Start <next>" is on the done screen
   so the loop continues without going home.
3. **All decks on by default.** "Start reviews" runs the queue across every
   active deck. The deck list is where a deck is switched off, browsed,
   renamed, deleted. Card-display settings stay in the review drill's own
   sidebar; queue settings (daily new, leech, Hard/Easy) sit with the decks
   because they change what the home card promises.
4. **Other modules feed the same place.** Immersion, Story, Anime Vocab and
   the dictionary keep adding to their own imported decks, which show up in
   the deck list like any other.

## A · Home is the console

The textbook card manages progress by itself. A "Current · Lesson 4 ▾"
control on the card opens a chapter picker (Popover + OptionPicker; a sheet
on mobile) that sets the pointer directly. The primary button is always one
button. "Drill any list" is a quiet link that opens a sheet — book, lists,
drill mode, Preview / Start — and launches a free drill.

- Deletes: the `#/vocab` home screen (source dropdown, tiles, action bar,
  settings sidebar on the home); the `#/vocab-srs` home; the deck section of
  the SRS settings sidebar.
- Adds: pointer popover on the card; the free-drill sheet; a `#/decks` page
  (deck list with On/Off and a state bar per deck, Import menu, review
  settings). The card browser is unchanged, re-homed under Decks.
- Routes: `#/vocab` is the drill and needs a query (`?chapter=…&start=1`
  today; `?lists=a,b&mode=…` for free drills). `#/vocab-srs` is the review.
  Bare visits to either go home.
- Cost: the card gets a fourth element (the pointer row). At 390px it still
  fits with one button. The sheet is the current home screen in a modal, so
  its selection logic ports; only the chrome is new.

## B · Two focused pages

Home cards stay launchers (one primary, "Redo <current>" as a quiet link).
Each index is rebuilt around its real job.

- `#/vocab` becomes the textbook page: cover, progress, Change textbook, then
  the chapter path — one row per chapter with ✓ / ▶ / ○, word count,
  Current / In SRS badges, expanding to Drill · Preview · Send to SRS · Set
  as current. "Other lists" underneath is a disclosure holding today's
  picker for free drilling. The settings sidebar stays.
- `#/vocab-srs` becomes a decks page: the queue summary and Start button
  demoted to a card at the top, the deck list (out of the sidebar) with
  On/Off and a state bar, Import, and settings in the sidebar.
- Deletes nothing structurally; changes both screens.
- Cost: management is two clicks from home instead of on it, and "View all
  chapters" remains a page whose two useful actions (Set as current, Send to
  SRS) the card could have offered. The Start button on the decks page is a
  duplicate of the home card's on purpose.

## C · One vocabulary hub

A chapter list and an SRS deck are the same kind of thing: a set of words.
One `#/vocabulary` page with two tabs — Learn (the chapter path, other books
beneath) and Remember (decks) — replaces both indexes. Sending a chapter
lands in a deck named after the book, so the Remember tab mirrors the Learn
tab ("201 cards · 4 of 12 chapters sent").

- Deletes both homes and the SRS module's identity as a module.
- Adds one page.
- Cost: a two-tab page is two pages with a worse address, and the module
  accent has to flip per tab (blue Learn, green Remember). The strongest
  idea in C is the mirror rule, and that transfers to A and B unchanged.

## Recommendation: A, with C's mirror rule

A is what the home redesign already implies. The cards were made the
primary actions; the pages underneath are left doing summary work the cards
now do better, plus three management jobs — move the pointer, drill
something else, switch a deck off — none of which needs a page.

- The pointer belongs next to the button it drives. Anywhere else, the
  "Set as current" action is a click away from the thing it changes.
- A free drill is rare relative to the current lesson; a sheet is the right
  size, and it is the exact interaction the textbook picker already uses
  from the same card.
- A deck list with toggles is a list, not a home. The Decks page is one
  screen, and the browse page already exists.
- Two index screens and one sidebar section go away. B keeps both and asks
  them to justify themselves; C removes them by merging, which spends more
  than it saves.

Open questions to settle before building A:

- **Multi-select in the sheet.** The recorded decision for the chapters flow
  was no multi-select and no review/sentence-vocab toggles. The card honours
  that. The sheet is the one place multi-select is useful (drill Lessons
  1–3 together before a test) — keep it there, or hold the line everywhere?
- **Bare `#/vocab` and `#/vocab-srs`.** Redirect home, or open the sheet /
  Decks page respectively? Redirect is simplest and nothing links there.
- **Personal (Coto) books in the sheet.** Same `visibleSources` rule as
  today — shown only to an account that owns words in them.

Build order for A, each step shippable on its own:

1. Card: pointer popover, one-button rule, pointer advances when a drill
   started from the card finishes (`homeCards.jsx`, `DashboardPage`,
   `VocabPage`'s finish handler).
2. Done screen: send-to-SRS prompt with the book-named deck default, skip
   confirm, "Start <next>"; delete the dead "Send to SRS" button.
3. Free-drill sheet from the card; `#/vocab` becomes drill-only, taking its
   lists from the query; delete `HomeScreen` / `SubListTile`.
4. `#/decks`: deck list, Import menu, review settings; `#/vocab-srs` becomes
   review-only; delete the SRS home body and the sidebar deck section;
   re-home the browse page.
5. CLAUDE.md, smoke routes, retire this bench.
