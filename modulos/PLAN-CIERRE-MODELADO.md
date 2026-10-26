# Plan de cierre del modelado y la normalización frente a la demo

> Creado el 26/10/2026. Objetivo: que **todo lo que la demo (`main` de `dynadrill-backend` y `dynadrill-frontend`, commits `ec6bbe2` y `74ca851`) guarda o calcula tenga su lugar en la base nueva**, normalizado según `PENDIENTES-DE-MIGRACION.md` §0.1, y que lo transitorio quede retirado. Complementa a `PENDIENTES-DE-MIGRACION.md` (inventario) y a `plan-corte-de-la-demo.md` (corte del gateway).
> Marque cada tarea con `[x]`, fecha y commit al terminarla.

## 0. Dónde estamos (26/10/2026)

- **Modelos de la demo:** 56. Tienen tablas normalizadas 53. Falta `DashboardMetas`. `PedidoPendienteAs2` no se migra (era una cola simulada; la reemplaza la consulta a AS2 de `integraciones`) y `QhseChecklistEquipo` tampoco (lo reemplaza la inspección de vehículos de Flota).
- **Hallazgo que define este plan:** 37 de los 56 modelos de la demo guardan todo en una columna JSON (`payload`). Sus campos y reglas reales **solo están en las interfaces TypeScript del frontend de la demo** (`src/app/features/**/models/*.model.ts`) y en sus servicios. Que exista la tabla no prueba la paridad: hay que comparar **campo por campo** contra esos modelos.
- **Base nueva:** sin columnas JSON salvo en `integraciones` (configuración de las conexiones con AS2: cabeceras, cuerpos, secretos). Es una excepción aceptada y hay que justificarla en el registro. Columnas `legacy_id` (puente con la demo) en 9 tablas: `identidad.rol`, `identidad.usuario`, `catalogos.{cliente, persona_contacto, bloque, campo, pozo, taladro}`, `comercial.lista_precios`.
- **Código:** S1 a S4 están fusionadas en `integracion/sesiones` (54 commits), que **todavía no está en `desarrollo` ni en GitHub**. La base local ya tiene sus migraciones y quedó limpia el 26/10 (sin datos operativos ni de prueba; respaldo `respaldo-bd-dynadrill-20261026-antes-de-limpiar.dump`).

## 1. Fase A — Higiene previa (antes de modelar nada nuevo)

- [x] **A1 (26/10/2026, `desarrollo` en `e98c46e`, subido).** Lint y build de los 25 proyectos en verde; pruebas de integración en verde corridas en serie contra `dynadrill_test` (las 7 fallas de la corrida en paralelo eran de carga, de un conteo frágil de roles y de la mensajería compartida: corregidas). Frontend `diseno/facturacion-demo` subido a `respaldo`. Pendiente de A1: B11 (gateway con `curl` autenticado). **Texto original:** Fusionar `integracion/sesiones` en `desarrollo` con la verificación pendiente de `PLAN-SESIONES-PARALELAS.md` §7: migraciones sobre base vacía, `nx run-many -t lint test build` y B11 (gateway con `curl` autenticado). Subir a `origin`. Incluir la rama `diseno/facturacion-demo` cuando esté revisada.
- [x] **A2 (26/10/2026).** `dynadrill_test`, `npm run db:test:preparar` y la protección en `tools/jest/base-de-pruebas.cjs`; regla en `01-REGLAS` §4.1. Comprobado: la suite de pedidos (35) pasa en la base de pruebas y la del portal no cambia. **Texto original:** Base aparte para las pruebas de integración. Hoy las pruebas corren contra la base que usa el portal y dejan basura: con los servicios encendidos su limpieza falla y llegaron a adelantar la secuencia PEC- hasta 900058. Crear `dynadrill_test` (mismo Postgres), aplicar las migraciones con `prisma migrate deploy`, y que `RUN_INTEGRATION=1` exija una `DATABASE_URL` que termine en `_test` (si no, la prueba se niega a correr). Documentarlo en `01-REGLAS-DE-COORDINACION.md`.
- [x] **A3 (26/10/2026)**, en `PENDIENTES-DE-MIGRACION.md`. **Texto original:** Poner al día la documentación: FCR ya envía la cantidad por día a Comercial (`paraEnvio`); AS2 ya responde desde el portal (la lista blanca de FortiGuard dejó de bloquear); la limpieza del 26/10 y las secuencias reales (PEC 4708, PRC 4589 por confirmar con AS2, guía 11035, OT 947).

## 2. Fase B — Auditoría de paridad campo por campo

**Terminada el 26/10/2026**: 5 grupos revisados, 15 huecos (ver C2; FL-2 se descartó: los pasajeros quedan como texto abierto) más las metas del tablero HSE, que ya estaban en C1. Producto: `documentacion/modulos/PARIDAD-MODELO-DEMO.md`, una tabla por módulo con **cada campo y cada regla de la demo** y dónde vive en la base nueva.

