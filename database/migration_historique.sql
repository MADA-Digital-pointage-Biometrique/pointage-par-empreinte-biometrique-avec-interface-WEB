-- Archivage quotidien pointages -> historique (exécuté à 00:00)
CREATE TABLE IF NOT EXISTS historique_pointages (
  LIKE pointages INCLUDING ALL
);
ALTER TABLE historique_pointages ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW();

-- Fonction d'archivage : déplace les pointages d'hier et avant
CREATE OR REPLACE FUNCTION archive_pointages()
RETURNS INTEGER AS $$
DECLARE
  moved INTEGER;
BEGIN
  INSERT INTO historique_pointages
  SELECT *, NOW() FROM pointages
  WHERE date_heure::date < CURRENT_DATE;

  GET DIAGNOSTICS moved = ROW_COUNT;
  DELETE FROM pointages WHERE date_heure::date < CURRENT_DATE;
  RETURN moved;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;