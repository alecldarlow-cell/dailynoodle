-- 22 Nov 2026: dailynoodle.co.uk became puzzles only (SITE.md › Sections). News moved to
-- news.dailynoodle.co.uk and Games to games.dailynoodle.co.uk; all three sites send events here with
-- the same item_path rules, so 'index.html' now means three front pages, told apart by section:
--   section 'puzzles' → the bare address dailynoodle.co.uk/ (the Puzzles front page, from 22 Nov)
--   section 'news'    → news.dailynoodle.co.uk/ (the News list; on dailynoodle.co.uk before 22 Nov)
--   section 'games'   → games.dailynoodle.co.uk/ (the Games list)
-- Alec's rule (10 Nov 2026): from the switch day the bare address counts as Puzzles and the News list as
-- News; older figures stay as they were (no recount; a step on 22 Nov is accepted).
--
-- admin_dashboard changes, nothing else:
-- 1. rsec (which section a reader used): 'index.html' stays 'site' (counts as none) before 22 Nov and for
--    the News list after it, as before; from 22 Nov a Puzzles or Games front-page view counts as that section.
-- 2. front_pages keeps its three keys with one meaning each across the switch:
--    'index.html' = the News list, 'puzzles.html' = the Puzzles front page (either address),
--    'games.html' = the Games list (either address).
-- Applied by editing the live definition in place, and refusing if either piece is not found.
do $mig$
declare
  d text := pg_get_functiondef('public.admin_dashboard(date,date,boolean)'::regprocedure);
  o1 text := $o1$case when e.item_path = 'index.html' then 'site' else e.section end as rsec$o1$;
  n1 text := $n1$case when e.item_path = 'index.html' and (e.day < date '2026-11-22' or e.section = 'news') then 'site' else e.section end as rsec$n1$;
  o2 text := $o2$    select item_path as page, count(distinct anon_id) as readers, count(distinct pv) as page_loads
    from ev where event = 'page_view' and item_path in ('index.html', 'puzzles.html', 'games.html') group by 1$o2$;
  n2 text := $n2$    select case when item_path = 'index.html' and day >= date '2026-11-22' and section = 'puzzles' then 'puzzles.html'
                when item_path = 'index.html' and day >= date '2026-11-22' and section = 'games' then 'games.html'
                else item_path end as page,
      count(distinct anon_id) as readers, count(distinct pv) as page_loads
    from ev where event = 'page_view' and item_path in ('index.html', 'puzzles.html', 'games.html') group by 1$n2$;
begin
  if position(o1 in d) = 0 then raise exception 'admin_dashboard: rsec line not found'; end if;
  if position(o2 in d) = 0 then raise exception 'admin_dashboard: front_pages block not found'; end if;
  d := replace(replace(d, o1, n1), o2, n2);
  execute d;
end
$mig$;
