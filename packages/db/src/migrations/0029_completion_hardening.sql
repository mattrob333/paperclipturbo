-- Migration 0029: Completion hardening
-- Adds provisioning_mode and runtime_mode to provisioning_jobs
-- Adds agent uniqueness constraint (company_id, name)
-- Adds company name uniqueness constraint

-- 1. New columns on provisioning_jobs
ALTER TABLE provisioning_jobs
  ADD COLUMN provisioning_mode text NOT NULL DEFAULT 'cold_start';

ALTER TABLE provisioning_jobs
  ADD COLUMN runtime_mode text NOT NULL DEFAULT 'shared';

-- 2. Deduplicate agents before adding unique constraint
-- Keep the earliest agent when duplicates exist (by company_id + name)
DELETE FROM agents a1
  USING agents a2
  WHERE a1.company_id = a2.company_id
    AND a1.name = a2.name
    AND a1.created_at > a2.created_at;

-- 3. Add agent uniqueness constraint
CREATE UNIQUE INDEX agents_company_name_uniq ON agents(company_id, name);

-- 4. Deduplicate companies before adding unique constraint
-- Append UUID prefix to duplicate names (keep earliest unchanged)
UPDATE companies
  SET name = name || ' (' || substring(id::text, 1, 8) || ')'
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at) as rn
      FROM companies
    ) t WHERE rn > 1
  );

-- 5. Add company name uniqueness constraint
CREATE UNIQUE INDEX companies_name_uniq ON companies(name);
