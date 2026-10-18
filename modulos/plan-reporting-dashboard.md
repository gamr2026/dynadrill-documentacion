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

## Estándar de calidad: base de datos y backend (obligatorio, revisión del 17/10/2026)

El usuario revisa primero la base de datos. Antes de dar un tramo por terminado, verifique cada punto y déjelo anotado en su plan:

1. **Sin datos duplicados.** Un dato vive en un solo lugar y se consulta con JOIN. Si por estar en otro contenedor (D1) debe guardar una referencia, guarde solo el id; si además necesita un texto copiado (código, nombre), justifíquelo por escrito en el plan y en un COMMENT de la columna, y manténgalo actualizado por evento.
2. **Ningún id sin FK dentro del mismo servidor.** Un id polimórfico sin FK no se acepta: use una columna con FK por cada origen y un CHECK de que solo una esté llena, o una tabla puente. Los ids sin FK solo se admiten entre contenedores distintos y con COMMENT que lo diga.
3. **Catálogos de verdad.** Valores que el negocio cambia o amplía son tabla con id uuid, código único y FK; valores fijos del sistema son enum de PostgreSQL. Nada de texto libre donde hay un conjunto conocido (tallas, lugares, categorías por nombre). No decida comportamiento comparando textos de nombres en migraciones ni en código: use una columna o un código estable.
4. **Integridad en la base, no solo en el servicio.** CHECK de coherencia entre columnas, FK compuestas cuando un dato depende de dos tablas, índices únicos parciales para reglas como una vigente por clave, NOT NULL donde corresponde. Si una regla solo la valida el servicio, pregúntese si la base puede garantizarla.
5. **Historia inmutable.** Kardex, lecturas, historiales y registros firmados: sin UPDATE y sin DELETE para el rol de la aplicación (REVOKE en la migración); los errores se corrigen con un registro nuevo.
6. **Auditoría uniforme.** `created_at/created_by/updated_at/updated_by` con FK a `identidad.usuario` en toda tabla editable.
7. **Permisos mínimos.** GRANT SELECT por columnas y solo lo necesario sobre tablas de otros schemas; justifique en un comentario cada dato personal que lea (por ejemplo, cédula).
8. **Una migración por cambio, reversible por otra migración, sin editar migraciones ya aplicadas.** Los datos sembrados van en la semilla (idempotente), no en la migración, salvo catálogos mínimos del sistema.
9. **Backend limpio.** Servicios pequeños con una responsabilidad, DTO validados con class-validator, errores con mensajes claros en español neutro con "usted", transacciones para todo lo que cambia varias tablas, eventos publicados por el outbox dentro de esa misma transacción, consumidores idempotentes, sin `any`, sin copiar y pegar entre módulos, comentarios que explican el porqué.
10. **Pruebas de integración con base real** que ejerciten también las reglas de la base (CHECK, FK, REVOKE): una prueba que intente violarlas y espere el rechazo.
11. **Pule lo ya entregado.** Antes de avanzar a un tramo nuevo, revise lo que ya construyó contra esta lista y corrija con una migración nueva. Los hallazgos concretos de su módulo están en la sección siguiente.

## 8. Encargo de la sesión (18/10/2026)

**Estado:** sin construir. Hoy hay **eventos estables suficientes para R1 y para parte de R2**; empiece por ahí y agregue proyecciones a medida que los demás módulos publiquen.

**Eventos que ya existen** (confirme el detalle en `02-CONTRATOS-ENTRE-MODULOS.md` y en el registro): `comercial.pedido.*` (abierto, actualizado, estados), `comercial.documento_operativo.corregido`, `comercial.cambio_items.resultado`; `operaciones.pumping.*` (ticket creado, paso cambiado, asignación realizada, reporte de unidad de llegada, reporte diario completado, cambio de ítems aprobado, cerrado); `operaciones.inventario.*` (salida, devolución, consumo, movimiento); `operaciones.mantenimiento.*` (reporte recibido o descartado, orden creada, sub-órdenes, cierre, retorno); `qhse.epi.*`. Flota, FCR y el resto de QHSE publicarán los suyos en sus propias sesiones.

**Orden de trabajo:** R1 contenedor `worker` (`apps/worker`, `libs/worker/reporting`, schema `reporting`, `app_worker`, `dyn_lectura`) con pedidos por estado y tickets activos; R2 KPI de Mantenimiento (las fórmulas de MAN-MASTER-001 siguen **sin confirmar**: pídalas por `documentacion/mantenimiento/CONSULTAS-PARA-DYNADRILL.md`, sección Mantenimiento, y hasta tenerlas deje la proyección con los conteos y tiempos que sí son inequívocos), stock bajo y vencimientos; R3 tareas programadas y pantallas. El dashboard del frontend (`features/dashboard`) y la página de KPI de Mantenimiento pasan a leer `/api/reporting` con el patrón adaptador.

**Regla del bus:** el worker consume eventos de varios orígenes; ya hay otros consumidores en otros contenedores, pero dentro del suyo use un `group` propio por cada origen que tenga más de un consumidor (sección 9 de `01-REGLAS-DE-COORDINACION.md`). **Cambios globales** (nuevo contenedor, `levantar-local.ps1`, gateway, `tsconfig.base.json`, permisos): regla 6, avise a la sesión principal. Commit con `scripts/commit-modulo.ps1 -Modulo reporting`.
