-- Run this once on Neon. Idempotent.

create table if not exists activities (
  id                    bigint primary key,
  start_date            timestamptz not null,
  type                  text not null,
  name                  text,
  distance_m            real,
  moving_time_s         int,
  elapsed_time_s        int,
  elevation_gain_m      real,
  avg_hr                real,
  max_hr                int,
  avg_watts             real,
  max_watts             int,
  weighted_avg_watts    real,
  kilojoules            real,
  avg_cadence           real,
  suffer_score          int,
  tss                   real,
  intensity_factor      real,
  time_in_zones         jsonb,
  raw                   jsonb not null,
  fetched_at            timestamptz not null default now()
);
create index if not exists activities_start_date_idx on activities (start_date desc);
create index if not exists activities_type_start_idx on activities (type, start_date desc);

create table if not exists streams (
  activity_id           bigint primary key references activities(id) on delete cascade,
  data                  jsonb not null,
  fetched_at            timestamptz not null default now()
);

create table if not exists athlete_profile (
  id                    int primary key default 1,
  ftp                   int,
  max_hr                int,
  resting_hr            int,
  threshold_hr          int,
  threshold_pace_s_per_km real,
  updated_at            timestamptz not null default now(),
  constraint singleton check (id = 1)
);

create table if not exists workout_templates (
  id                    serial primary key,
  name                  text not null,
  sport                 text not null,
  tags                  text[] not null default '{}',
  structure             jsonb not null,
  notes                 text,
  created_at            timestamptz not null default now()
);
create index if not exists workout_templates_sport_idx on workout_templates (sport);
create index if not exists workout_templates_tags_idx on workout_templates using gin (tags);

create table if not exists workout_schedule (
  day_of_week           int primary key check (day_of_week between 0 and 6),
  template_tags         text[] not null,
  sport                 text,
  notes                 text
);

create table if not exists workout_recommendations (
  date                  date primary key,
  template_id           int references workout_templates(id) on delete set null,
  prescribed            jsonb not null,
  reasoning             text,
  completed_activity_id bigint references activities(id) on delete set null,
  created_at            timestamptz not null default now()
);
create index if not exists workout_recs_completed_idx on workout_recommendations (completed_activity_id);
