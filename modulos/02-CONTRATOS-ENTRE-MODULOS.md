# Contratos entre módulos

Un contrato es lo único que un módulo puede asumir de otro. **Regla de oro:** el significado de un evento o endpoint ya publicado no cambia; solo se agregan campos o eventos nuevos (y se anota en el registro).

Estados: **Vigente** (ya existe y funciona), **Definido** (acordado, el productor aún no existe; el consumidor ya está listo), **Propuesto** (a acordar entre las sesiones involucradas).

## 1. Convenciones

- Sobre del evento (`@dyn/messaging`): `id`, `type`, `version`, `occurredAt`, `source` (contenedor que lo publica), `subject: { type, id }`, `data`, `actor?: { userId, role }`, `correlationId`, `causationId`, `traceparent`.
- Nombre: `<modulo>.<entidad>.<hecho en pasado>`. El `source` del suscriptor es el **contenedor** (`comercial`, `operaciones`, `qhse`, `plataforma`) o el módulo lógico que publica (`mantenimiento`, `flota`, `qhse`) según como se haya publicado: **use el mismo valor que usa el productor** y déjelo escrito aquí.
- Los eventos llevan **ids** y los campos de texto que sirven para avisos y no cambian (código, número de ticket). **No** llevan nombres de catálogos ni de personas que otro módulo pueda obtener con JOIN, salvo en los eventos de **avisos** (ver 5).
- Un evento con `asignados: [{ usuarioId, rolCodigo }]` pide a `avisos` que avise **solo a esas cuentas**, con la plantilla de la regla `evento + rolCodigo`.
- Todo consumidor usa `handleOnce` (idempotente) y debe ignorar sin error un evento que no entiende o al que le faltan datos.

## 2. Eventos vigentes (ya publicados)

| Evento | Publica | Datos principales | Lo consume |
|---|---|---|---|
| `comercial.pedido.abierto` | comercial | `codigo`, `ticketNumero`, `lineaServicio` (`pumping`/`fcr`), `tipoOt`, `tiposServicio[]`, `clienteId`, `campoId`, `bloqueId`, `pozoId`, `taladroId`, `rigless`, `numeroContrato`, `fechaInicioServicio`, `as2Numero` | pumping (crea el ticket); **FCR** deberá consumirlo igual |
| `comercial.pedido.estado_cambiado`, `.anulado`, `.facturado`, `.listo_para_facturar`, `.enviado_a_control_de_costos`, `.rechazado`, `.analista_asignado`, `.actualizado` | comercial | `codigo`, estados | reportería (futuro), avisos |
| `comercial.documento_operativo.recibido` | comercial | pedido, tipo, origen | avisos, reportería |
| `comercial.prefactura.*`, `comercial.guia.*`, `comercial.orden_trabajo.*`, `comercial.despacho.*` | comercial | ver el módulo | reportería; **Inventario** consumirá `despacho.solicitado`/`resuelto` |
| `operaciones.pumping.ticket_creado` | operaciones | `ticketId`, `ticketNumero`, `pedidoId`, `pedidoCodigo`, `cliente`, `campo`, `pozo`, `taladro`, `servicios`, `fechaInicioServicio` | avisos (Jefe de Base); **QHSE** (preparar PTW) |
| `operaciones.pumping.asignacion_realizada` | operaciones | los de arriba + `asignadoPor`, `supervisor`, `operadores` (texto), `unidades` (texto), `asignados[]`, `operadoresUnidades: [{ usuarioId, vehiculoId }]` | avisos; **QHSE** (abre la EPI de cada operador), **Flota** (abre la inspección de cada unidad), **Mantenimiento** (opcional) |
| `operaciones.pumping.salida_reportada` | operaciones | `ticketId`, `pedidoId`, `reportadoPor`, `unidades`, `asignados` (el supervisor) | avisos |
| `operaciones.pumping.paso_cambiado` | operaciones | `ticketId`, `pedidoId`, `desde`, `hacia` | reportería (futuro) |

## 3. Eventos definidos (el consumidor ya está hecho; falta el productor)

