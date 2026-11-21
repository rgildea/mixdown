-- Use the shared access helper for songs too, so songs and mix_versions read rules stay identical
-- and there's one place to change when client access evolves.
drop policy "members and active grantees can read songs" on public.songs;
create policy "members and active grantees can read songs"
  on public.songs for select to authenticated
  using (private.can_access_song(id));
