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

- [x] (26/10/2026, `qhse/20261026122000_kpi_indicador_y_meta`: catálogo sembrado con los 16 indicadores de la demo y metas con historial inmutable; API `GET` y `PATCH /api/qhse/dashboard-metas` hecha el 27/10/2026: `{ códigoDelIndicador: valor }`, cada cambio agrega una fila y la vigente es la más reciente; permiso `qhse.general.gestionar`) **Metas del tablero HSE (`DashboardMetas`).** En la demo es un JSON `{indicador: meta}`. Modelo nuevo en `qhse`: catálogo `kpi_indicador` (código, categoría, unidad, dirección mayor/menor es mejor, disponible y motivo si no lo está; sembrado con los 16 de HSE-MASTER-001) y `kpi_meta` (indicador por FK, valor, vigente desde, quién; historial inmutable: una meta nueva reemplaza a la anterior). API `GET/PUT /api/v2/qhse/kpi/metas`.
- [x] (26/10/2026: PTW, desechos, Entrega de EPI e inspección de FCR publican el evento de cada firma conforme al contrato 4.14 (antes `qhse.ptw.firmado` y `qhse.desecho.firmado` no lo cumplían y Firmas los habría mandado a fallidos); el de formalización del PTW pasó a `qhse.ptw.formalizado`. **Decisión: las tablas de firmas de cada módulo se conservan**, porque son el estado del flujo y, en desechos, guardan nombre y cédula de quien firma en papel; ver contrato 4.14) **Firmas adoptadas por los módulos (A3 de `plan-firmas-y-auditoria.md`).** Hoy solo PTW y Desechos publican `*.firmado`. Faltan IPERC, STOP, SWA, Entrega de EPI e Inspección de FCR (ya están en el catálogo de Firmas): publicar el evento y retirar con migración las firmas «de una línea» que cada módulo guarda.
- [x] (27/10/2026, migración `qhse/20261027110000_desecho_aviso_automatico`: `desecho_aviso.emitido_por` admite vacío cuando lo emite el sistema; `AvisosProgramadosService` llama a `DesechosAvisosService.revisar` en cada vuelta; qhse-seguridad 327 en verde) **Aviso automático del límite de desechos.** Sumarlo al emisor horario `AvisosProgramadosService` (hoy solo con `POST desechos/avisos/revisar`).
- [x] (27/10/2026, `GET /api/operaciones/mantenimiento/ordenes/:id/hoja`: orden, unidad, lecturas de horómetro u odómetro de Flota al abrirse la orden, base, operador y supervisor de salida, novedades, sub-órdenes con repuestos y quién devolvió la unidad; Mantenimiento 41 en verde. Falta que el frontend adapte las hojas a esta respuesta) **Hojas imprimibles de Mantenimiento** (DYN-MNT-RE-008, orden general y operativa): exponer los datos que pide cada hoja desde el backend nuevo.
- [x] (27/10/2026, `PERMISSION_REPLACEMENTS` admite `replacedBy: []`; permiso retirado también en desarrollo con `db:seed:identidad`; authz e identidad en verde) **Retirar el permiso `comercial.cierre.gestionar`:** permitir en `libs/shared/authz` un permiso «retirado sin reemplazo».

**C2. Las que salieron de la fase B** (detalle y propuesta de cada una en `PARIDAD-MODELO-DEMO.md`; fase B terminada el 26/10/2026):

