-- Simple-edition headline, paired with body_simple the way `title` pairs
-- with body_ja. Nullable: the reader falls back to `title` when absent.
alter table articles add column if not exists title_simple text;
