> Estado de la sesión y pendientes: ver `ESTADO-SESION-PRINCIPAL.md`.

# Plan: Pumping restante (después del traslado de salida)

**Schema:** `pumping` · **Contenedor:** operaciones · **Librería:** `libs/operaciones/pumping` (ya existe) · **Prefijo:** `/api/operaciones/pumping`
**Estado:** el traslado de salida **está hecho** y alineado con el `main` de la demo (ver `pumping/PLAN-TRASLADO-SALIDA.md` y `04-REVISION-CONTRA-DEMO-MAIN.md`); falta lo de abajo · **Ola:** 2 (depende de Inventario, QHSE, Flota y Mantenimiento) · **Dueño actual:** la sesión principal (puede delegarse tramo a tramo)

## 1. Qué falta del ticket de Pumping (alineado con el `main` de la demo, 08/10/2026)

Pasos existentes en la base: `revision_inicial` y `asignacion` (hechos), `traslado_salida` (hecho), `revision_reportes_salida` (existe el paso; falta la revisión del Supervisor), `ejecucion_operativa`, `control_retorno`, `traslado_llegada`, `revision_reportes_llegada`, `revision_final`, `cierre`. **El paso `mantenimiento` salió del flujo** (queda inactivo).

**Condiciones de salida de cada paso en la demo `main`** (la mayoría ya son requisitos en la base, ver `04-REVISION-CONTRA-DEMO-MAIN.md`):

| Paso | Para salir se exige |
|---|---|
| Traslado de salida | inspección de vehículos **realizada** (unidades de Transporte), EPI despachado y términos aceptados por cada operador (y el reporte de unidad de salida firmado). **Hecho** |
| Revisión de reportes de salida | **Gerenciamiento de viaje de salida aprobado** (Flota) y, para pasar a la ejecución, la **inspección aprobada** por el Supervisor. Requisitos creados; falta la pantalla y la transición |
| Ejecución operativa | **Checklist de ingreso a locación** (confirmaciones, gases, LOTO) completo — se llena **al inicio de la ejecución** junto con la **formalización de ejecución** (el Supervisor confirma que el Company Man aprobó). El checklist está hecho; falta la formalización y la transición |
| Control de retorno | **Gerenciamiento de viaje de retorno aprobado** (Flota) |
| Cierre (aprobación final) | **Acta de Entrega de Locación cargada** (QHSE, contrato 4.11); al cerrar se **genera la prefactura** (contrato 4.10) |

| Tramo | Contenido | Depende de |
|---|---|---|
| **P1 — Asignación con químicos** | El Jefe de Base asigna además **químicos** (artículo, cantidad) con **salida de bodega real** y el **documento de mezcla** obligatorio si hay químicos. En la demo `main` el **detalle de químicos y herramientas cotizados** del pedido se muestra en el ticket | **Inventario** (contrato 4.1) |
| **P2 — Revisión de reportes de salida** | El Supervisor revisa los reportes de salida y **guarda la aprobación de la inspección de cada unidad de Transporte** (requisito `inspeccion_vehiculo_aprobada`, lo cumple **Flota** por evento); transición a ejecución | **Flota** |
| **P3 — Ejecución operativa y Reporte Diario** | Al inicio: checklist de ingreso y **formalización de ejecución**. Después el Operador llena el **Reporte Diario (DYN-SGI-RE-047, el Reporte Job)** por día, con actividades **y tablas dentro de las actividades** (editor, hoja imprimible, carga desde Excel; hoja «Tablas»; se puede **reabrir y editar aunque figure completado**); se **persiste en el servidor** y se **empuja al pedido** como documento operativo (contrato 4.4): esto destraba la prefactura. **Facturación puede corregir un día** hasta que el pedido sale a firmas; tras la corrección el ticket ya no reenvía ese día. Consumo de químicos; **documentos del ticket** (monitoreo por día, mezcla); **ART y PT** del día los sube el Supervisor | comercial (cambios C3 y C4), **QHSE** (PTW y SWA) |
| **P4 — Control de retorno** | El Supervisor cuadra químicos (usado/devuelto) y herramientas; exige el gerenciamiento de viaje de retorno aprobado | Inventario, Flota |
| **P5 — Traslado de llegada** | **Reporte de unidad de llegada** (usa las columnas de llegada de `reporte_unidad`, ya previstas) e inspección de vehículos de llegada; publica `operaciones.pumping.reporte_unidad_llegada` (contrato 4.2) | **Mantenimiento**, Flota |
| **P6 — Revisión de reportes de llegada, revisión final y cierre** | Revisión, aprobación o **rechazo con motivo** (vuelve a la revisión de llegada). **Antes de finalizar**: «Ver prefactura» (preliminar) y el Supervisor **sube el documento firmado por el Company Man** (cambio C6 de comercial); el **Acta de Entrega de Locación** se sube al finalizar; al cerrar se publica `operaciones.pumping.cerrado` y comercial genera la prefactura | comercial (C5, C6, C7), QHSE |
| **P7 — Solicitudes de cambio de ítems** | El Operador propone cambios de ítems del pedido; el Supervisor aprueba y se **recalcula la prefactura** | comercial |
| **P8 — Tarjeta «Mantenimientos»** | Tarjeta lateral con las sub-órdenes de la unidad, sin bloquear | Mantenimiento |
| **P9 — Consulta del gerenciamiento de viaje** | El ticket muestra el estado de los gerenciamientos de viaje de sus unidades | Flota |

