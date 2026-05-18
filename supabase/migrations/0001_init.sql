-- ============================================================
-- Devisly — Schéma initial Supabase
-- Tables : users, entreprises, clients, devis, prestations, abonnements
-- Sécurité : Row Level Security activée sur toutes les tables
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. users — profil applicatif lié à auth.users
-- ------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text default '',
  role        text default 'Gérant',
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. entreprises — une entreprise par compte propriétaire
-- ------------------------------------------------------------
create table if not exists public.entreprises (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references auth.users (id) on delete cascade,
  name        text not null default '',
  legal_form  text default '',
  capital     text default '',
  siret       text default '',
  rcs         text default '',
  ape         text default '',
  tva_number  text default '',
  address     text default '',
  zip         text default '',
  city        text default '',
  phone       text default '',
  email_pro   text default '',
  website     text default '',
  iban        text default '',
  insurance   text default '',
  logo        text default '',
  settings    jsonb not null default jsonb_build_object(
                'quotePrefix', 'DEV', 'nextSeq', 1,
                'invoicePrefix', 'FAC', 'nextInvoiceSeq', 1,
                'defaultTva', 10, 'defaultMargin', 1.15,
                'defaultValidity', 30, 'relanceEnabled', true, 'relanceDelay', 7
              ),
  factures    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. clients — carnet d'adresses
-- ------------------------------------------------------------
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  name          text not null,
  contact       text default '',
  email         text default '',
  phone         text default '',
  address       text default '',
  zip           text default '',
  city          text default '',
  siret         text default '',
  kind          text default 'pro',
  created_at    timestamptz not null default now()
);
create index if not exists clients_entreprise_idx on public.clients (entreprise_id);

-- ------------------------------------------------------------
-- 4. prestations — bibliothèque réutilisable
-- ------------------------------------------------------------
create table if not exists public.prestations (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  label         text not null,
  unit          text default 'u',
  price         numeric(12,2) not null default 0,
  section       text default 'maindoeuvre',
  category      text default 'Autres',
  created_at    timestamptz not null default now()
);
create index if not exists prestations_entreprise_idx on public.prestations (entreprise_id);

-- ------------------------------------------------------------
-- 5. devis — le détail (sections, lignes, paiements) en JSONB
-- ------------------------------------------------------------
create table if not exists public.devis (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  client_id     uuid references public.clients (id) on delete set null,
  number        text not null,
  title         text default '',
  status        text not null default 'draft',
  total_ht      numeric(12,2) not null default 0,
  total_ttc     numeric(12,2) not null default 0,
  issued_on     date not null default current_date,
  valid_until   date,
  content       jsonb not null default '{}'::jsonb,
  share_token   text not null unique default encode(gen_random_bytes(12), 'hex'),
  client_response jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists devis_entreprise_idx on public.devis (entreprise_id);
create index if not exists devis_share_idx on public.devis (share_token);

-- ------------------------------------------------------------
-- 6. abonnements — état de l'abonnement Stripe (1 par entreprise)
-- ------------------------------------------------------------
create table if not exists public.abonnements (
  id                     uuid primary key default gen_random_uuid(),
  entreprise_id          uuid not null unique references public.entreprises (id) on delete cascade,
  plan                   text not null default 'starter',           -- starter | pro | entreprise
  status                 text not null default 'active',            -- active | trialing | past_due | canceled | incomplete
  billing_interval       text default 'month',                      -- month | year
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now()
);
create index if not exists abonnements_customer_idx on public.abonnements (stripe_customer_id);

-- ============================================================
-- Déclencheur : à l'horodatage de mise à jour
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists devis_touch on public.devis;
create trigger devis_touch before update on public.devis
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Déclencheur : création automatique du profil à l'inscription
--   Crée users + entreprises + abonnements (plan Starter)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_entreprise_id uuid;
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));

  insert into public.entreprises (owner_id, name, email_pro)
  values (new.id, coalesce(new.raw_user_meta_data->>'company_name', 'Mon entreprise'), new.email)
  returning id into new_entreprise_id;

  insert into public.abonnements (entreprise_id, plan, status)
  values (new_entreprise_id, 'starter', 'active');

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Fonction utilitaire : id de l'entreprise de l'utilisateur courant
-- ============================================================
create or replace function public.my_entreprise_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.entreprises where owner_id = auth.uid() limit 1;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- Chaque utilisateur n'accède qu'aux données de SON entreprise.
-- ============================================================
alter table public.users        enable row level security;
alter table public.entreprises  enable row level security;
alter table public.clients      enable row level security;
alter table public.prestations  enable row level security;
alter table public.devis        enable row level security;
alter table public.abonnements  enable row level security;

-- --- users : chacun lit/modifie son profil ---
create policy "users_select_self" on public.users
  for select using (id = auth.uid());
create policy "users_update_self" on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- --- entreprises : le propriétaire uniquement ---
create policy "entreprises_all_owner" on public.entreprises
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- --- clients ---
create policy "clients_all_own" on public.clients
  for all using (entreprise_id = public.my_entreprise_id())
  with check (entreprise_id = public.my_entreprise_id());

-- --- prestations ---
create policy "prestations_all_own" on public.prestations
  for all using (entreprise_id = public.my_entreprise_id())
  with check (entreprise_id = public.my_entreprise_id());

-- --- devis ---
create policy "devis_all_own" on public.devis
  for all using (entreprise_id = public.my_entreprise_id())
  with check (entreprise_id = public.my_entreprise_id());

-- --- abonnements : lecture seule côté utilisateur.
--     Les écritures se font via les webhooks Stripe (clé service_role,
--     qui contourne la RLS). ---
create policy "abonnements_select_own" on public.abonnements
  for select using (entreprise_id = public.my_entreprise_id());

-- ============================================================
-- Partage public d'un devis (lien client, sans authentification)
-- Accès en lecture / réponse via fonctions SECURITY DEFINER.
-- ============================================================
create or replace function public.get_shared_quote(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d record; e record; c record;
begin
  select * into d from public.devis where share_token = p_token;
  if not found then return null; end if;
  select * into e from public.entreprises where id = d.entreprise_id;
  select * into c from public.clients where id = d.client_id;
  return jsonb_build_object(
    'devis', to_jsonb(d),
    'entreprise', to_jsonb(e) - 'factures' - 'settings',
    'client', to_jsonb(c)
  );
end; $$;

create or replace function public.respond_to_quote(p_token text, p_status text, p_name text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('accepted', 'refused') then return false; end if;
  update public.devis
     set client_response = jsonb_build_object('status', p_status, 'name', p_name, 'at', extract(epoch from now()) * 1000),
         status = case when p_status = 'accepted' then 'accepted' else 'refused' end
   where share_token = p_token;
  return found;
end; $$;

grant execute on function public.get_shared_quote(text)  to anon, authenticated;
grant execute on function public.respond_to_quote(text, text, text) to anon, authenticated;
