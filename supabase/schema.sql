-- Gezinsassistent Supabase schema
-- Voer dit uit in Supabase SQL editor

-- Taak uitvoeringen (afvinkgeschiedenis)
create table if not exists taak_uitvoering (
  id bigserial primary key,
  taak_naam text not null,
  uitgevoerd_op date not null default current_date,
  aangemaakt_op timestamptz default now()
);

-- Handmatige agenda items
create table if not exists agenda_items (
  id bigserial primary key,
  titel text not null,
  datum date,
  herhaal_interval_dagen integer,
  notitie text default '',
  aangemaakt_op timestamptz default now()
);

-- App configuratie (verjaardagen, taken, voorkeuren)
create table if not exists app_config (
  sleutel text primary key,
  waarde jsonb not null,
  bijgewerkt_op timestamptz default now()
);

-- Suggestie feedback (likes/dislikes)
create table if not exists suggestie_feedback (
  id bigserial primary key,
  tekst text not null,
  oordeel integer not null check (oordeel in (1, -1)),
  aangemaakt_op timestamptz default now()
);

-- Cache voor externe API calls
create table if not exists cache (
  sleutel text primary key,
  waarde text not null,
  bijgewerkt_op timestamptz default now()
);

-- Initiële configuratie invoegen
insert into app_config (sleutel, waarde) values
('verjaardagen', '[]'::jsonb),
('huishoudtaken', '[
  {"naam": "Stofzuigen", "interval_dagen": 7},
  {"naam": "Bedden opmaken / wassen", "interval_dagen": 14},
  {"naam": "Ramen lappen", "interval_dagen": 42},
  {"naam": "Badkamer schoonmaken", "interval_dagen": 7},
  {"naam": "Boodschappen", "interval_dagen": 7},
  {"naam": "Planten water geven", "interval_dagen": 3},
  {"naam": "Vuilnis buiten zetten", "interval_dagen": 14}
]'::jsonb),
('feestdagen', '[
  {"naam": "Sinterklaas", "datum": "12-05"},
  {"naam": "Kerst", "datum": "12-25"},
  {"naam": "Kerst 2e dag", "datum": "12-26"},
  {"naam": "Nieuwjaarsdag", "datum": "01-01"},
  {"naam": "Koningsdag", "datum": "04-27"},
  {"naam": "Bevrijdingsdag", "datum": "05-05"}
]'::jsonb),
('instellingen', '{
  "locatie": "Hilversum",
  "vakantie_regio": "Noord-Holland, Hemnes omgeving",
  "werk_regio": "Regio Midden"
}'::jsonb)
on conflict (sleutel) do nothing;

-- RLS uitschakelen (app doet auth zelf via JWT cookie)
alter table taak_uitvoering disable row level security;
alter table agenda_items disable row level security;
alter table app_config disable row level security;
alter table suggestie_feedback disable row level security;
alter table cache disable row level security;