### Hecho el 18/10/2026 (sesión principal): P1 químicos y el ciclo de químicos de P3/P4

- **Asignar con químicos:** `POST /api/operaciones/pumping/tickets/:id/asignar` acepta `quimicos: [{articuloId, bodegaId, cantidad}]` y `documentoMezclaId` (archivo de `archivos`; **obligatorio si hay químicos**, 400 `MEZCLA_REQUERIDA`). Los químicos salen de bodega a cargo del ticket (solo artículos de categorías con `es_quimica`: 409 `ARTICULO_NO_QUIMICO`; stock insuficiente: 409 y no cambia nada). El documento queda en `pumping.ticket_documento` (tipo `mezcla_quimica`, FK a `archivos.archivo`, inmutable). Migración `20261021110000_documentos_del_ticket`.
- **Atomicidad:** ver contrato 4.1 (transacción propia de Inventario y devolución compensatoria; probada simulando una falla después de la salida).
- **Consumo (P3):** `POST tickets/:id/quimicos/consumo` `{articuloId, cantidad}`; solo en *Ejecución operativa* y por el equipo asignado; no mueve stock; no puede superar lo que el ticket tiene a su cargo.
- **Devolución (P4):** `POST tickets/:id/quimicos/devolucion` `{lineas:[{articuloId,bodegaId,cantidad}]}`; solo en *Control de retorno* y por el Supervisor del equipo; no puede devolver más de lo pendiente.
- **Consulta:** `GET tickets/:id/quimicos` devuelve, por químico, asignada, usada, devuelta y pendiente (calculadas del kardex en Inventario; Pumping no guarda cantidades) y los documentos del ticket.
- **Decisión:** el control de retorno **no exige** que el pendiente quede en cero para avanzar (la demo solo pide cuadrar); si Dynadrill lo pide se agrega como requisito.
- Selector de químicos para la asignación: `GET /api/operaciones/inventario/articulos/quimicos?q=` (permisos `inventario.articulos.ver` o `pumping.tickets.operar`): solo químicos con existencia, con el saldo por bodega. El balance del ticket trae además las bodegas de las que salió cada químico (a ellas se devuelve). Módulo de archivos nuevo `ticket_mezcla_documento` (hay que correr `npm run db:seed:archivos`; ya corrido en desarrollo).
- Pruebas: 19 de integración (5 nuevas).

### Hecho el 18/10/2026 (sesión principal): frontend de los químicos en las pantallas nuevas del ticket (`operations/pumping/tickets-nuevos`, ruta `pedidos/:id`)

- **Asignar equipo:** el diálogo trae «Químicos (opcional)»: químico (solo con existencia), bodega con su saldo, cantidad y el documento de mezcla (obligatorio si hay químicos; se sube a `archivos` y luego se asigna). Los errores del archivo y de la asignación se muestran por separado.
- **Detalle del ticket:** tarjeta «Químicos del ticket» (asignado, usado, devuelto y a cargo del ticket); «Registrar consumo» (Operador del equipo, en Ejecución operativa) y «Devolver a bodega» (Supervisor del equipo, en Control de retorno); botón «Formalizar ejecución» para el Supervisor.
- Pruebas: 372 en el frontend; `ng build` verde.
### Hecho el 18/10/2026 (sesión principal): frontend de P5 y P6 en `tickets-nuevos`

