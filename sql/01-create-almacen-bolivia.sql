-- ============================================================
-- 01-create-almacen-bolivia.sql
-- Almacén Central — Bolivia — SQL Server
-- Sin CHECK de país (recibe PE y CL). Solo superadmin.
-- Ejecutar conectado al servidor: 26.221.13.33
-- ============================================================

USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'farmaredcorp')
  CREATE DATABASE farmaredcorp;
GO

USE farmaredcorp;
GO

-- ─── Tabla de referencia de países ─────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='pais' AND xtype='U')
CREATE TABLE pais (
  id_pais   INT IDENTITY(1,1) PRIMARY KEY,
  nombre    VARCHAR(100) NOT NULL,
  codigo    CHAR(2)      NOT NULL UNIQUE
);
GO

INSERT INTO pais (nombre, codigo)
SELECT 'Bolivia', 'BO' WHERE NOT EXISTS (SELECT 1 FROM pais WHERE codigo = 'BO');
INSERT INTO pais (nombre, codigo)
SELECT 'Perú',    'PE' WHERE NOT EXISTS (SELECT 1 FROM pais WHERE codigo = 'PE');
INSERT INTO pais (nombre, codigo)
SELECT 'Chile',   'CL' WHERE NOT EXISTS (SELECT 1 FROM pais WHERE codigo = 'CL');
GO

-- ─── Usuario (solo superadmin vive aquí) ───────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='usuario' AND xtype='U')
CREATE TABLE usuario (
  id_usuario      VARCHAR(40)  PRIMARY KEY,
  nombre          VARCHAR(100) NOT NULL,
  email           VARCHAR(100) NOT NULL UNIQUE,
  -- Decisión académica: contraseña en texto plano. En producción usar bcrypt.
  password_plain  VARCHAR(100) NOT NULL,
  rol             VARCHAR(20)  NOT NULL,   -- superadmin | admin_pe | admin_cl
  activo          BIT          NOT NULL DEFAULT 1,
  codigo_pais     CHAR(2)      NOT NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM usuario WHERE id_usuario = 'BO-00000000-0000-0000-0000-000000000001')
  INSERT INTO usuario (id_usuario, nombre, email, password_plain, rol, activo, codigo_pais)
  VALUES ('BO-00000000-0000-0000-0000-000000000001', 'Super Admin',
          'superadmin@farma.bo', '123456', 'superadmin', 1, 'BO');
GO

-- ─── Sucursal (sin CHECK de país) ──────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sucursal' AND xtype='U')
CREATE TABLE sucursal (
  id_sucursal VARCHAR(40)  PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  direccion   VARCHAR(200) NOT NULL,
  activo      BIT          NOT NULL DEFAULT 1,
  codigo_pais CHAR(2)      NOT NULL
);
GO

-- ─── Medicamento ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='medicamento' AND xtype='U')
CREATE TABLE medicamento (
  id_medicamento VARCHAR(40)  PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL,
  descripcion    VARCHAR(500),
  activo         BIT          NOT NULL DEFAULT 1,
  codigo_pais    CHAR(2)      NOT NULL
);
GO

-- ─── Cliente ───────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='cliente' AND xtype='U')
CREATE TABLE cliente (
  id_cliente  VARCHAR(40)  PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  email       VARCHAR(100),
  telefono    VARCHAR(20),
  activo      BIT          NOT NULL DEFAULT 1,
  codigo_pais CHAR(2)      NOT NULL
);
GO

-- ─── Empleado ──────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='empleado' AND xtype='U')
CREATE TABLE empleado (
  id_empleado VARCHAR(40)  PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  cargo       VARCHAR(100) NOT NULL,
  id_sucursal VARCHAR(40)  NOT NULL REFERENCES sucursal(id_sucursal),
  activo      BIT          NOT NULL DEFAULT 1,
  codigo_pais CHAR(2)      NOT NULL
);
GO

-- ─── Stock ─────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='stock' AND xtype='U')
CREATE TABLE stock (
  id_stock              VARCHAR(40)   PRIMARY KEY,
  id_medicamento        VARCHAR(40)   NOT NULL REFERENCES medicamento(id_medicamento),
  id_sucursal           VARCHAR(40)   NOT NULL REFERENCES sucursal(id_sucursal),
  cantidad              INT           NOT NULL DEFAULT 0,
  precio_usd            DECIMAL(10,2) NOT NULL,
  fecha_actualizacion   DATETIME      NOT NULL DEFAULT GETDATE(),
  codigo_pais           CHAR(2)       NOT NULL
);
GO

-- ─── Venta (NUNCA se elimina física ni lógicamente) ────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='venta' AND xtype='U')
CREATE TABLE venta (
  id_venta          VARCHAR(40)   PRIMARY KEY,
  id_cliente        VARCHAR(40)   NOT NULL REFERENCES cliente(id_cliente),
  id_empleado       VARCHAR(40)   NOT NULL REFERENCES empleado(id_empleado),
  id_sucursal       VARCHAR(40)   NOT NULL REFERENCES sucursal(id_sucursal),
  fecha             DATETIME      NOT NULL DEFAULT GETDATE(),
  monto_total_usd   DECIMAL(10,2) NOT NULL,
  codigo_pais       CHAR(2)       NOT NULL
);
GO

-- ─── Detalle Venta (NUNCA se elimina) ──────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='detalle_venta' AND xtype='U')
CREATE TABLE detalle_venta (
  id_detalle            VARCHAR(40)   PRIMARY KEY,
  id_venta              VARCHAR(40)   NOT NULL REFERENCES venta(id_venta),
  id_medicamento        VARCHAR(40)   NOT NULL REFERENCES medicamento(id_medicamento),
  cantidad              INT           NOT NULL,
  precio_unitario_usd   DECIMAL(10,2) NOT NULL,
  subtotal_usd          DECIMAL(10,2) NOT NULL,
  codigo_pais           CHAR(2)       NOT NULL
);
GO

-- ─── Sync Log (tabla de recuperación de sincronización) ────────────────────
-- Registra operaciones que fallaron al sincronizar al almacén central.
-- El job de reintento procesa entradas con estado = 'PENDIENTE' y intentos < 5.
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sync_log' AND xtype='U')
CREATE TABLE sync_log (
  id_log                INT IDENTITY(1,1) PRIMARY KEY,
  tabla                 VARCHAR(50)       NOT NULL,
  operacion             VARCHAR(10)       NOT NULL,  -- INSERT | UPDATE | DELETE
  id_registro           VARCHAR(40)       NOT NULL,
  payload               NVARCHAR(MAX)     NOT NULL,  -- JSON del registro
  codigo_pais           CHAR(2)           NOT NULL,
  estado                VARCHAR(10)       NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE | OK | ERROR
  intentos              INT               NOT NULL DEFAULT 0,
  fecha_creacion        DATETIME          NOT NULL DEFAULT GETDATE(),
  fecha_ultimo_intento  DATETIME          NULL,
  error_detalle         NVARCHAR(MAX)     NULL
);
GO
