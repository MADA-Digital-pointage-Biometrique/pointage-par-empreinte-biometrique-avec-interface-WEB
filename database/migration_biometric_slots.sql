-- Migration: biometric_slots (R307) + audit immuable + offline
-- Compatible MySQL et Postgres (Supabase)

-- 1. Table de correspondance slots R307 (évite collision min(999))
CREATE TABLE IF NOT EXISTS biometric_slots (
    id SERIAL PRIMARY KEY,
    id_employe INT NOT NULL UNIQUE,
    device_id VARCHAR(50) NOT NULL DEFAULT 'r307_main',
    slot_number SMALLINT NOT NULL CHECK (slot_number BETWEEN 0 AND 999),
    empreinte_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_device_slot UNIQUE (device_id, slot_number),
    CONSTRAINT fk_slots_employe FOREIGN KEY (id_employe) REFERENCES employes(id_employe) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_slots_device ON biometric_slots(device_id, slot_number);

-- 2. Journal audit immuable (empêche UPDATE/DELETE)
-- MySQL: via trigger ; Postgres: via trigger aussi (créé après)
-- Ajout colonnes manquantes si journal_audit existe déjà
ALTER TABLE journal_audit ADD COLUMN IF NOT EXISTS slot_number SMALLINT;
ALTER TABLE journal_audit ADD COLUMN IF NOT EXISTS score DECIMAL(5,2);
ALTER TABLE journal_audit ADD COLUMN IF NOT EXISTS device_id VARCHAR(50);
ALTER TABLE journal_audit ADD COLUMN IF NOT EXISTS motif TEXT;

-- Trigger immuable (Postgres)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_journal_audit_immutable') THEN
    CREATE OR REPLACE FUNCTION fn_journal_audit_immutable() RETURNS TRIGGER AS $f$
    BEGIN RAISE EXCEPTION 'journal_audit immuable (INSERT only)'; RETURN NULL; END; $f$ LANGUAGE plpgsql;
    CREATE TRIGGER trg_journal_audit_immutable BEFORE UPDATE OR DELETE ON journal_audit FOR EACH ROW EXECUTE FUNCTION fn_journal_audit_immutable();
  END IF;
END $$;
