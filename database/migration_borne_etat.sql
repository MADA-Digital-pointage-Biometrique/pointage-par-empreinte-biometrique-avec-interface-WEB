-- Migration : état poussé par la borne (heartbeat) pour afficher
-- « En service » sur un serveur distant (VPS/Dokploy) sans COM local.
-- Sur base neuve : déjà inclus via schema.sql (IF NOT EXISTS, rejouable).
-- Sur base existante : psql -f database/migration_borne_etat.sql
CREATE TABLE IF NOT EXISTS public.borne_etat (
    device_id character varying(50) NOT NULL,
    last_seen timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    empreintes integer NOT NULL DEFAULT 0,
    hw_ok boolean,
    watching boolean NOT NULL DEFAULT false,
    PRIMARY KEY (device_id)
);
