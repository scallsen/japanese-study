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

---

# Round two: concept B, question by question

Bench: `#/dev/textbook-flow` (`src/pages/TextbookFlowLabPage.jsx`). Every
question below is a switch; all of them apply to the one mock at once, so a
combination can be judged as a whole. Walk it: Start Lesson 4 from the card,
Finish, answer the prompt, then compare what the card and the chapter path
say under each advancing model. Rewind with "Set as current" on any row.
Open a lesson's Words. Then Decks.

## 1. How advancing works

The tracker is a bookmark: the one chapter the book is "open at". Three
models for how it moves forward.

- **Explicit advance** — finishing marks the chapter drilled; the tracker
  stays. The card reads "Lesson 4 drilled ✓ · 0 of 63 in SRS", its primary
  becomes **Advance to Lesson 5**, Redo is a quiet link. The chapter row
  gains the same Advance button. *Recommended.* Finishing a drill and
  being done with a lesson are different things (you may redo, send words,
  read the chapter); a deliberate advance keeps them apart and gives the
  SRS gate a natural place to hang. It also means the card always shows
  one primary button.
- **Auto-advance** — finishing from the card moves the tracker at once;
  the card shows "Start Lesson 5" with "Lesson 4 done today" beneath. The
  done screen's prompt is the only gate. Fewest clicks, but a redo of the
  lesson you just did now looks like a free drill, and there is no moment
  to decide.
- **Advance on start** — closest to today: finishing marks drilled, the
  tracker moves when "Start Lesson 5" is pressed. Hides a state change
  inside another action, so the gate fires when you were trying to start
  something.

## 2. Moving the tracker backwards

"Set as current" on any chapter row moves the bookmark there. Nothing is
erased: drilled marks and sent-to-SRS state stay on the chapters ahead,
the progress bar still counts drilled chapters, and the card's primary
becomes "Redo Lesson 2". Advancing from there walks forward through
already-drilled chapters one at a time; the gate never fires for a chapter
whose words are all in the SRS. (Mock: rewind to Lesson 2, then Start,
Finish, Advance.)

## 3. The SRS gate

- **Dialog** — advancing past a chapter with unsent words asks once:
  "Send Lesson 4 to the SRS first?" with **Send 63 and advance** as the
  primary, Advance without sending, Cancel. *Recommended*, with the
  explicit model. It only appears when there is something to send, and it
  appears at the one moment the words are about to fall out of sight.
- **Inline notice** — no interruption; the card and the chapter row carry
  an amber notice with a Send button while unsent words exist. Fine on
  the row, but on the card it nags every visit.
- **None** — only the done screen prompts.

Independent of the gate, every chapter row shows its SRS state: **In SRS**
when every word is sent, "40 of 53 in SRS" in amber when partial, nothing
when none. The row's Send button becomes "Send remaining 13".

## 4. Which words are in the SRS

The lesson's Words screen (from the row, or "Choose words" on the done
screen) lists the lesson with a checkbox column, "Select all not in SRS",
and "Send N to SRS".

- **One list, badges** — every word in book order, an In SRS badge on the
  sent ones. *Recommended*: a textbook lesson's order is meaningful and
  this keeps it; the badge column makes the gaps easy to scan.
- **Two groups** — "Not in SRS" with selection first, "In SRS" read-only
  below. Faster for the send action, loses the book's order.

## 5. Tracker glyphs

Done is a filled grey dot, upcoming a hollow one, in every option. The
current chapter:

- **Ring** — accent dot with a gapped accent ring.
- **Halo** — accent dot with a soft translucent halo. Quieter, lower
  contrast at 12px.
- **Connected path** — the ring plus a line threading the glyphs, grey
  behind the tracker and faint ahead of it. *Recommended*: the list reads
  as a route, and the line tells the rewound case (grey line stops at the
  tracker even though drilled dots continue below it).

## 6. Covers

**Cropped** (recommended): the pixel art's 5/32 transparent gutter is cut
off both sides, so the artwork sits flush against the layout instead of
being offset by a negative margin. The cover is the change-textbook control
on the page as on the card — hover reveals "Change", the same
`.textbook-cover` treatment. This replaces the "Change textbook" button.
Applies to the home card too.

## 7. Free drill

- **Header action** — a "Free drill" button beside the book opens the
  any-book sheet (book, lists, drill mode, Preview / Start). *Recommended.*
  The rows already drill any chapter of the current book without moving
  the tracker, so the sheet is only for other books — and it has to exist
  for one real case: a learner with personal (Coto) lists who is also
  working through a textbook has no other way to reach those lists.
- **Not supported** — changing book is the only route. Clean, but loses
  that case.

## 8. Decks page header

The home Review card gains a third stat, **Minutes** (~8), so the two are
parallel. On the page:

- **Headline + button** — "21 due · 10 new · ~8 min" as the page headline,
  deck/card caption under it, **Start reviews** top right, the state bar
  beneath. No card. *Recommended*: same words as the home card, the page's
  one action beside the numbers it describes.
- **Stat blocks + button** — the card's three stat blocks instead of the
  headline. An exact echo of the card; heavier for a page header.
- **Sticky action bar** — header is information only; Start reviews sits
  in a bottom action bar like the Vocab page's Start review. Consistent
  with the drill pages, but the action lands far from the numbers.

Review settings (daily new, leech, Hard/Easy) stay in the settings
sidebar, next to the card-display settings.

## Build order for B

1. Home card: one primary + Redo link, "drilled ✓ · n of m in SRS" line,
   Advance action and gate, Minutes stat on the Review card, cropped cover.
2. Textbook page replacing the Vocab home: header (cover, progress, Free
   drill), chapter path with glyphs, row actions (Start/Drill, Words, Send,
   Set as current, Advance), free-drill sheet.
3. Words screen: the existing Preview/glance screen with selection, In SRS
   badges and Send.
4. Done screen: prompt with book-named deck default, "Choose words",
   Advance / Start next per the model chosen.
5. Decks page replacing the SRS home: header, deck list out of the sidebar,
   Import menu; browse page re-homed under it.
6. CLAUDE.md, smoke routes, retire both benches.
