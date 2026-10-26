# Paridad del modelo de datos con la demo (fase B de `PLAN-CIERRE-MODELADO.md`)

> Fuente de la demo: `main` de `dynadrill-frontend` (`74ca851`, interfaces de `src/app/features/**/models`) y de `dynadrill-backend` (`ec6bbe2`, `prisma/schema.prisma`, donde 37 modelos son solo un `payload` JSON). Base nueva: la de desarrollo con `integracion/sesiones` aplicada, revisada con `information_schema` y `pg_constraint`.
> Clasificación: **OK** · **Falta** (la demo lo guarda o lo exige; la base no) · **Texto libre** (debería ser catálogo con FK o enum) · **Tipo** (tipo de columna incorrecto) · **Copia justificada** (dato copiado a propósito; se dice por qué) · **Derivado** (se calcula, no se guarda) · **Descartado** (con la decisión que lo respalda).
> Cada hueco lleva un id (`CM-n`, etc.) que se cita en la tarea de la fase C que lo resuelve.

## 1. Comercial (revisado el 26/10/2026)

### 1.1 Modelos de la demo y su lugar en la base nueva

| Modelo de la demo | Tabla(s) nuevas | Resultado |
|---|---|---|
| `Pedido` (+ `ItemEstimado`, `CambioEstado`) | `pedido`, `pedido_item`, `pedido_tipo_servicio`, `pedido_subtipo_servicio`, `proceso_historial` | **OK**: todos los campos; cliente, campo, bloque, pozo, taladro, contactos, técnico HSE, analista, condición de pago, bodega y línea pasaron de texto a FK; zona se deriva del campo; `esQuimico/esHerramienta/esMovilizacion` → enum `tipo_linea`; estado con FK compuesta a `proceso_estado` y `CHECK` de pedido completo |
| `PedidoDocumentoAdjunto` | `pedido_documento` + `archivos.archivo` | **Falta `descripcion`** (CM-1) |
| `ListaPrecios`, `ListaPreciosItem` | `lista_precios`, `lista_precios_item` | OK salvo la unidad (CM-4) |
| `Prefactura` (+ ítems, envío, firma, rechazo) | `prefactura`, `prefactura_item`, `prefactura_firma`, `prefactura_advertencia` | **Falta** lo del rechazo (CM-2). `code` → número de ticket emitido; `envioCliente.adjuntos` era una lista simulada de nombres: **Derivado** (el paquete son los documentos del pedido) |
| `Aot` (+ ítems, representantes) | `orden_trabajo`, `orden_trabajo_item` | OK. `numeroOpr` = `numero-OPR-pozo-ciudad-año`: **Derivado**. Representantes: **Copia justificada** (documento emitido, no debe cambiar si cambia el catálogo) |
| `GuiaRemision` (+ ítems, transporte, firmas) | `guia_remision`, `guia_remision_item`, `guia_firma_digital` | OK. Cliente, transportista, chofer y placa copiados: **Copia justificada** (documento tributario emitido, inmutable) |
| `DocumentoOperativo` (+ actividades, herramientas, usos) | `documento_operativo*` (8 tablas) | OK; el `header` se deriva del pedido. Ver CM-3 y CM-4 |
| `DocumentoFirmado` | `documento_respaldo_firmado` | OK |
| `SolicitudDespachoBodega` (+ ítems) | `comercial.pedido.despacho_*` + `inventario.despacho` | **Falta** casi todo el contenido (CM-5) |
| `PedidoPendienteAs2` | — | **Descartado**: era una cola simulada; la reemplaza la consulta en vivo a AS2 (`integraciones`) |

### 1.2 Huecos

