-- ============================================================
-- 05-security.sql
-- Usuarios y permisos por nodo
-- Ejecutar cada bloque en su servidor correspondiente.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- BLOQUE A: Ejecutar en Bolivia (26.221.13.33)
-- ════════════════════════════════════════════════════════════
USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'superadmin_login')
BEGIN
  CREATE LOGIN superadmin_login WITH PASSWORD = '123456';
END
GO

USE farmaredcorp;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'superadmin_user')
BEGIN
  CREATE USER superadmin_user FOR LOGIN superadmin_login;
END
GO

-- Permisos de lectura y escritura sobre el esquema dbo
GRANT SELECT, INSERT, UPDATE ON SCHEMA::dbo TO superadmin_user;
-- Sin DELETE: el borrado es lógico (activo = 0)
GO


-- ════════════════════════════════════════════════════════════
-- BLOQUE B: Ejecutar en Perú (26.134.31.38)
-- ════════════════════════════════════════════════════════════
-- USE master;
-- GO

-- IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'admin_pe_login')
-- BEGIN
--   CREATE LOGIN admin_pe_login WITH PASSWORD = '123456';
-- END
-- GO

-- USE farmaredcorp;
-- GO

-- IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'admin_pe_user')
-- BEGIN
--   CREATE USER admin_pe_user FOR LOGIN admin_pe_login;
-- END
-- GO

-- GRANT SELECT, INSERT, UPDATE ON SCHEMA::dbo TO admin_pe_user;
-- GO


-- ════════════════════════════════════════════════════════════
-- BLOQUE C: Ejecutar en Chile (26.132.12.209) — PostgreSQL
-- ════════════════════════════════════════════════════════════

-- Ejecutar como postgres:
-- CREATE USER admin_cl WITH PASSWORD 'alvaro1234';
-- GRANT CONNECT ON DATABASE farmaredcorp TO admin_cl;
-- \c farmaredcorp
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO admin_cl;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public
--   GRANT SELECT, INSERT, UPDATE ON TABLES TO admin_cl;