Los consume `libs/operaciones/pumping/src/consumers/requisitos-externos.consumer.ts` (mapa `REGLAS_EXTERNAS`). Cada uno cumple o reabre un **requisito** del ticket (`ticket_requisito`). Mientras el productor no exista, el requisito se confirma con el puente temporal (permiso `pumping.requisitos.puente`, con motivo).

| Evento | Productor | `source` | Datos obligatorios | Efecto en Pumping |
|---|---|---|---|---|
| `qhse.epi.despachada` | QHSE | `qhse` | `ticketId`, `usuarioId` (el operador que recibió el EPI) | cumple `epi_despachado` del operador |
| `qhse.epi.revertida` | QHSE | `qhse` | `ticketId`, `usuarioId` | reabre `epi_despachado` |
| `flota.inspeccion_vehiculo.realizada` | Flota | `flota` | `ticketId`, `vehiculoId` | cumple `inspeccion_vehiculo_realizada` de la unidad |
| `flota.inspeccion_vehiculo.anulada` | Flota | `flota` | `ticketId`, `vehiculoId` | reabre esa condición |
| `flota.inspeccion_vehiculo.aprobada` | Flota | `flota` | `ticketId`, `vehiculoId` | cumple `inspeccion_vehiculo_aprobada` (la aprueba el Supervisor al revisar la salida) |
| `flota.inspeccion_vehiculo.rechazada` | Flota | `flota` | `ticketId`, `vehiculoId` | reabre esa condición |
| `flota.gerenciamiento_viaje.aprobado` | Flota | `flota` | `ticketId`, `tipo` (`salida` o `retorno`) | cumple `gerenciamiento_viaje_salida_aprobado` (condición para salir de la revisión de reportes de salida) o `gerenciamiento_viaje_retorno_aprobado` (para salir del control de retorno) |
| `flota.gerenciamiento_viaje.rechazado` | Flota | `flota` | `ticketId`, `tipo` | reabre esa condición |

> **Estado de QHSE (16/10/2026): `qhse.epi.despachada` y `qhse.epi.revertida` ya son VIGENTES** (los publica el contenedor `qhse`, `source: 'qhse'`, con `ticketId`, `usuarioId` y además `entregaId`, `numero`, `codigo`, `ticketNumero`, `pedidoCodigo`, `trabajador`). QHSE publica también `qhse.epi.solicitada|aprobada|rechazada`.
>
> El `actor.userId` del evento queda como quien cumplió el requisito. La inspección de vehículos aplica **solo a unidades de tipo Transporte** (demo `main`); el gerenciamiento de viaje lo solicita el Conductor y lo autoriza el Supervisor si el riesgo es BAJO, o el Jefe de Base o el Gerente HSE si es MEDIO/ALTO.
>
> **Corrección pendiente en Pumping** (la hace la sesión de Pumping antes de que Flota empiece): el módulo dueño de la inspección de vehículos es **Flota**, no Mantenimiento; hoy el consumidor y el catálogo dicen `mantenimiento.inspeccion_vehiculo.*`. Se renombra a `flota.*` (ver el registro de cambios).

## 4. Contratos propuestos (a acordar al construir cada módulo)

### 4.1-bis Mantenimiento ↔ Inventario (repuestos) — **Vigente desde el 17/10/2026**
- **Selector:** `GET /api/operaciones/inventario/articulos/repuestos?q=<texto>` (mínimo 2 letras; máximo 30 resultados): artículos activos de las categorías con `es_repuesto`, con la existencia por bodega (solo bodegas con saldo).
- **Guardar el repuesto:** `suborden_repuesto` es **de catálogo** (`articulo_id` + `bodega_id`, sin texto: el código y el nombre se leen con JOIN) o **de texto** (`numero_parte` + `descripcion`, cuando no existe en Inventario). La base lo exige con un CHECK. Guardar el avance NO mueve stock.
- **Salida de bodega:** al aprobar el cierre el Jefe, Mantenimiento llama a `MovimientosService.registrarSalidasDeMantenimiento(lineas, actor)` con una línea por renglón de catálogo (`subordenRepuestoId` como llave de idempotencia). Inventario las registra en **una** transacción suya (todas o ninguna; stock insuficiente → 409 y no cambia nada), con el motivo del sistema «Consumo en mantenimiento» (origen `consumo_mantenimiento`), y devuelve el movimiento de cada línea. Después Mantenimiento cierra la sub-orden y guarda `movimiento_id` en cada renglón (FK a `inventario.movimiento`). Si el cierre se interrumpe entre una cosa y la otra, se repite: no se duplica la salida.
- **Por qué no es una sola transacción:** cada módulo tiene su cliente Prisma; no pueden compartir `tx`. La dependencia de FK va Mantenimiento → Inventario; por eso `inventario.salida_mantenimiento.suborden_repuesto_id` es un uuid sin FK (solo llave de idempotencia, con COMMENT).
- Un renglón con salida registrada no se puede cambiar ni borrar (trigger en la base).

