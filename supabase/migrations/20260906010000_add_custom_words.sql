-- A learner's own word lists — course material that is theirs, not the app's.
--
-- The app's bundled lists are published textbooks and ship in the repo. These
-- are one person's class notes: their own chunking of a book, their own example
-- sentences, their own review markers. They belong to an account, so they live
-- here rather than in the bundle, where every visitor would download them.
--
-- One row per word rather than one blob per list: the drill only ever needs the
-- chapters actually selected, so it fetches ~250 rows instead of 5,277.
create table if not exists custom_words (
  user_id  uuid references auth.users on delete cascade not null,
  id       text not null,           -- the word's own id, unique within the user
  list_key text not null,           -- the chapter it belongs to
  payload  jsonb not null,          -- the word itself: kanji, kana, sentence, ...
  primary key (user_id, id)
);

-- Every read is "give me these chapters, for me", so this is the index that
-- matters; the primary key covers lookups by id.
create index if not exists custom_words_user_list_idx on custom_words (user_id, list_key);

alter table custom_words enable row level security;

-- A learner sees and edits only their own words. Unlike `progress`, there is no
-- service-role delete path needed: user_id cascades from auth.users, so account
-- deletion removes these without delete-account having to know about them.
create policy "select own words" on custom_words for select
  using (auth.uid() = user_id);

create policy "insert own words" on custom_words for insert
  with check (auth.uid() = user_id);

create policy "update own words" on custom_words for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own words" on custom_words for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on custom_words to authenticated;
grant all on custom_words to service_role;
