-- Fixed topical taxonomy assigned by Claude at generation time (fetch-nhk.mjs).
-- Nullable: articles generated before this column existed stay uncategorized
-- rather than being backfilled with a guess.
alter table articles add column if not exists category text;
create index if not exists articles_category_idx on articles (category);
