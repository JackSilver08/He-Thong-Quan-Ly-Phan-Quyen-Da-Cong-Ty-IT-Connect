BEGIN;

INSERT INTO departments(company_id, code, name)
SELECT c.id, 'IT', 'Information Technology' FROM companies c WHERE c.code='IT-CONNECT'
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO departments(company_id, code, name)
SELECT c.id, 'HR', 'Human Resources' FROM companies c WHERE c.code='IT-CONNECT'
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO departments(company_id, code, name)
SELECT c.id, 'PMO', 'Project Management' FROM companies c WHERE c.code='IT-CONNECT'
ON CONFLICT (company_id, code) DO NOTHING;

COMMIT;