| Id | Clase | Hueco | Propuesta |
|---|---|---|---|
| CM-1 | Falta | El documento adjunto al pedido no tiene la descripción que pide la demo | `pedido_documento.descripcion text NOT NULL` con `CHECK (length(trim(descripcion)) > 0)`; los existentes toman el nombre original del archivo |
| CM-2 | Falta | Rechazo de la prefactura por el cliente: la demo guarda los **ítems observados**, la **persona** a quien se devuelve la corrección (con seguimiento aunque cambie de pozo) y el **seguimiento**; la base solo guarda motivo, razón de retraso y el **área** | Tabla `prefactura_rechazo_item` (prefactura, `prefactura_item_id` con FK, observación); `rechazo_devuelto_a_usuario_id` con FK a `identidad.usuario` (se conserva el área); el seguimiento como filas fechadas inmutables `prefactura_seguimiento` (quién, cuándo, nota), no como texto único |
| CM-3 | Tipo | Horas guardadas como `text`: `documento_operativo_actividad.hora_inicio/hora_fin`, `guia_remision.hora_salida/hora_llegada` | Pasar a `time` (migración con conversión y `CHECK` hora_fin ≥ hora_inicio cuando la actividad no cruza medianoche: confirmar en los datos de la demo si cruza) |
| CM-4 | Texto libre | La unidad es texto en `lista_precios_item`, `pedido_item`, `prefactura_item`, `orden_trabajo_item`, `guia_remision_item` y `documento_operativo_herramienta`. En las listas hay 24 escrituras para menos unidades reales (`Unidad`/`unidad`, `Corrida`/`corrida`, `sx`/`SX`, `gls` = galón, `lbs` = libra, `Kg`/`kg`) y 10 no existen en `catalogos.unidad_medida`. Las listas de precios salieron de la demo | `catalogos.unidad_medida` es la única fuente (se administra en el portal) y gana `periodo` (hora, día, semana, mes), que reemplaza al catálogo `fcr.unidad_cotizacion` y a la expresión regular con que FCR deducía «por día». Se completan en él las unidades que usan las listas, normalizando las escrituras repetidas, y se pasa a `unidad_medida_id` con FK obligatoria en las seis tablas (y en las cuatro de Operaciones, OP-6). El texto se conserva solo en los documentos emitidos (prefactura, OT, guía) como **copia justificada** de lo impreso. Lo que llega de AS2 toma la unidad de su línea de la lista de precios; la equivalencia con los **códigos de unidad de AS2 al exportar** la prefactura (hoy «Unidad» → `UN`) sigue siendo la consulta C11 |
| CM-5 | Falta | La solicitud de despacho de la demo tiene número, bodega de origen, fecha requerida, **ítems** (código, descripción, cantidad, unidad, tipo), nota de Ventas, nota de Bodega y **rechazo** (motivo, quién, cuándo). En la base nueva, `inventario.despacho` solo guarda el estado (`solicitado`, `realizado`) y los dos archivos; no hay rechazo | Los despachos **parten de cero** (sin datos que migrar; indicación del usuario del 26/10/2026). En `inventario`: `despacho` con `numero` (secuencia desde 1), `bodega_id` (FK), `fecha_requerida`, `nota_solicitud`, `nota_bodega`; estado `rechazado` con `rechazado_at/por` y `motivo_rechazo` (`CHECK` por estado); `despacho_item` (artículo con FK a `inventario.articulo`, cantidad > 0, unidad por FK; el pedido de origen viaja por el evento, sin FK entre contenedores). La salida de kardex referencia el renglón del despacho. Evento `operaciones.inventario.despacho.rechazado` para que Comercial devuelva el pedido |

### 1.3 Copias y textos revisados que se quedan como están

- `pedido.as2_*` (número, estado, fecha, totales, empresa, bodega, condición de pago, zona): resumen del pedido de AS2 tal como llegó, para conciliar. Sistema externo: **copia justificada**.
- `documento_operativo.ticket_ref`, `firmado_por` y `documento_operativo_actividad.autor`: llegan en el evento del ticket (otro contenedor) y forman parte del documento recibido: **copia justificada**. La firma real del documento irá a `plataforma/firmas` (fase C, adopción de Firmas).
- `pedido.subcliente`: texto libre también en la demo, sin conjunto conocido. **Por revisar con Dynadrill** si es un cliente del catálogo.
- `proceso_historial.actor_rol` (texto): código de rol en el momento del cambio, historial inmutable: **copia justificada** (si el rol cambia de nombre o se retira, el historial no debe cambiar).

## 2. Operaciones: Pumping y FCR (revisado el 26/10/2026)

| Modelo de la demo | Resultado |
|---|---|
| `Ticket` base (código, estado, pozo, cliente, fecha, supervisor, operador, unidad) | **OK**: `ticket` + `ticket_persona` + `ticket_unidad`; cliente, campo, bloque, pozo, taladro por FK. Los datos del pedido (código, contrato, número AS2, fechas) son **copia justificada**: el pedido vive en otro contenedor y el ticket los recibe por `comercial.pedido.abierto|actualizado` |
| `PumpingTicket` (químicos, documento de mezcla, operadores, reporte de unidad, Company Man) | **OK** salvo herramientas (OP-1). Químicos en `inventario.consumo_ticket` y kardex; mezcla en `ticket_documento`; la aprobación del Company Man es la firma de la prefactura en Comercial. `proposalOrigin` = origen del pedido: **Derivado** |
| `PumpingUnitReport` (DYN-MNT-RE-012) | **OK**: `reporte_unidad`, ejes del hubodómetro, llantas e inspección por ítem del catálogo; firmas de salida y llegada por usuario. Ver OP-4 |
| `DailyActivityReport` | Actividades con hora `time`, tablas en filas. **Falta** adjunto y firmas (decisión D-PD, tarea de C1); ver OP-3 |
| `SolicitudCambioItems`, `AceptacionTerminos`, `TerminosPumping`, `ChecklistIngresoPumping` | **OK** (la aceptación guarda el usuario con FK en vez de nombre y cédula) |
| `FcrTicket` (fases, herramientas, uso, bitácora, documentos, observaciones, reunión, retorno, encuesta, historial por fase) | **OK**: las ~20 marcas booleanas de la demo (`toolListConfirmed`, `inspectionDocumentUploaded`, `movementGuideGenerated`…) se derivan de requisitos cumplidos y documentos cargados; los documentos van en `ticket_documento` con el campo como enum |
| `FcrToolInspection` (+ `Parte`), `ConfiguracionCodigoFcr` (+ kit) | **OK**: versiones de inspección, partes por FK a `inventario.articulo_parte`, firmas por rol permitido |