- [x] (26/10/2026, `1397ec0`; migraciones en desarrollo; inventario 53 y pedidos 131 en verde. Frontend pendiente: el diálogo de solicitud con bodega, fecha e ítems y la bandeja de Bodega con despachar/rechazar, en la fase de diseño) CM-5 Despacho a bodega completo (ítems, bodega, fecha requerida, notas, rechazo)
- [x] (26/10/2026, backend `1819a25`, frontend `71683e5`; migraciones aplicadas en desarrollo; pedidos 131, FCR 126, Pumping 39, inventario 53 y catálogos en verde) CM-4 / OP-6 Unidades por catálogo del portal con FK obligatoria (seis tablas de Comercial y cuatro de Operaciones; `periodo` en el catálogo reemplaza a `fcr.unidad_cotizacion`; los códigos de unidad de AS2 al exportar siguen en la consulta C11)
- [x] (26/10/2026, migración `20261026112000_rechazo_de_prefactura_completo`; pedidos 131 en verde. `prefactura.rechazo_devuelto_a_usuario_id`, `prefactura_rechazo_item` y `prefactura_seguimiento`, inmutables, solo en prefactura rechazada. El servicio de rechazo los llena desde el 27/10/2026: `POST prefacturas/:id/rechazar` acepta `devueltoAUsuarioId` e `items [{ itemId, observacion }]`, `POST prefacturas/:id/seguimiento { nota }` anota la corrección y el detalle devuelve `rechazo.items`, `rechazo.devueltoAUsuario` y `seguimiento`; pedidos 133 en verde. Falta la pantalla) CM-2 Rechazo de la prefactura (ítems observados, persona, seguimiento)
- [x] (26/10/2026, migración `20261026114000_horas_como_time`; sin CHECK de fin >= inicio porque una actividad puede cruzar la medianoche) CM-3 Horas como `time` en documentos operativos y guía
- [x] (26/10/2026, migración `20261026113000_descripcion_del_documento_del_pedido`; pedidos 131 en verde; el endpoint acepta `descripcion` y, sin ella, usa el nombre del archivo) CM-1 Descripción del documento adjunto al pedido
- [x] (26/10/2026, migración `20261026110000_reporte_de_herramientas`; Pumping 39 en verde. Diferencia con FCR: como no hay series ni filas a mano, la fila del reporte es la propia línea cotizada `ticket_linea`; `reporte_item_dia` apunta a ella y la base impide pasar de lo cotizado, usar movilización o un día anterior al inicio. El servicio está hecho desde el 27/10/2026: las líneas llegan por `comercial.pedido.abierto` y `.actualizado`; `GET/PUT/DELETE/POST operaciones/pumping/tickets/:id/reporte-herramientas` (precarga una sola vez, marcas por día, tope en lo cotizado, completar) y el evento `operaciones.pumping.reporte_herramientas_completado`, que Comercial recibe con origen `pumping`; Pumping 49 en verde. Falta la pantalla) OP-1 Reporte de herramientas de Pumping como el de FCR (desde lo cotizado, distribuido por día; sin selección ni inspecciones; sin kardex)
- [x] (26/10/2026, migraciones `fcr/20261026110000_bitacora_corregida_por` y `pumping/20261026112000_reporte_diario_corregido_por`; FCR 126 y Pumping 40 en verde. Se aplicó también al Reporte Diario de Pumping, que tiene el mismo caso; el actor sale del evento de Comercial y el rol es el del usuario) OP-2 Quién corrigió el día de la bitácora de FCR
- [x] (26/10/2026, migración `20261026111000_representante_del_reporte_diario`; Pumping 40 en verde. `representante_id` FK a `catalogos.persona_contacto`, validado como representante de campo por trigger; sin cargo guardado, porque es el del tipo. Se ajustó el servicio y el DTO del reporte diario; el joblog del frontend queda para el diseño) OP-3 Company Man precargado en el joblog (Reporte Diario) por FK al contacto
- [x] (26/10/2026, `pumping/20261026114000_origen_destino_por_fk` y `flota/20261026110000_inspeccion_extremos_por_fk`; Pumping 40 en verde; Flota 75 de 78: las 3 fallas son de la carga inicial de unidades de la demo, que se borró en la limpieza. Cambia el contrato: `origen`/`destino`/`puntoPartida` pasan de texto a `{ bodegaId | pozoId }`; el frontend queda para el diseño) OP-4 / FL-3 Origen y destino por FK a bodega o pozo (reporte de unidad e inspección de vehículo)
- [x] (26/10/2026, migración `pumping/20261026113000_tipo_ot_como_enum`; Pumping 40 en verde) OP-5 `tipo_ot` de Pumping como enum
- [x] (26/10/2026, `flota/20261026111000_umbral_permiso_por_fk`) FL-4 Permiso del umbral de riesgo con FK
- [x] (27/10/2026, `flota.gerenciamiento_viaje.firmado` al solicitar (rol `conductor`) y al decidir (rol `aprobador`), «de una línea»; documento `flota_gerenciamiento_viaje` y los dos papeles en el catálogo de Firmas; Flota 77 en verde) FL-1 Firmas del viaje
- [x] (26/10/2026, `qhse/20261026121000_equipo_de_inspeccion`; qhse-seguridad 323 en verde. `qhse.equipo` único por tipo y código sin mayúsculas ni espacios; `inspeccion.equipo_id` con FK compuesta al tipo; `stop_tarjeta.equipo_id` opcional. La API sigue recibiendo `equipoCodigo` y da de alta el equipo al inspeccionar) QH-1 Catálogo de equipos inspeccionados

- [x] (26/10/2026, `pumping/20261026115000_adjunto_del_reporte_diario`; Pumping 41 en verde; Firmas 25 en verde. Tabla del adjunto inmutable con FK a `archivos.archivo`; en el catálogo de Firmas se agregó el documento `pumping_reporte_diario` y los papeles `supervisor` y `representante_cliente`; 27/10/2026: `POST .../reportes-diarios/:fecha/adjuntos` y `POST .../firmas` (`supervisor` «de una línea»; `representante_cliente` con el documento firmado como firma manuscrita) publican `operaciones.pumping.reporte_diario.firmado`; Pumping 49 en verde; sembrado en desarrollo) **Reporte Diario de Pumping completo (D-PD):** `reporte_diario_adjunto` (FK a `archivos.archivo`) y firmas del supervisor y del cliente por `plataforma/firmas`.

**C3. Indicadores (Reportería y Dashboard), por resúmenes de cada módulo (D-R).** *Tablero HSE hecho el 27/10/2026:* `GET /api/v2/qhse/dashboard/indicadores` calcula en el servidor los 11 indicadores disponibles, el estado de EPI y PTW y lo que pone el semáforo en rojo (migración `qhse/20261027120000`: el de desechos se mide en galones, no en kg); la página ya no llama a los servicios de la demo. Falta el tablero general de Reportería (Comercial, Pumping, FCR, Flota, Mantenimiento, Inventario).  El tablero general de la demo lee 14 servicios y el HSE calcula 16 indicadores: cada módulo dueño expone su `resumen` y el frontend los combina. Datos que no existen en ningún módulo, igual que en la demo: horas-hombre (TRIR, LTIR), nómina (participación STOP) y capacitación; quedan como «no disponible», como en la demo.

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
