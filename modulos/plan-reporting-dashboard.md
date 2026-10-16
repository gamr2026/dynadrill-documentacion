# Plan: Reportería y Dashboard

**Schema:** `reporting` · **Contenedor:** **worker (nuevo)** · **Librería:** `libs/worker/reporting` · **Prefijo:** `/api/reporting`
**Estado:** por construir · **Ola:** 3 (necesita eventos estables de los demás módulos)
**Lea antes:** `00`, `01`, `02` (4.8), `03` (D7).

## 1. Objetivo

Alimentar el **dashboard** y los **indicadores (KPI)** con **proyecciones de lectura** que escribe un *worker* a partir de los eventos de negocio; las pantallas no consultan los schemas operativos. Infraestructura ya prevista: schema `reporting`, usuario `app_worker` (lee y escribe `reporting` y `msg_worker`) y usuario **`dyn_lectura`** (solo `SELECT` en `reporting`).

## 2. Qué hay en la demo

- `features/dashboard` (≈ 370 líneas): tarjetas KPI por módulo y por rol (pedidos por estado, **unidades con alertas de mantenimiento** y vencidas, **incidentes QHSE abiertos**, **inspecciones pendientes**, **artículos en inventario**, **tickets de operación activos**), con donuts. Hoy lee los datos llamando a cada módulo.
- `features/maintenance/pages/maintenance-kpis-page` (KPI de Mantenimiento MAN-MASTER-001).
- Dashboard HSE (HSE-MASTER-001): TRIR, LTIR, días sin LTI, ratio *Near Miss*:incidente, % PTW a tiempo, desechos kg/mes y semáforo de cumplimiento por sitio/PTW.

## 3. Diseño propuesto

- **Contenedor `worker`**: copia de `apps/operaciones` (sin controladores operativos), con RabbitMQ (suscripción a eventos) y una API de lectura mínima. Crear `apps/worker` y anotarlo en el registro (D7).
- **Proyecciones** (tablas `reporting.*`, por ejemplo `pedidos_por_estado`, `tickets_activos`, `kpi_mantenimiento_mensual`, `kpi_hse_mensual`, `stock_bajo`): se actualizan al consumir cada evento (idempotente, con `handleOnce`) y por tareas programadas (vencimientos: ART, permisos de conductores, preventivos).
- Todo con columnas tipadas y FK a catálogos (sin JSON); los nombres salen del JOIN con las maestras (`dyn_lectura` y `app_worker` necesitan `SELECT` en lo que usen).
- **Contrato**: cada módulo publica un evento por hecho relevante, **estable y con ids**. Este plan **no** le pide a ningún módulo que cambie: lo que falte se pide por el registro. El inventario de eventos disponibles está en `02-CONTRATOS-ENTRE-MODULOS.md` (sección 2 y las que cada módulo agregue).
- El dashboard del frontend pasa a leer `/api/reporting/...` (con `dyn_lectura` si se publica como solo lectura).

## 4. Tramos

1. **R1 — Contenedor worker y primeras proyecciones** (pedidos por estado, tickets activos) con los eventos ya existentes.
2. **R2 — KPI por módulo** a medida que los módulos publiquen sus eventos (Mantenimiento, QHSE, Inventario, Flota).
3. **R3 — Tareas programadas** (vencimientos y alertas) y pantallas de KPI.

## 5. Pruebas

Un evento actualiza la proyección una sola vez (idempotencia); reconstrucción de una proyección desde cero a partir de los eventos auditados; permisos de `dyn_lectura`.

## 6. Dependencias y choques

Depende de **Auditoría** (A1) si la reconstrucción se hace desde `auditoria`. Puntos de choque: gateway (prefijo `/api/reporting`), `levantar-local.ps1`, `package.json`, `tsconfig.base.json`, permisos (bloque `reporting`).

## 7. Consultas

Fórmulas de los KPI (TRIR, LTIR, disponibilidad, tiempos de respuesta): preguntarlas a cada área en su documento de consultas; este plan las recibe de los módulos.