| Id | Clase | Hueco | Propuesta |
|---|---|---|---|
| OP-1 | Falta | **Pumping no genera el reporte de herramientas.** La demo registraba herramientas en el ticket; **el usuario definió (26/10/2026)** que Pumping debe generar el reporte de herramientas **como FCR**: parte de lo cotizado en el pedido y solo se distribuye cada ítem por día. Sin selección de herramientas ni inspecciones (esas son pasos propios de FCR) | `pumping.reporte_item` y `pumping.reporte_item_dia` con el mismo modelo que FCR: precargado desde las líneas del pedido (FK a `lista_precios_item` por id, sin FK entre contenedores), matriz ítem × día dentro de las fechas del servicio, cantidad por día con tope en lo cotizado (`CHECK` y trigger como en FCR) y unidad por FK (CM-4). Al completarlo publica `operaciones.pumping.reporte_herramientas_completado` con la misma forma que FCR, y Comercial lo recibe como documento operativo. Sin kardex |
| OP-2 | Falta | Bitácora de FCR corregida: la demo guarda quién y con qué rol modificó un día enviado; la base solo tiene `corregida_at` | `bitacora_dia.corregida_por` (FK a usuario), con `CHECK` de que van juntos |
| OP-3 | Texto libre | `reporte_diario.representante_cliente` y `cargo_representante` son texto; el ticket ya tiene `representante_campo_id` (FK al catálogo de contactos). Es la causa de «el reporte diario no recupera el nombre del Company Man» | `reporte_diario.representante_id` con FK a `catalogos.persona_contacto`, **precargado** con el Company Man del ticket (`representante_campo_id`, que viene del pedido) al crear cada día del joblog (indicación del usuario del 26/10/2026); se puede cambiar si ese día firmó otro. El cargo se lee del contacto. Se quitan las dos columnas de texto. Revisar lo mismo en la bitácora de FCR |
| OP-4 | Texto libre | Origen y destino del reporte de unidad (`reporte_unidad.origen/destino`) son texto; en Flota el mismo concepto (viaje) ya es FK a bodega o pozo | Mismo modelo que `flota.gerenciamiento_viaje`: `origen_bodega_id`/`origen_pozo_id` y `destino_bodega_id`/`destino_pozo_id` con `CHECK` de exactamente uno por extremo |
| OP-5 | Tipo | `pumping.ticket.tipo_ot` es `text`; en FCR es el enum `tipo_ot` | Enum también en Pumping (mismos valores que Comercial) |
| OP-6 | Texto libre | Unidad en `fcr.ticket_linea`, `fcr.reporte_item`, `{pumping,fcr}.solicitud_cambio_item` | Se resuelve con CM-4 |

## 3. Flota y Mantenimiento (revisado el 26/10/2026)

| Modelo de la demo | Resultado |
|---|---|
| `Unidad`, `RegistroPreventivo`, `AlertaPreventiva` | **OK**: marca, modelo, año y placa por FK al vehículo del catálogo; horómetro y km actuales se **derivan** de `unidad_lectura` (inmutable, con anulación); preventivos por regla y métrica; alertas **derivadas** |
| `VehicleInspection` | **OK**: caso por ticket, ítems del catálogo con «bloquea si no cumple», revisión del supervisor, anulación. Ver FL-3 |
| `ConductorPermisos` | **OK**: tipo por catálogo, vigencia, archivo, anulación |
| `GerenciamientoViaje` | **OK** en riesgo (preguntas, opciones y umbrales en catálogo; puntaje y nivel), paradas, comunicación, decisión. La aprobación telefónica es de una persona externa: texto **justificado**. Ver FL-1 y FL-2 |
| `UnitReport` (Mantenimiento), `MaintenanceOrder`, `SubOrder`, `Repuesto`, `HistorialMantenimiento` | **OK**: el reporte se lee de Pumping o QHSE por referencia; sub-órdenes con tipo, estado y transiciones en catálogo; repuesto de catálogo o de texto (`CHECK`) con salida de bodega; el historial es **derivado** (preventivos + órdenes). Horómetro y odómetro de salida y llegada: lecturas con fuente `reporte_unidad` (verificar que la llegada de Pumping las registre) |