### 4.1 Pumping ↔ Inventario (químicos) — **Vigente desde el 17/10/2026** (servicio de `@dyn/inventario`; lo consume Pumping)
- **Mismo contenedor, transacción propia de Inventario (corregido el 18/10/2026):** Pumping inyecta `MovimientosService` (exportado por `@dyn/inventario`), pero **no puede pasarle su `tx`**: cada módulo tiene su propio cliente de base de datos. Por eso Inventario ofrece métodos que abren **su** transacción: `registrarSalidasDeTicket(ticketId, lineas, actor)` (solo químicos; todas las líneas o ninguna), `devolverDeTicket(ticketId, lineas, actor)`, `registrarConsumoDeTicket(ticketId, articuloId, cantidad, actor)` y `quimicosDeTicket(ticketId)`. Los métodos con `tx` de abajo siguen existiendo para quien trabaje dentro de Inventario. **Cómo se mantiene la coherencia:** Pumping llama a la salida **dentro de su transacción, después de todas sus escrituras y antes del evento**; si algo falla después, Pumping deshace con `devolverDeTicket` (el kardex no se borra: queda la salida y su devolución). Si lo que falla es la salida (stock insuficiente), la transacción de Pumping se revierte sola. No usa HTTP ni importa tablas de Inventario.
- `registrarSalida(tx, { ticketPumpingId, articuloId, bodegaId, cantidad, observacion? }, actor)`: sale de la bodega y queda a cargo del ticket. Rechaza stock insuficiente (409 `STOCK_INSUFICIENTE`) y un ticket que no existe (`TICKET_INVALIDO`).
- `registrarConsumo(tx, { ticketPumpingId, articuloId, cantidad, observacion? }, actor)`: lo usado en la ejecución; **no mueve stock**. No puede superar lo que el ticket aún tiene a su cargo (`EXCEDE_LO_ASIGNADO`).
- `registrarDevolucion(tx, { ticketPumpingId, articuloId, bodegaId, cantidad, observacion? }, actor)`: lo no usado vuelve a bodega; tampoco puede superar lo que el ticket tiene a su cargo.
- `balanceDeTicket(ticketPumpingId, articuloId?)` (y `GET /api/operaciones/inventario/tickets/:ticketId/articulos`): **asignada, usada, devuelta y pendiente** por artículo, calculadas del kardex y del consumo (no se guardan en Pumping). `stockDe(articuloId, bodegaId?)`.
- Los químicos se listan con `GET /api/operaciones/inventario/articulos?quimicos=true&conStock=true` (categorías con la marca `es_quimica`).
- **Pumping guarda solo el `ticket_id` (suyo); no necesita guardar `salida_id`**: las salidas del ticket se obtienen de Inventario por `ticket_pumping_id` (FK real a `pumping.ticket`). FCR agregará su columna `ticket_fcr_id` en la misma tabla (ver el registro de cambios).
- **Eventos** (productor `operaciones`, el sobre exige ese prefijo; **reemplazan** a los `inventario.*` propuestos antes): `operaciones.inventario.salida_registrada` y `operaciones.inventario.devolucion_registrada` (datos: `movimientoId`, `articuloId`, `articuloCodigo`, `bodegaId`, `tipo`, `origen`, `cantidad`, `saldoResultante`, `ticketId`, `despachoId`), `operaciones.inventario.consumo_registrado` (`consumoId`, `articuloId`, `articuloCodigo`, `ticketId`, `cantidad`) y `operaciones.inventario.movimiento_registrado` (cualquier otro movimiento: compra, ajuste, despacho). Un hecho = un evento.
- **Despachos a bodega:** Inventario consume `comercial.despacho.solicitado` y `comercial.despacho.resuelto` (`pedidoId`; el segundo trae `archivoRespaldoId` y `archivoMsdsId`) y los refleja en `inventario.despacho`; Bodega registra las salidas de stock que lo respaldan.