- **P5 Traslado de llegada:** diálogo «Reporte de unidad de llegada» (`ticket-reporte-llegada-dialog`): fecha y combustible, hubodómetro y llantas de la llegada (los ejes son los que registró la salida), inspección por secciones, novedades por área (mecánica, instrumentación, operaciones), unidad lista e interrupción de la operación (con detalle obligatorio). Lo firma el operador de la unidad; el requisito `reporte_unidad_llegada` abre el diálogo (solo lectura para los demás y fuera de su paso). Con novedades, el reporte llega solo a Mantenimiento (contrato 4.2).
- **P6 Revisión de reportes de llegada:** el Supervisor consulta cada reporte (solo lectura) desde los requisitos del ticket y pasa a Revisión final.
- **P6 Revisión final y cierre:** botón «Ver prefactura y firma del Company Man» (permiso `comercial.prefacturas.vista_ticket`): muestra la prefactura vigente o la preliminar (no guarda nada) con sus totales y el avance de la documentación del pedido; el Supervisor (permiso `comercial.prefacturas.firma_company_man`) sube el documento firmado (módulo de archivos `prefactura_company_man`), solo con la documentación completa (el diálogo dice qué falta).
- **Devolver con motivo:** las salidas que exigen motivo (p. ej. rechazar la revisión final y volver a la revisión de llegada) piden el motivo antes de enviarse; el botón dice «Devolver a …» y no queda bloqueado por los requisitos pendientes.
- **Acta de Entrega de Locación:** sigue siendo requisito de QHSE (contrato 4.11); como QHSE aún no construyó la carga del acta, se confirma con el **puente temporal** (botón «Confirmar a mano»). Cuando QHSE publique `qhse.documento.acta_entrega_cargada`, el consumidor ya la cumple solo.
- Pruebas: 374 en el frontend; `ng build` verde.

### Hecho el 18/10/2026 (sesión principal): P2 y el Reporte Diario

**P2 Revisión de reportes de salida.** El Supervisor del equipo aprueba la inspección de cada unidad: `POST /api/operaciones/pumping/tickets/:id/revision-salida/inspecciones/:vehiculoId/aprobar` (solo en ese paso; lo hace el Supervisor del equipo o Superadmin; 409 si ya estaba aprobada). La inspección es de Flota: mientras Flota no construya la suya, la aprobación del Supervisor cumple el requisito `inspeccion_vehiculo_aprobada` con el puente temporal (origen `manual_temporal`, quién y cuándo, motivo fijo); cuando llegue `flota.inspeccion_vehiculo.aprobada` no choca con lo ya aprobado. El gerenciamiento de viaje de salida sigue siendo de Flota/Jefe de Base (puente de Jefe de Base). En pantalla: «Aprobar inspección» y «Ver reporte de salida» en los requisitos del paso.

**Reporte Diario (DYN-SGI-RE-047, el Reporte Job), backend.**
- Tablas propias en `pumping` (migración `20261021120000_reporte_diario`), sin JSON: `reporte_diario` (uno por ticket y día; representante del cliente, tiempos productivo y no productivo, observaciones, quién y cuándo lo completó, `corregido_at`), `reporte_diario_actividad` (hora de inicio y fin; la duración se calcula, no se guarda), y las tablas de cada actividad: `reporte_diario_tabla`, `_columna`, `_fila` y `_celda`. CHECK: horas distintas, detalle no vacío, completado con quién y cuándo, tiempos entre 0 y 24.
- Endpoints (`/operaciones/pumping/tickets/:id/reportes-diarios`): `GET` (días con estado y horas), `GET :fecha`, `PUT :fecha` (guarda como borrador y reemplaza el día; si estaba completado lo **reabre**) y `POST :fecha/completar`. Solo el Operador del equipo y en la Ejecución operativa.
- Al completar se publica `operaciones.pumping.reporte_diario_completado` (día, actividades con sus tablas, supervisor, operador). **Comercial lo consume** (`ReporteDiarioConsumer`, cola propia con `group: 'reportes-diarios'`) y lo recibe como documento operativo de origen Pumping: reemplaza el documento de la misma clave, así que reenviar un día reabierto no duplica; si Facturación ya lo corrigió o el pedido ya no recibe documentos, se omite sin fallar.
- **Corrección de Facturación:** Pumping consume `comercial.documento_operativo.corregido` (`DiaCorregidoConsumer`) y marca el día; desde entonces el ticket ya no lo edita ni lo reenvía (409 `DIA_CORREGIDO`). Si el día no tenía reporte queda un registro sin actividades que lo bloquea.
- Pruebas: Pumping 25, Pedidos 108.

