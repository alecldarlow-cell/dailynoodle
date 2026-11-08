-- League name rules (8 Nov 2026, Alec's go-ahead after the Google Play check): Google Play's
-- user-generated content policy, as nicknames and league names are shown to other players.
-- board.clean() already refuses a nickname or league name holding a block_any substring or a
-- block_word word; this widens block_word (rude words, slurs, sexual and drug words). Existing
-- names are untouched: the check runs when a name is set (create, join, rename, set nickname).
-- Rollback: re-run the block_word insert in 2026-10-18-leaderboards.sql.
update board.settings set value = (
  select jsonb_agg(distinct w order by w) from (
    select jsonb_array_elements_text(value) w from board.settings where key = 'block_word'
    union
    select unnest(array[
      'shits','shitty','shitting','wankers','wanking','twats','sluts','whores','rapes','raped','rapist','rapists',
      'dicks','dickhead','cocks','pricks','bitches','bastards','arses','asses','arseholes','assholes',
      'tosser','tossers','bellend','knob','knobhead','nob','minge','fanny','cum','jizz','spunk','semen','sperm',
      'porn','porno','sex','sexy','nude','nudes','orgy','tits','titties','boob','boobs','anal','anus','dildo',
      'penis','vagina','clit','pimp','paedo','paedos','pedo','pedos','nonce','nonces',
      'coon','coons','chink','chinks','gook','kike','kikes','wog','wogs','spic','spics','tranny','dyke','fag','fags',
      'homo','retards','retarded','mong','negro','nazis','kkk','isis','jihad',
      'heroin','cocaine','meth','opium'])
  ) t)
where key = 'block_word';