| Id | Clase | Hueco | Propuesta |
|---|---|---|---|
| FL-1 | Falta | Firmas del conductor y del aprobador del gerenciamiento de viaje (la demo las guarda) | Por `plataforma/firmas`: evento `operaciones.flota.gerenciamiento_viaje.firmado` y tipo de documento en el catálogo de Firmas (junto con la adopción de C1) |
| FL-2 | Descartado | `gerenciamiento_viaje.pasajeros` es un texto con varios nombres | **Se queda como texto abierto** (decisión del usuario del 26/10/2026: no está definido quiénes serían los pasajeros) |
| FL-3 | Texto libre | `inspeccion_vehiculo.punto_partida/destino` son texto | Como OP-4: FK a bodega o pozo |
| FL-4 | Texto libre | `umbral_riesgo_viaje.permiso_autoriza` es el código de un permiso sin FK | FK a `identidad.permiso(codigo)` (las FK a identidad están permitidas, como las de auditoría) |

## 4. Inventario (revisado el 26/10/2026)

**OK.** `Articulo`: códigos alterno, comercial y de barras en `articulo_codigo` por tipo; categoría y subcategoría por FK; unidad por FK al catálogo compartido; stock **derivado** del kardex por bodega; costo y descuento sugerido. `ArticuloParte` y `MovimientoInventario` (kardex inmutable con saldo resultante y motivo por catálogo) completos. El despacho a bodega es CM-5.

## 5. QHSE (revisado el 26/10/2026)

Los subdominios construidos por S1 y S2 (desechos, derrames, emergencias, investigaciones, legales, objetivos y aspectos ambientales) se modelaron leyendo la demo campo por campo y registraron sus cambios de lógica en `PENDIENTES-DE-MIGRACION.md` §2.1: se dan por **OK**. De los anteriores:

| Modelo de la demo | Resultado |
|---|---|
| `Ptw` (+ documentos, firmas, matriz) | **OK**: documentos por FK a `documento_pedido`, firmas en `ptw_firma`, matriz IPERC en `ptw_matriz`; las marcas (`ptwCerrado`, `actaRecibimientoFirmada`…) se derivan |
| `SwaEvento` | **OK**: tipo de peligro y cadena de notificación en catálogo, reinicio con criterios, enlace a emergencia por FK |
| `StopCard` | **OK** salvo `equipoCodigo` (QH-1); observador y observado por FK, operadora y campo por FK |
| `Iperc` (+ tareas, peligros, controles, evaluador) | **OK**: evaluación GTC en columnas enteras, controles por momento y tipo, cargos y evaluadores en tablas puente |
| `EntregaEpi` | **OK**: trabajador por FK (no nombre y cargo), elemento y talla por FK; firmas por quién y cuándo (pasan a Firmas en C1) |
| `InspeccionEquipo` | Ver QH-1. `requiereMantenimiento` se **deriva** del resultado (un equipo rechazado genera `qhse.reporte_unidad.generado`) |
| `DashboardMetas` | **Falta**: tarea de C1 |

| Id | Clase | Hueco | Propuesta |
|---|---|---|---|
| QH-1 | Texto libre | El equipo inspeccionado es un código escrito (`inspeccion.equipo_codigo`, también en la demo) y la tarjeta STOP de la demo registra `equipoCodigo` que la base nueva no guarda. El indicador «% de inspecciones vigentes» agrupa por equipo: con texto libre, `EXT-01` y `ext 01` son dos equipos | Catálogo `qhse.equipo` (código único sin mayúsculas ni espacios, tipo por FK a `inspeccion_tipo`, descripción, unidad de Flota opcional, activo), con alta desde el mismo formulario de inspección; `inspeccion.equipo_id` con FK en lugar del texto; `stop_tarjeta.equipo_id` opcional con FK |

## 6. Resumen para la fase C

| Módulo | Huecos | Prioridad |
|---|---|---|
| Comercial | CM-1 a CM-5 | CM-5 (despacho) y CM-4 (unidades, toca seis tablas de tres contenedores) primero |
| Operaciones | OP-1 a OP-6 | OP-1 (herramientas de Pumping) y OP-3 (representante del cliente) |
| Flota | FL-1 a FL-4 | FL-2, FL-3 y FL-4 son migraciones pequeñas; FL-1 va con la adopción de Firmas |
| Inventario | — (CM-5 lo toca) | — |
| QHSE | QH-1, `DashboardMetas` | Ambos antes de los indicadores (C3) |
| Transversal | Adopción de Firmas, aviso de desechos, hojas de Mantenimiento, Reporte Diario (D-PD), permiso sin uso | Ya listados en C1 |
