-- Sprint 13 nit 4: versioned packs — drop slug-unique, add (slug,version) unique
alter table public.playbooks drop constraint if exists playbooks_slug_key;
alter table public.playbooks add constraint playbooks_slug_version_key unique (slug, version);
