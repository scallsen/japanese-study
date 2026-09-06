# Textbook vocabulary input

Drop raw textbook word lists here. They are **not committed** (see `.gitignore`) —
this directory is matching input only. `scripts/resolve-textbook-vocab.mjs` reads
a file from here and emits `src/data/words/<book>_vocab.json` containing nothing
but `{ id, listKey, jmdictId }`; glosses and readings are resolved from the
`dictionary` table at render time.

## Expected columns

One row per word. Header row optional — the parser sniffs it. Any delimiter
(comma, tab, pipe) and any column order.

| Column   | Meaning                                                        |
|----------|----------------------------------------------------------------|
| lesson   | Lesson number, e.g. `1` or `L1` or `Lesson 1`                   |
| spelling | Exactly as the book writes it — kana for kana-taught words      |
| reading  | Full kana reading                                               |
| gloss    | The book's own English. Used only to disambiguate; never stored |

```csv
lesson,spelling,reading,gloss
1,学生,がくせい,student
1,友だち,ともだち,friend
2,ちょっと,ちょっと,a little
13,ある,ある,there is (inanimate); to exist
```

Genki lessons 1–12 map to `genki-1-l1`…`genki-1-l12`, 13–23 to
`genki-2-l13`…`genki-2-l23`, per `src/data/textbooks.js`.