### 4.2 Pumping/FCR → Mantenimiento (reporte de unidad de llegada)
- Al firmar la llegada de la unidad, Pumping publica `operaciones.pumping.reporte_unidad_llegada` con `ticketId`, `vehiculoId`, `reporteUnidadId`, y `hayNovedades` (bool). Mantenimiento crea su **reporte de unidad recibido** (clasificación MAN-001-A) con FK a `pumping.reporte_unidad` (mismo contenedor). Las novedades están en las columnas del reporte; no se copian.
- FCR publica el equivalente (`operaciones.fcr.reporte_unidad_llegada`) con la misma forma.
- **Estado (17/10/2026): Mantenimiento ya consume el evento** (`source: 'operaciones'`, `ticketId`, `vehiculoId`, `reporteUnidadId`, `hayNovedades`; el productor lo publica en la misma transacción que firma la llegada). Mantenimiento lee las novedades de `pumping.reporte_unidad` (FK real, mismo contenedor): **Pumping no debe renombrar ni quitar** `novedades_*`, `llegada_firmada_at`, `vehiculo_id` ni `ticket_id` de esa tabla sin avisar por el registro. Para el origen QHSE (otro contenedor, D1) el evento debe traer `casoId` y el texto de la novedad; solo ese texto se copia.

### 4.3 Mantenimiento → Flota (lecturas de la unidad)
- Mismo contenedor: Mantenimiento usa el servicio exportado de Flota para **actualizar horómetro/kilometraje** y registrar el mantenimiento preventivo (A/B, 5.000 km, 6 meses). Flota es dueña de `unidad` y de sus lecturas; nadie más escribe esas columnas.

### 4.4 Pumping/FCR ↔ Comercial (documentos operativos)
- **Corrección (demo `main`)**: Facturación puede corregir un día del Reporte Job (Pumping) o de la bitácora (FCR) **mientras el pedido no haya salido al cliente para firmas**; tras corregirlo, **el ticket ya no puede reenviar ese día**; el envío de cada día es **idempotente** (no duplica). Ver `plan-comercial-ajustes.md` (C3, C4).
- Hoy (**Vigente**): HTTP `POST /api/comercial/pedidos/:pedidoId/documentos-operativos` con el token de quien envía y el permiso `comercial.documentos_operativos.enviar`. Cuerpo: `tipo` (`reporte_job`/`reporte_herramientas`), `origen` (`pumping`/`fcr`), `ticketRef`, `fecha`, `firmadoPor`, `firmadoAt`, `supervisorId`, `operadorId` (ids de `identidad.usuario`), `actividades[]`, `herramientas[]`. Reemplaza el documento de la misma clave (pedido, tipo, origen, fecha).
- Evolución (**Propuesto**): evento `operaciones.pumping.reporte_diario_firmado` consumido por comercial, para no depender de HTTP entre contenedores.

### 4.5 QHSE → Pumping/FCR (bloqueos)
- **SWA** (Stop Work Authority): `qhse.swa.activado` / `qhse.swa.cerrado` con `ticketId`. En la demo `main` el bloqueo existe **solo en el frontend** (no en el backend); si Dynadrill lo confirma (D10), Pumping lo modelará como requisito (`swa_sin_activar`) y QHSE solo publica.
- **PTW**: `qhse.ptw.abierto`, `qhse.ptw.firmado`, `qhse.ptw.cerrado` con `ticketId`/`pedidoId` (un PTW por día de operación). Pumping podrá exigirlo antes de la ejecución (decisión del negocio, ver pendientes).
- **EPI** (ver sección 3).

### 4.6 QHSE ← Pumping (casos que QHSE abre)
- QHSE consume `operaciones.pumping.asignacion_realizada` y abre una **solicitud de EPI por cada operador** (`operadoresUnidades`/`asignados`) y consulta de términos. Consume `operaciones.pumping.ticket_creado` para preparar el PTW del pedido.

