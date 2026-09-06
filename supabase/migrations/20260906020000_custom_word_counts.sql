-- How many words the caller has in each of their chapters.
--
-- The picker needs a count per chapter to draw its tiles, and fetching every
-- row to count them client-side would pull ~5,000 rows to render 36 numbers.
-- security invoker (the default), so row-level security still applies and a
-- caller only ever counts their own words.
create or replace function custom_word_counts()
returns table (list_key text, n bigint)
language sql
stable
set search_path = public
as $$
  select list_key, count(*)
  from custom_words
  where user_id = auth.uid()
  group by list_key;
$$;

revoke execute on function custom_word_counts() from public;
grant execute on function custom_word_counts() to authenticated;
