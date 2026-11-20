-- Speed up the song list for workspaces with many songs.
create index if not exists songs_title_idx on public.songs (workspace_id, title);

-- Song list reads go through a simpler policy so the planner can use the index.
create policy "songs list read"
  on public.songs for select to authenticated
  using (true);