| Clasificación | Qué significa | Qué se hace |
|---|---|---|
| **OK** | El campo o la regla existe y está normalizado | Nada |
| **Falta** | La demo lo guarda o lo exige y la base nueva no | Migración (fase C) |
| **Texto libre** | En la base nueva es texto donde hay un conjunto conocido | Catálogo con id y FK, o enum |
| **Regla solo en servicio** | La regla no está en la base (CHECK, FK, único, trigger) | Agregarla a la base con su prueba |
| **Descartado** | La demo lo tenía y el negocio lo retiró (con la decisión que lo respalda) | Solo documentarlo |

Fuentes por módulo: los modelos TS de la demo, sus servicios del frontend (reglas que la demo aplica en el cliente) y los controladores y DTO del backend de la demo. Orden: primero los 37 modelos con `payload` (los de mayor riesgo), agrupados así:

| Grupo | Modelos de la demo con `payload` |
|---|---|
| Comercial | Pedido, Prefactura, Aot, GuiaRemision, ListaPrecios, DocumentoOperativo |
| Operaciones | PumpingTicket, PumpingDocumento, SolicitudCambioItems, FcrTicket, FcrToolInspection, ConfiguracionCodigoFcr |
| Flota y Mantenimiento | Unidad, VehicleInspection, ConductorPermisos, GerenciamientoViaje, UnitReport, MaintenanceOrder, SubOrder, HistorialMantenimiento |
| Inventario | MovimientoInventario, ArticuloParte |
| QHSE | Ptw, SwaEvento, StopCard, Iperc, EntregaEpi, InspeccionEquipo, Desecho, DerrameEvento, EmergenciaEvento, Investigacion, DocumentoLegalQhse, ObjetivoAmbiental, AspectoAmbiental, DashboardMetas |

Puede repartirse en paralelo (una sesión o agente por grupo, solo lectura). Cada grupo termina con su lista de huecos, que alimenta la fase C. **Criterio de cierre:** ningún campo de la demo sin clasificar.

## 3. Fase C — Modelar lo que falta

Cada tarea es una rebanada completa: migración, semilla, API, permisos, eventos, plantillas de aviso si aplica, pruebas de integración que intentan romper las reglas de la base (en la base de pruebas de A2), y la entrada en `REGISTRO-DE-CAMBIOS-COMPARTIDOS.md`.

**C1. Ya conocidas, sin dependencias externas:**

- [ ] **Metas del tablero HSE (`DashboardMetas`).** En la demo es un JSON `{indicador: meta}`. Modelo nuevo en `qhse`: catálogo `kpi_indicador` (código, categoría, unidad, dirección mayor/menor es mejor, disponible y motivo si no lo está; sembrado con los 16 de HSE-MASTER-001) y `kpi_meta` (indicador por FK, valor, vigente desde, quién; historial inmutable: una meta nueva reemplaza a la anterior). API `GET/PUT /api/v2/qhse/kpi/metas`.
- [ ] **Firmas adoptadas por los módulos (A3 de `plan-firmas-y-auditoria.md`).** Hoy solo PTW y Desechos publican `*.firmado`. Faltan IPERC, STOP, SWA, Entrega de EPI e Inspección de FCR (ya están en el catálogo de Firmas): publicar el evento y retirar con migración las firmas «de una línea» que cada módulo guarda.
- [ ] **Aviso automático del límite de desechos.** Sumarlo al emisor horario `AvisosProgramadosService` (hoy solo con `POST desechos/avisos/revisar`).
- [ ] **Hojas imprimibles de Mantenimiento** (DYN-MNT-RE-008, orden general y operativa): exponer los datos que pide cada hoja desde el backend nuevo.
- [ ] **Retirar el permiso `comercial.cierre.gestionar`:** permitir en `libs/shared/authz` un permiso «retirado sin reemplazo».

**C2. Las que salieron de la fase B** (detalle y propuesta de cada una en `PARIDAD-MODELO-DEMO.md`; fase B terminada el 26/10/2026):

- [ ] CM-5 Despacho a bodega completo (ítems, bodega, fecha requerida, notas, rechazo)
- [ ] CM-4 / OP-6 Unidades por catálogo del portal con FK obligatoria (seis tablas de Comercial y cuatro de Operaciones; sin equivalencias con AS2: allí la única unidad es «Dynadrill»)
- [ ] CM-2 Rechazo de la prefactura (ítems observados, persona, seguimiento)
- [ ] CM-3 Horas como `time` en documentos operativos y guía
- [ ] CM-1 Descripción del documento adjunto al pedido
- [ ] OP-1 Reporte de herramientas de Pumping como el de FCR (desde lo cotizado, distribuido por día; sin selección ni inspecciones; sin kardex)
- [ ] OP-2 Quién corrigió el día de la bitácora de FCR
- [ ] OP-3 Company Man precargado en el joblog (Reporte Diario) por FK al contacto
- [ ] OP-4 / FL-3 Origen y destino por FK a bodega o pozo (reporte de unidad e inspección de vehículo)
- [ ] OP-5 `tipo_ot` de Pumping como enum
- [ ] FL-4 Permiso del umbral de riesgo con FK
- [ ] FL-1 Firmas del viaje (con la adopción de Firmas)
- [ ] QH-1 Catálogo de equipos inspeccionados