**Reporte Diario, frontend** (`tickets-nuevos`): tarjeta «Reporte diario de actividades» en el ticket (días con su estado: borrador, completado o corregido por Facturación; «Llenar reporte de ese día»); diálogo con la cabecera del ticket, representante del cliente, actividades (inicio, fin, detalle y el editor de tablas ya existente), tiempos y observaciones; «Guardar borrador» y «Completar y enviar a Facturación». Pruebas: 377 en el frontend.

**No portado del Reporte Diario de la demo (decisiones pendientes):** descargar o cargar la plantilla Excel DYN-SGI-RE-047 (y la hoja «Tablas»), el documento de monitoreo por día, las firmas dibujadas del supervisor y del cliente, y el archivo adjunto. Los documentos del ticket (monitoreo, ART y PT) siguen pendientes.

### Hecho el 18/10/2026 (sesión principal): P7, P8 y el monitoreo por día

**P7 Cambio de ítems del pedido** (contrato 4.13).
- **Pumping:** tablas `solicitud_cambio_items` y `solicitud_cambio_item` (migración `20261021130000`): estado (pendiente, aprobada, rechazada), motivo, quién y cuándo propuso y revisó, y `aplicacion` (pendiente, aplicada, no aplicada) con su motivo; una sola pendiente por ticket; los ítems propuestos son historia (sin UPDATE ni DELETE). Los ítems guardan el id de la lista de precios de Comercial **sin FK** (otro contenedor) y copian código y descripción solo para mostrarlos; el precio **no** se copia.
- **Endpoints:** `POST tickets/:id/cambios-items` (el equipo del ticket, permiso `pumping.cambios_items.solicitar`; propone la lista COMPLETA que debe quedar), `GET tickets/:id/cambios-items`, `GET cambios-items/pendientes` (bandeja del Supervisor), `POST cambios-items/:id/aprobar` y `.../rechazar` (solo el Supervisor del ticket o Superadmin, permiso `pumping.cambios_items.aprobar`).
- **Comercial:** `GET /api/comercial/pedidos/:pedidoId/items-para-cambio?q=` (ítems actuales y, con 2 letras o más, hasta 30 de la lista de precios activa del cliente; sin precios), y consume `operaciones.pumping.cambio_items_aprobado`: reemplaza los ítems con los precios de su lista (los ítems sin enlace a la lista, los de AS2, se conservan al final), solo mientras el pedido es editable y ya está abierto, recalcula la prefactura si está «generada» y responde `comercial.cambio_items.resultado` (aplicado o por qué no). Pumping lo guarda en la solicitud.
- **Pantalla (`tickets-nuevos`):** tarjeta «Cambios de ítems del pedido» en el ticket (proponer, ver, revisar con el cambio frente a lo que tiene el pedido hoy, y el resultado de Comercial); diálogo para proponer con búsqueda en la lista del cliente; bandeja de **Aprobaciones** del Supervisor (ruta `pedidos/aprobaciones`, botón en la bandeja de pedidos). La pantalla vieja de aprobaciones (contra la demo) sigue sin tocarse.
- Pruebas: Pumping 32 (con las de este bloque), Pedidos 109; frontend 384.

**P8 Tarjeta «Mantenimientos»** en el ticket nuevo: `GET /api/operaciones/mantenimiento/tickets/:ticketId/ordenes` trae las órdenes de las unidades del ticket (la unidad del ticket es un vehículo del catálogo; la de Mantenimiento, su unidad de Flota enlazada por `flota.unidad.vehiculo_id`, D2). La tarjeta existente (`ticket-maintenance-card`) recibe `ticketId` y reutiliza los diálogos de ejecución y revisión; se ve para quien puede leer Mantenimiento. Pruebas: Mantenimiento 38.

**Monitoreo por día** (documento del ticket): `ticket_documento` suma el tipo `monitoreo` y su `fecha` (CHECK: solo el monitoreo lleva fecha); `GET tickets/:id/documentos` y `POST tickets/:id/documentos/monitoreo` (`{fecha, archivoId}`; el Operador del equipo en la Ejecución operativa; varios por día, el último es el vigente). Módulo de archivos `ticket_monitoreo_documento` (correr `npm run db:seed:archivos`). En el ticket: «Adjuntar monitoreo» y «Descargar monitoreo» en cada día del reporte diario. También se endureció la validación de fechas (el 31 de febrero ya no pasa).

