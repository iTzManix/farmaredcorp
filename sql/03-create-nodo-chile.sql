-- ============================================================
-- 03-create-nodo-chile.sql
-- Nodo Operativo — Chile — PostgreSQL
-- CHECK (codigo_pais = 'CL') en todas las tablas fragmentadas.
-- Ejecutar conectado al servidor: 26.132.12.209
-- Primero crear la base: CREATE DATABASE farmaredcorp;
-- Luego conectar: \c farmaredcorp
-- ============================================================

-- ─── Referencia de país ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pais (
  id_pais   SERIAL       PRIMARY KEY,
  nombre    VARCHAR(100) NOT NULL,
  codigo    CHAR(2)      NOT NULL UNIQUE
);

INSERT INTO pais (nombre, codigo)
VALUES ('Chile', 'CL')
ON CONFLICT (codigo) DO NOTHING;

-- ─── Usuario (nodo CL) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuario (
  id_usuario      VARCHAR(40)  PRIMARY KEY,
  nombre          VARCHAR(100) NOT NULL,
  email           VARCHAR(100) NOT NULL UNIQUE,
  -- Decisión académica: contraseña en texto plano.
  password_plain  VARCHAR(100) NOT NULL,
  rol             VARCHAR(20)  NOT NULL,
  activo          BOOLEAN      NOT NULL DEFAULT TRUE,
  codigo_pais     CHAR(2)      NOT NULL,
  CONSTRAINT chk_usuario_pais_cl CHECK (codigo_pais = 'CL')
);

INSERT INTO usuario (id_usuario, nombre, email, password_plain, rol, activo, codigo_pais)
VALUES ('CL-00000000-0000-0000-0000-000000000001', 'Admin Chile',
        'admin@farma.cl', '123456', 'admin_cl', TRUE, 'CL')
ON CONFLICT (id_usuario) DO NOTHING;

-- ─── Sucursal (nodo CL) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sucursal (
  id_sucursal VARCHAR(40)  PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  direccion   VARCHAR(200) NOT NULL,
  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  codigo_pais CHAR(2)      NOT NULL,
  CONSTRAINT chk_sucursal_pais_cl CHECK (codigo_pais = 'CL')
);

-- ─── Medicamento (nodo CL) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medicamento (
  id_medicamento VARCHAR(40)  PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL,
  descripcion    VARCHAR(500),
  activo         BOOLEAN      NOT NULL DEFAULT TRUE,
  codigo_pais    CHAR(2)      NOT NULL,
  CONSTRAINT chk_medicamento_pais_cl CHECK (codigo_pais = 'CL')
);

-- ─── Cliente (nodo CL) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cliente (
  id_cliente  VARCHAR(40)  PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  email       VARCHAR(100),
  telefono    VARCHAR(20),
  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  codigo_pais CHAR(2)      NOT NULL,
  CONSTRAINT chk_cliente_pais_cl CHECK (codigo_pais = 'CL')
);

-- ─── Empleado (nodo CL) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empleado (
  id_empleado VARCHAR(40)  PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  cargo       VARCHAR(100) NOT NULL,
  id_sucursal VARCHAR(40)  NOT NULL REFERENCES sucursal(id_sucursal),
  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  codigo_pais CHAR(2)      NOT NULL,
  CONSTRAINT chk_empleado_pais_cl CHECK (codigo_pais = 'CL')
);

-- ─── Stock (nodo CL) ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock (
  id_stock              VARCHAR(40)   PRIMARY KEY,
  id_medicamento        VARCHAR(40)   NOT NULL REFERENCES medicamento(id_medicamento),
  id_sucursal           VARCHAR(40)   NOT NULL REFERENCES sucursal(id_sucursal),
  cantidad              INT           NOT NULL DEFAULT 0,
  precio_usd            NUMERIC(10,2) NOT NULL,
  fecha_actualizacion   TIMESTAMP     NOT NULL DEFAULT NOW(),
  codigo_pais           CHAR(2)       NOT NULL,
  CONSTRAINT chk_stock_pais_cl CHECK (codigo_pais = 'CL')
);

-- ─── Venta (nodo CL) — NUNCA SE ELIMINA ───────────────────────────────────
CREATE TABLE IF NOT EXISTS venta (
  id_venta          VARCHAR(40)   PRIMARY KEY,
  id_cliente        VARCHAR(40)   NOT NULL REFERENCES cliente(id_cliente),
  id_empleado       VARCHAR(40)   NOT NULL REFERENCES empleado(id_empleado),
  id_sucursal       VARCHAR(40)   NOT NULL REFERENCES sucursal(id_sucursal),
  fecha             TIMESTAMP     NOT NULL DEFAULT NOW(),
  monto_total_usd   NUMERIC(10,2) NOT NULL,
  codigo_pais       CHAR(2)       NOT NULL,
  CONSTRAINT chk_venta_pais_cl CHECK (codigo_pais = 'CL')
);

-- ─── Detalle Venta (nodo CL) — NUNCA SE ELIMINA ───────────────────────────
CREATE TABLE IF NOT EXISTS detalle_venta (
  id_detalle            VARCHAR(40)   PRIMARY KEY,
  id_venta              VARCHAR(40)   NOT NULL REFERENCES venta(id_venta),
  id_medicamento        VARCHAR(40)   NOT NULL REFERENCES medicamento(id_medicamento),
  cantidad              INT           NOT NULL,
  precio_unitario_usd   NUMERIC(10,2) NOT NULL,
  subtotal_usd          NUMERIC(10,2) NOT NULL,
  codigo_pais           CHAR(2)       NOT NULL,
  CONSTRAINT chk_detalle_pais_cl CHECK (codigo_pais = 'CL')
);

-- ─── Sync Log local (nodo CL) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_log (
  id_log                SERIAL       PRIMARY KEY,
  tabla                 VARCHAR(50)  NOT NULL,
  operacion             VARCHAR(10)  NOT NULL,
  id_registro           VARCHAR(40)  NOT NULL,
  payload               TEXT         NOT NULL,
  codigo_pais           CHAR(2)      NOT NULL,
  estado                VARCHAR(10)  NOT NULL DEFAULT 'PENDIENTE',
  intentos              INT          NOT NULL DEFAULT 0,
  fecha_creacion        TIMESTAMP    NOT NULL DEFAULT NOW(),
  fecha_ultimo_intento  TIMESTAMP    NULL,
  error_detalle         TEXT         NULL
);