### 4.12 QHSE → Pumping (consulta de aceptaciones de términos) — **Propuesto**
- Las aceptaciones las guarda Pumping (`pumping.aceptacion_terminos`); QHSE no lee ese schema (otro contenedor). Pumping expone `GET /api/operaciones/pumping/terminos/aceptaciones?cedula=&nombre=` (permiso `pumping.terminos.historial`) que devuelve `{ id, ticketId, ticketNumero, pedidoCodigo, operador: { id, nombre, cedula }, versionCodigo, textoHash, aceptadoAt }[]`, con la cédula obtenida del perfil de la cuenta (JOIN). La pantalla de QHSE solo lo consume.

### 4.7 Flota ← Pumping (casos de inspección)
- Flota consume `operaciones.pumping.asignacion_realizada` y deja disponible, por cada `{ usuarioId, vehiculoId }`, el **caso de inspección de vehículos** (pendiente → por aprobar → aprobada). Publica los eventos de la sección 3.

### 4.10 Pumping/FCR → Comercial (prefactura desde el ticket y cierre)
- **Vista de la prefactura**: `GET /api/comercial/pedidos/:pedidoId/prefactura-vista` (permiso `prefacturaTicket`: Supervisor y Supervisor Pumping) devuelve la prefactura vigente o una **preliminar calculada al vuelo** (sin guardar), con los documentos de respaldo. **Propuesto.**
- **Firma del Company Man**: `POST /api/comercial/pedidos/:pedidoId/prefactura/firma-company-man` con el archivo firmado (módulo de archivos `prefactura_documento`). Solo cuando la documentación está completa; deja la prefactura **firmada** (el pedido pasa a `ticket_firmado`). **Propuesto.**
- **Cierre del ticket**: `operaciones.pumping.cerrado` / `operaciones.fcr.cerrado` (`ticketId`, `pedidoId`). Comercial **genera la prefactura** si la documentación de respaldo está completa y aún no existe; si no, la omite sin error (no debe fallar el cierre). **Propuesto.**

### 4.11 Acta de Entrega de Locación (QHSE → Pumping/FCR)
- El **Acta de Entrega de Locación (DYN-PMP-RE-027)** la sube el Supervisor al finalizar el ticket (una por pedido) y se guarda como documento QHSE (`qhse_formato_entrega`). **El ticket no se cierra sin ella** (el PTW ya no la pide). QHSE publica `qhse.documento.acta_entrega_cargada` (`pedidoId`) y Pumping/FCR la modelan como requisito de cierre (`acta_entrega_locacion`, dueño QHSE). **Propuesto.**

### 4.8 Todos → Reportería
- Todo módulo publica un evento por hecho de negocio relevante, **estable y con ids**. Reportería los proyecta en `reporting` (ver `plan-reporting-dashboard.md`). No hace falta que el productor sepa quién consume.

### 4.9 Todos → Auditoría
- La plataforma guarda, de forma inmutable, el rastro de los eventos de negocio (ver `plan-firmas-y-auditoria.md`). El productor solo cumple la convención de eventos.

## 5. Avisos (correo y campanita)

- Un evento que debe avisar a personas lleva `asignados: [{ usuarioId, rolCodigo }]` (aviso a esas cuentas) o, si es "a todos los que tengan un rol", no lleva `asignados` y la regla del evento aplica por rol.
- Las plantillas (asunto, cuerpo HTML y texto, título, enlace) se siembran en `libs/plataforma/avisos/src/catalog/plantillas/<modulo>.ts`. Las variables salen de los campos del evento (`{{ticketNumero}}`, `{{cliente}}`, ...); por eso los eventos **que avisan** sí pueden llevar textos ya resueltos (cliente, pozo) además de los ids.
- El enlace de la campanita apunta a la pantalla del módulo.

## 6. APIs HTTP públicas entre módulos

Un módulo puede exponer a otros **solo** a través de su `index.ts` (servicios inyectables del mismo contenedor) o de su ruta HTTP bajo el prefijo del contenedor. Entre contenedores distintos se usa HTTP interno con el token del usuario o eventos. **No** se leen tablas de otro módulo de negocio (solo las maestras: `catalogos`, `identidad`, `archivos`, y las de su mismo contenedor por FK).