**Sigue pendiente de Pumping (depende de otros módulos o de una decisión):**
- **Inspección de llegada y gerenciamiento de viaje (P9):** son de Flota, que aún no construye la inspección ni el gerenciamiento; los requisitos ya existen y se confirman con el puente.
- **ART y PT del día:** son documentos de QHSE (`documento_pedido`), que aún no existen.
- **Herramientas del cuadre (P4):** hoy el cuadre cubre químicos; para herramientas falta definir con Dynadrill de dónde salen (consulta abierta).

- **Pendiente del frontend de Pumping:** lo de Flota y QHSE de arriba; la pantalla vieja del ticket (demo) se retira en el Corte. Antes de ese bloque se anotaba: solicitudes de cambio de ítems (P7), tarjeta de gerenciamiento (P9). La pantalla vieja `pages/ticket-detail-page` (contra la demo) sigue sin tocarse.
- **Sigue pendiente:** P3 Reporte Diario completo y documentos del ticket (monitoreo, ART, PT), P4 herramientas, inspección de llegada, P6 pantalla, P7, P8, P9 y **todo el frontend de Pumping** (la pantalla del ticket sigue contra la demo).

## 2. Qué hay en la demo

- Backend: `dynadrill-backend/libs/domains/operaciones/src/pumping-tickets` (≈ 1.400 líneas), `solicitudes-cambio-items` (≈ 220), `workflow` (mapas rol↔paso).
- Frontend: `features/operations/pumping` (la pantalla del ticket tiene ≈ 2.900 líneas; reporte diario, solicitud y revisión de cambio de ítems, documentos, conductor), y las **especificaciones** `specs/pumping-*`.
- Documentos: `documentacion/pumping/PLAN-MIGRACION-OPERACIONES-PUMPING.md`, `PLAN-TRASLADO-SALIDA.md` y `documentacion/PLAN-QHSE-PUMPING-NOTIFICACIONES.md`.

## 3. Reglas del diseño ya construidas (no las cambie sin avisar)

- **Requisitos por paso** en base de datos (`requisito`, `paso_requisito`, `ticket_requisito`); salir de un paso exige todos cumplidos; los externos se cumplen por **eventos** (`qhse.*`, `flota.*`) o, mientras no existan, por el **puente temporal** (`pumping.requisitos.puente`).
- **Solo el equipo asignado** ve y mueve el ticket (`puedeActuarEn`).
- **Asignación emparejada**: cada operador lleva su unidad. Las personas y unidades salen de identidad y catálogo; nada de nombres copiados.
- Eventos de avisos con `asignados` por cuenta; el supervisor es avisado al terminar el traslado.
- `reporte_unidad` ya tiene columnas y tablas de **llegada** (hubodómetro, llantas, inspección, combustible, novedades, operatividad, firmas).

## 4. Qué hacen los otros módulos mientras tanto

Inventario, QHSE, Flota y Mantenimiento se construyen en paralelo (Ola 1). **Cada vez que uno de ellos publique un evento del contrato 3 o 4**, esta sesión retira el puente temporal de ese requisito y lo anota en el registro. Hasta entonces se avanza con el puente.

## 5. Acciones inmediatas (preparación para el trabajo en paralelo)

1. Renombrar el módulo dueño de la inspección de vehículos de `mantenimiento` a **`flota`** (enum `modulo_dueno`, eventos `flota.inspeccion_vehiculo.*`, consumidor, pruebas, pantalla). *(Hecho o en curso por esta sesión: ver el registro.)*
2. Partir las plantillas de avisos por módulo (`plantillas/<modulo>.ts`) para que cada sesión agregue las suyas sin tocar las demás. *(Hecho o en curso por esta sesión.)*

## 6. Pruebas, consultas y choques

Igual que el traslado de salida (13+ pruebas de integración con maestros reales). Consultas abiertas: las del plan del traslado y las de `03-DECISIONES-PENDIENTES.md` (D8, D9, D10, D13). Archivos compartidos: los mismos de siempre; **este módulo es de esta sesión**: las demás no lo editan, piden por el registro.

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