- [ ] **Reporte Diario de Pumping completo (D-PD):** `reporte_diario_adjunto` (FK a `archivos.archivo`) y firmas del supervisor y del cliente por `plataforma/firmas`.

**C3. Indicadores (Reportería y Dashboard), por resúmenes de cada módulo (D-R).** El tablero general de la demo lee 14 servicios y el HSE calcula 16 indicadores: cada módulo dueño expone su `resumen` y el frontend los combina. Datos que no existen en ningún módulo, igual que en la demo: horas-hombre (TRIR, LTIR), nómina (participación STOP) y capacitación; quedan como «no disponible», como en la demo.

## 4. Fase D — Retirar lo transitorio (al cortar cada módulo)

- [ ] Puentes `manual_temporal` de requisitos que ya tienen su evento real (Flota, QHSE).
- [ ] Catálogo de la demo `/api/catalogos` (ids numéricos) cuando el frontend use solo `/api/v2/catalogos`.
- [ ] Columnas `legacy_id` de las 9 tablas y `LEGACY_JWT_SECRET` del gateway, con migración, cuando ningún prefijo caiga ya en la demo (`plan-corte-de-la-demo.md` §3).

## 5. Orden y relación con el diseño del frontend

1. Fase A completa (A1 y A2 son condición para todo lo demás).
2. Fase B por grupos, empezando por **Comercial**: es el módulo cuyo diseño se está alineando con la demo (rama `diseno/facturacion-demo`), y cada pantalla adaptada revela campos que faltan.
3. Fase C por módulo, en el mismo orden en que se alinea el diseño: Facturación → Pumping → FCR → QHSE → Flota y Mantenimiento → Inventario. Un módulo se da por cerrado cuando su paridad está en OK, su pantalla es igual a la demo (escritorio y móvil) y su prefijo se cortó en el gateway.
4. C3 después de que QHSE y Mantenimiento estén cerrados, porque sus indicadores leen esas tablas.
5. Fase D al final de cada corte.

## 6. Decisiones y consultas abiertas

**Resueltas el 26/10/2026** (el usuario delegó la decisión con el criterio «que quede bien hecho a nivel de base de datos»):

| # | Decisión |
|---|---|
| D-R | **Indicadores por resúmenes de cada módulo.** Cada dueño calcula sus indicadores con consultas sobre sus propias tablas normalizadas (una sola fuente de verdad, sin copias), en un endpoint `resumen` como los de Desechos, Derrames y Emergencias. Sin `worker/reporting` mientras ninguna consulta lo justifique por rendimiento; si un día hace falta, se agregan vistas materializadas dentro del propio esquema antes que copiar datos a otro. |
| D-PD | **El Reporte Diario de Pumping conserva todo lo de la demo, normalizado:** la hoja «Tablas» ya son filas (`reporte_diario_tabla*`); la plantilla Excel DYN-SGI-RE-047 es solo importación y exportación en el frontend sobre esas tablas (sin columnas nuevas); el monitoreo por día ya existe; el adjunto va como `reporte_diario_adjunto` con FK a `archivos.archivo`; las firmas dibujadas del supervisor y del cliente se registran en `plataforma/firmas` (evento `operaciones.pumping.reporte_diario.firmado`, firma manuscrita con su archivo e integridad), no como imagen suelta en el reporte. |
| D-CP | Los 6 permisos de conductor eran de la cuenta `conductor.prueba` (sin archivo, fechas redondas): **se borraron** el 26/10 (están en el respaldo del día). |

| # | Qué | Quién | Bloquea |
|---|---|---|---|
| D-PRC | Último número real de la secuencia PRC- en AS2 (quedó en 4589) | Dynadrill / AS2 | Emisión de prefacturas |
| — | Umbrales de derrames; plazos de QHSE (ART, legales, investigación); fórmulas KPI de MAN-MASTER-001; IN1–IN8 de Inventario; R5, R6 y G6–G8 de Facturación | Dynadrill | Ver `03-DECISIONES-PENDIENTES.md` y los `CONSULTAS-PARA-DYNADRILL.md` |

Lo que dependa de una consulta abierta se modela solo hasta donde no depende de la respuesta y se marca «por confirmar»; no se inventan reglas.
