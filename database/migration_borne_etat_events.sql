-- Migration : dernier événement détection dans borne_etat (widget temps réel
-- visible depuis n'importe quel appareil, pas seulement le PC borne).
-- Sur base neuve : déjà inclus via schema.sql (ALTER ... IF NOT EXISTS, rejouable).
-- Sur base existante : psql -f database/migration_borne_etat_events.sql
ALTER TABLE public.borne_etat ADD COLUMN IF NOT EXISTS last_seq integer;
ALTER TABLE public.borne_etat ADD COLUMN IF NOT EXISTS last_detection timestamp without time zone;
ALTER TABLE public.borne_etat ADD COLUMN IF NOT EXISTS last_result jsonb;
