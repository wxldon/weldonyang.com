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
  fitness_goal          text,
  updated_at            timestamptz not null default now(),
  constraint singleton check (id = 1)
);
alter table athlete_profile add column if not exists fitness_goal text;

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
  notes                 text,
  is_fixed              boolean not null default false
);
alter table workout_schedule add column if not exists is_fixed boolean not null default false;

create table if not exists workout_planned_dates (
  date                  date primary key,
  created_at            timestamptz not null default now()
);

create table if not exists workout_planned_items (
  id                    serial primary key,
  date                  date not null,
  template_tags         text[] not null default '{}',
  sport                 text,
  notes                 text,
  is_fixed              boolean not null default false,
  is_rest               boolean not null default false,
  position              int not null default 0,
  created_at            timestamptz not null default now()
);
create index if not exists workout_planned_items_date_idx on workout_planned_items (date);

create table if not exists workout_recommendations (
  date                  date primary key,
  template_id           int references workout_templates(id) on delete set null,
  prescribed            jsonb not null,
  reasoning             text,
  completed_activity_id bigint references activities(id) on delete set null,
  created_at            timestamptz not null default now()
);
create index if not exists workout_recs_completed_idx on workout_recommendations (completed_activity_id);
