-- Waveform peaks and duration per mix version (ADR 0010, issue #45).
-- Computed by the engineer's browser from the local file at upload and stored with the row.
-- Both nullable: rows uploaded before this change, and WAV variants the browser can't scan, have none.
-- Reads use the existing mix_versions policy (members + active grantees); there is still no UPDATE
-- policy, so the values are written once, at insert, by a member.

alter table public.mix_versions
  add column duration_ms int
    constraint mix_versions_duration_ms_range check (duration_ms between 1 and 24 * 60 * 60 * 1000),
  add column peaks real[]
    -- One flat list of 1–4,000 values, each 0–1, no nulls. `0 <= all(...)` alone would let a null
    -- element through (the comparison is null, and a CHECK treats null as passing); NaN sorts above
    -- every number in Postgres, so `<= 1` rejects it.
    constraint mix_versions_peaks_shape check (
      array_ndims(peaks) = 1
      and cardinality(peaks) between 1 and 4000
      and array_position(peaks, null) is null
      and 0 <= all (peaks)
      and 1 >= all (peaks)
    );

comment on column public.mix_versions.duration_ms is 'Length of the mix in ms, measured in the browser at upload (ADR 0010).';
comment on column public.mix_versions.peaks is 'Waveform peaks (0–1), measured in the browser at upload (ADR 0010).';
