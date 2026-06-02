-- ============================================================
-- 04-linked-servers.sql
-- Linked Servers en el almacén central Bolivia
-- Ejecutar conectado al servidor Bolivia: 26.221.13.33
-- Permite al superadmin hacer OPENQUERY hacia PE y CL.
-- ============================================================

USE master;
GO

-- ─── Linked Server → Nodo Perú (SQL Server) ───────────────────────────────
IF EXISTS (SELECT 1 FROM sys.servers WHERE name = 'FARMACIA_NODO_PERU')
  EXEC sp_dropserver 'FARMACIA_NODO_PERU', 'droplogins';
GO

EXEC sp_addlinkedserver
  @server     = 'FARMACIA_NODO_PERU',
  @srvproduct = '',
  @provider   = 'SQLNCLI',
  @datasrc    = '26.134.31.38,1433';
GO

EXEC sp_addlinkedsrvlogin
  @rmtsrvname  = 'FARMACIA_NODO_PERU',
  @useself     = 'FALSE',
  @locallogin  = NULL,
  @rmtuser     = 'sa',
  @rmtpassword = '123456';
GO

-- Verificar conexión
-- SELECT * FROM OPENQUERY(FARMACIA_NODO_PERU, 'SELECT TOP 5 * FROM farmaredcorp.dbo.cliente')
GO

-- ─── Linked Server → Nodo Chile (PostgreSQL via ODBC) ─────────────────────
-- REQUISITO: Instalar driver "PostgreSQL ODBC Driver (Unicode)" en el servidor Bolivia.
-- Descargar desde: https://www.postgresql.org/ftp/odbc/versions/msi/
IF EXISTS (SELECT 1 FROM sys.servers WHERE name = 'FARMACIA_NODO_CHILE')
  EXEC sp_dropserver 'FARMACIA_NODO_CHILE', 'droplogins';
GO

EXEC sp_addlinkedserver
  @server     = 'FARMACIA_NODO_CHILE',
  @srvproduct = 'PostgreSQL',
  @provider   = 'MSDASQL',
  @provstr    = 'DRIVER={PostgreSQL Unicode};SERVER=26.132.12.209;PORT=5432;DATABASE=farmaredcorp;UID=postgres;PWD=alvaro1234;';
GO

EXEC sp_addlinkedsrvlogin
  @rmtsrvname  = 'FARMACIA_NODO_CHILE',
  @useself     = 'FALSE',
  @locallogin  = NULL,
  @rmtuser     = 'postgres',
  @rmtpassword = 'alvaro1234';
GO

-- Verificar conexión (el nombre de tabla en OPENQUERY va sin esquema para pg)
-- SELECT * FROM OPENQUERY(FARMACIA_NODO_CHILE, 'SELECT * FROM cliente LIMIT 5')
GO

-- ─── Opciones de servidor (habilitar RPC para consultas distribuidas) ──────
EXEC sp_serveroption 'FARMACIA_NODO_PERU',  'rpc out', 'true';
EXEC sp_serveroption 'FARMACIA_NODO_PERU',  'data access', 'true';
EXEC sp_serveroption 'FARMACIA_NODO_CHILE', 'rpc out', 'true';
EXEC sp_serveroption 'FARMACIA_NODO_CHILE', 'data access', 'true';
GO
