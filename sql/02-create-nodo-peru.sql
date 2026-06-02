-- ============================================================
-- 02-create-nodo-peru.sql
-- Nodo Operativo — Perú — SQL Server
-- CHECK (codigo_pais = 'PE') en todas las tablas fragmentadas.
-- Ejecutar conectado al servidor: 26.134.31.38
-- ============================================================

USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'farmaredcorp')
  CREATE DATABASE farmaredcorp;
GO

USE farmaredcorp;
GO

-- ─── Referencia de país ─────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='pais' AND xtype='U')
CREATE TABLE pais (
  id_pais   INT IDENTITY(1,1) PRIMARY KEY,
  nombre    VARCHAR(100) NOT NULL,
  codigo    CHAR(2)      NOT NULL UNIQUE
);
GO

INSERT INTO pais (nombre, codigo)
SELECT 'Perú', 'PE' WHERE NOT EXISTS (SELECT 1 FROM pais WHERE codigo = 'PE');
GO

-- ─── Usuario (nodo PE) ─────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='usuario' AND xtype='U')
CREATE TABLE usuario (
  id_usuario      VARCHAR(40)  PRIMARY KEY,
  nombre          VARCHAR(100) NOT NULL,
  email           VARCHAR(100) NOT NULL UNIQUE,
  -- Decisión académica: contraseña en texto plano.
  password_plain  VARCHAR(100) NOT NULL,
  rol             VARCHAR(20)  NOT NULL,
  activo          BIT          NOT NULL DEFAULT 1,
  codigo_pais     CHAR(2)      NOT NULL,
  CONSTRAINT chk_usuario_pais_pe CHECK (codigo_pais = 'PE')
);
GO

IF NOT EXISTS (SELECT 1 FROM usuario WHERE id_usuario = 'PE-00000000-0000-0000-0000-000000000001')
  INSERT INTO usuario (id_usuario, nombre, email, password_plain, rol, activo, codigo_pais)
  VALUES ('PE-00000000-0000-0000-0000-000000000001', 'Admin Perú',
          'admin@farma.pe', '123456', 'admin_pe', 1, 'PE');
GO

-- ─── Sucursal (nodo PE) ────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sucursal' AND xtype='U')
CREATE TABLE sucursal (
  id_sucursal VARCHAR(40)  PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  direccion   VARCHAR(200) NOT NULL,
  activo      BIT          NOT NULL DEFAULT 1,
  codigo_pais CHAR(2)      NOT NULL,
  CONSTRAINT chk_sucursal_pais_pe CHECK (codigo_pais = 'PE')
);
GO

-- ─── Medicamento (nodo PE) ─────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='medicamento' AND xtype='U')
CREATE TABLE medicamento (
  id_medicamento VARCHAR(40)  PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL,
  descripcion    VARCHAR(500),
  activo         BIT          NOT NULL DEFAULT 1,
  codigo_pais    CHAR(2)      NOT NULL,
  CONSTRAINT chk_medicamento_pais_pe CHECK (codigo_pais = 'PE')
);
GO

-- ─── Cliente (nodo PE) ─────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='cliente' AND xtype='U')
CREATE TABLE cliente (
  id_cliente  VARCHAR(40)  PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  email       VARCHAR(100),
  telefono    VARCHAR(20),
  activo      BIT          NOT NULL DEFAULT 1,
  codigo_pais CHAR(2)      NOT NULL,
  CONSTRAINT chk_cliente_pais_pe CHECK (codigo_pais = 'PE')
);
GO

-- ─── Empleado (nodo PE) ────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='empleado' AND xtype='U')
CREATE TABLE empleado (
  id_empleado VARCHAR(40)  PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  cargo       VARCHAR(100) NOT NULL,
  id_sucursal VARCHAR(40)  NOT NULL REFERENCES sucursal(id_sucursal),
  activo      BIT          NOT NULL DEFAULT 1,
  codigo_pais CHAR(2)      NOT NULL,
  CONSTRAINT chk_empleado_pais_pe CHECK (codigo_pais = 'PE')
);
GO

-- ─── Stock (nodo PE) ───────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='stock' AND xtype='U')
CREATE TABLE stock (
  id_stock              VARCHAR(40)   PRIMARY KEY,
  id_medicamento        VARCHAR(40)   NOT NULL REFERENCES medicamento(id_medicamento),
  id_sucursal           VARCHAR(40)   NOT NULL REFERENCES sucursal(id_sucursal),
  cantidad              INT           NOT NULL DEFAULT 0,
  precio_usd            DECIMAL(10,2) NOT NULL,
  fecha_actualizacion   DATETIME      NOT NULL DEFAULT GETDATE(),
  codigo_pais           CHAR(2)       NOT NULL,
  CONSTRAINT chk_stock_pais_pe CHECK (codigo_pais = 'PE')
);
GO

-- ─── Venta (nodo PE) — NUNCA SE ELIMINA ───────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='venta' AND xtype='U')
CREATE TABLE venta (
  id_venta          VARCHAR(40)   PRIMARY KEY,
  id_cliente        VARCHAR(40)   NOT NULL REFERENCES cliente(id_cliente),
  id_empleado       VARCHAR(40)   NOT NULL REFERENCES empleado(id_empleado),
  id_sucursal       VARCHAR(40)   NOT NULL REFERENCES sucursal(id_sucursal),
  fecha             DATETIME      NOT NULL DEFAULT GETDATE(),
  monto_total_usd   DECIMAL(10,2) NOT NULL,
  codigo_pais       CHAR(2)       NOT NULL,
  CONSTRAINT chk_venta_pais_pe CHECK (codigo_pais = 'PE')
);
GO

-- ─── Detalle Venta (nodo PE) — NUNCA SE ELIMINA ───────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='detalle_venta' AND xtype='U')
CREATE TABLE detalle_venta (
  id_detalle            VARCHAR(40)   PRIMARY KEY,
  id_venta              VARCHAR(40)   NOT NULL REFERENCES venta(id_venta),
  id_medicamento        VARCHAR(40)   NOT NULL REFERENCES medicamento(id_medicamento),
  cantidad              INT           NOT NULL,
  precio_unitario_usd   DECIMAL(10,2) NOT NULL,
  subtotal_usd          DECIMAL(10,2) NOT NULL,
  codigo_pais           CHAR(2)       NOT NULL,
  CONSTRAINT chk_detalle_pais_pe CHECK (codigo_pais = 'PE')
);
GO

-- ─── Sync Log local (nodo PE) ──────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sync_log' AND xtype='U')
CREATE TABLE sync_log (
  id_log                INT IDENTITY(1,1) PRIMARY KEY,
  tabla                 VARCHAR(50)       NOT NULL,
  operacion             VARCHAR(10)       NOT NULL,
  id_registro           VARCHAR(40)       NOT NULL,
  payload               NVARCHAR(MAX)     NOT NULL,
  codigo_pais           CHAR(2)           NOT NULL,
  estado                VARCHAR(10)       NOT NULL DEFAULT 'PENDIENTE',
  intentos              INT               NOT NULL DEFAULT 0,
  fecha_creacion        DATETIME          NOT NULL DEFAULT GETDATE(),
  fecha_ultimo_intento  DATETIME          NULL,
  error_detalle         NVARCHAR(MAX)     NULL
);
GO
