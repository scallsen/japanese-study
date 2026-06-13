#!/usr/bin/env python3
"""
Exports FSRS scheduling state from Anki's Core 2000 deck to anki-sync-cards.json.
Import that file in the japanese-study app's Vocab SRS module to seed your progress.

Usage:
  python3 scripts/anki-sync.py [--output anki-sync-cards.json] [--db /path/to/collection.anki2]

Requires: Anki 23.10+ with FSRS enabled on the Core 2000 deck.
"""

import sqlite3, json, datetime, sys, argparse, pathlib

ANKI_BASE = pathlib.Path.home() / "Library" / "Application Support" / "Anki2"
CORE2000_DECK_NAME = "Core 2000"


def find_collection():
    skip = {"addons21", "logs"}
    for entry in ANKI_BASE.iterdir():
        if entry.is_dir() and entry.name not in skip:
            db = entry / "collection.anki2"
            if db.exists():
                return db
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--output", default="anki-sync-cards.json", help="Output file path (default: anki-sync-cards.json)")
    parser.add_argument("--db", help="Path to collection.anki2 (auto-detected from ~/Library/Application Support/Anki2/ if omitted)")
    parser.add_argument("--deck", default=CORE2000_DECK_NAME, help=f"Anki deck name to export (default: '{CORE2000_DECK_NAME}')")
    args = parser.parse_args()

    db_path = pathlib.Path(args.db) if args.db else find_collection()
    if not db_path or not db_path.exists():
        print(f"Error: Could not find Anki collection database.", file=sys.stderr)
        print(f"  Searched: {ANKI_BASE}/<profile>/collection.anki2", file=sys.stderr)
        print(f"  Use --db to specify the path manually.", file=sys.stderr)
        sys.exit(1)

    print(f"Reading: {db_path}")
    db = sqlite3.connect(str(db_path))
    db.row_factory = sqlite3.Row

    all_decks = db.execute("SELECT id, name FROM decks").fetchall()
    deck_row = next((r for r in all_decks if r["name"] == args.deck), None)
    if not deck_row:
        print(f"Error: Deck '{args.deck}' not found.", file=sys.stderr)
        print("Available decks:", file=sys.stderr)
        for row in sorted(all_decks, key=lambda r: r["name"]):
            print(f"  {row['name']}", file=sys.stderr)
        sys.exit(1)

    deck_id = deck_row["id"]
    crt = db.execute("SELECT crt FROM col").fetchone()["crt"]
    now = datetime.datetime.now(datetime.timezone.utc)

    rows = db.execute(
        "SELECT c.type, c.queue, c.due, c.ivl, c.reps, c.lapses, c.data "
        "FROM cards c WHERE c.did = ?",
        (deck_id,),
    ).fetchall()

    result = {}
    skipped_new = 0
    skipped_no_pos = 0

    for row in rows:
        raw_data = row["data"]
        if not raw_data:
            skipped_no_pos += 1
            continue

        data = json.loads(raw_data)
        pos = data.get("pos")
        if pos is None:
            skipped_no_pos += 1
            continue

        card_type = row["type"]
        if card_type == 0:
            skipped_new += 1
            continue

        app_id = f"anki-{pos + 1}"
        lrt = data.get("lrt")

        if card_type == 2:
            due_dt = datetime.datetime.fromtimestamp(crt + row["due"] * 86400, tz=datetime.timezone.utc)
        else:
            due_dt = datetime.datetime.fromtimestamp(row["due"], tz=datetime.timezone.utc)

        last_review_dt = datetime.datetime.fromtimestamp(lrt, tz=datetime.timezone.utc) if lrt else None
        elapsed = (now - last_review_dt).total_seconds() / 86400 if last_review_dt else 0

        card_state = {
            "id": app_id,
            "deckId": "core2000",
            "due": due_dt.isoformat(),
            "stability": data.get("s", 1.0),
            "difficulty": data.get("d", 5.0),
            "elapsed_days": round(elapsed, 2),
            "scheduled_days": max(0, row["ivl"]),
            "learning_steps": 0,
            "reps": row["reps"],
            "lapses": row["lapses"],
            "state": card_type,
            "last_review": last_review_dt.isoformat() if last_review_dt else None,
        }

        if row["queue"] == -1:
            card_state["suspended"] = True

        result[app_id] = card_state

    output_path = pathlib.Path(args.output)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    suspended = sum(1 for c in result.values() if c.get("suspended"))
    print(f"Exported {len(result)} reviewed cards  ({skipped_new} new skipped, {skipped_no_pos} without FSRS data skipped)")
    if suspended:
        print(f"  Suspended: {suspended}")
    print(f"Output: {output_path.resolve()}")
    print()
    print("Next: open Vocab SRS in the app, expand Import, and load this file with 'Sync from Anki'.")


if __name__ == "__main__":
    main()
