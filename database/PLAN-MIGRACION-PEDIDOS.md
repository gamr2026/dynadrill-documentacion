# Plan de migración del módulo Pedidos (demo → `comercial`)

> Fecha: 14/10/2026. Alcance de este documento: análisis y plan. No se modificó código ni bases de datos; los conteos salen de una lectura de solo lectura de `dynadrill-backend/prisma/dynadrill.db`. No contiene datos personales (solo conteos y nombres de campos).
> Referencias de diseño: `PROPUESTA-DESARROLLO-F0-F1.md` (§9 desviaciones, §10 decisiones del 14/10/2026) y el SQL `dynadrill_propuesta_v1.sql` (se encontró en `C:\Users\Digitec\Downloads\`, no está en `documentacion/database/`; las líneas citadas son de ese archivo).

> **Nota del 14/10/2026:** cómo debe nacer un pedido creado por Ventas (datos obligatorios, plantillas, analista de facturación, secuenciales de documentos y subida a AS2) está en `PLAN-PEDIDO-VENTAS-Y-SECUENCIALES.md`. Donde ese documento difiera del modelo de la §4 de este (columnas de texto de respaldo, `NOT NULL` de cliente, secuencia del código), **manda el nuevo** para pedidos nuevos; la §4 sigue valiendo para los migrados.

## 0. Resumen ejecutivo

1. En la demo, "Pedidos" no es un módulo aislado: vive dentro de **Facturación** (`libs/domains/facturacion`) y es la raíz de un ciclo (pedido → documentos operativos → prefactura → guía → AOT) cuyo **estado lo cambian nueve operaciones** repartidas entre prefactura, AOT, despacho a Bodega y el propio pedido.
2. Los módulos todavía en la demo (FCR, Pumping, QHSE) no llaman por HTTP a Pedidos: lo leen y lo escriben **en proceso y por tablas** (`prisma.pedido`, `PedidosService`, `FacturacionDomainService`). Como la demo no se modifica, esas rutas no se pueden re-apuntar: hay que mantener en la demo una copia del pedido (con el mismo id numérico) y resolver los pocos flujos demo → pedidos.
3. Se comparan tres alternativas (§6.3). **Se recomienda la C**: un solo dueño del ciclo comercial (contenedor `comercial`), cortado por el prefijo `/api/facturacion` que el gateway ya asigna a `comercial`, con **espejo unidireccional hacia la demo** (se escribe en la demo por su propia API, que además le crea los tickets FCR/Pumping y el PTW) y **lectura bajo demanda hacia la demo** para lo que aún vive allí. Se llega al corte pasando por una fase "sombra" sin tráfico de usuarios.
4. Los volúmenes son mínimos (10 pedidos, 30 eventos de historial, 6 prefacturas, 1 AOT): el riesgo no es el volumen sino el **acoplamiento** y los **contratos con id numérico**.
5. Hay dos prerrequisitos que hoy no existen en `dynadrill-platform`: el módulo `archivos` (con `libs/shared/storage`) y la política de ids numéricos de Pedido para el frontend (§2.4, §6.5).

---

## 1. Qué es hoy "Pedidos" en la demo

### 1.1 Ubicación del código (todas las rutas son de `C:\Users\Digitec\Documents\proyectos\dynadrill-backend`)

| Pieza | Archivo |
|---|---|
| Controller de Pedidos | `libs/domains/facturacion/src/pedidos/pedidos.controller.ts` |
| CRUD llano (lectura, alta, edición) | `libs/domains/facturacion/src/pedidos/pedidos.service.ts` (extiende `PrismaCrudService`) |
| Lógica de negocio real | `libs/domains/facturacion/src/facturacion-domain.service.ts` (1.362 líneas) |
| Mapas de estado, rol y macro-estado | `libs/domains/facturacion/src/pedidos/pedido-estados.maps.ts` |
| DTO de alta/edición | `libs/domains/facturacion/src/pedidos/pedidos.dto.ts` |
| Adjuntos reales | `.../pedidos/pedido-documentos.service.ts`, `pedido-documentos.constants.ts` |
| Documentos firmados | `.../pedidos/documentos-firmados.service.ts` |
| Bandeja de Bodega | `.../pedidos/solicitudes-despacho-bodega.controller.ts` |
| Línea de tiempo (genérica) | `libs/common/src/estados/timeline.ts`, `macro-estado.ts` |
| Roles | `libs/common/src/auth/module-roles.ts`, `role-code.ts` |
| Modelos Prisma | `prisma/schema.prisma`, líneas 175-398 (Facturación) y 406-534, 638, 786 (referencias) |

### 1.2 Endpoints (prefijo global `/api`)

`@Roles` de clase en `PedidosController`: `ModuleRoles.pedidos` (Facturación, Ingeniería de Ventas, Superadmin, Jefe de Base). Los métodos con su propio `@Roles` lo reemplazan.

| Método y ruta | Roles efectivos | Qué hace |
|---|---|---|
| `GET /facturacion/pedidos?estado=` | `pedidos` (4 roles) | Lista completa, **sin paginar**; agrega `timelineResumen` calculado |
| `GET /facturacion/pedidos/:id` | `pedidosRead` (14 roles) | Detalle; lo usan FCR, Pumping y QHSE (HSE) en solo lectura |
| `POST /facturacion/pedidos` | `pedidosCreate` (Ventas + admins) | Alta (ver §1.5, es la operación con más efectos) |
| `PUT /facturacion/pedidos/:id` | `pedidos` | Edición; revalida Técnico HSE y recalcula la prefactura si está `generada` |
| `DELETE /facturacion/pedidos/:id` | `pedidos` | **Borrado físico**; el frontend no lo invoca (no existe en `pedido.service.ts`) |
| `POST /facturacion/pedidos/sync-as2` | `pedidos` | Mock bidireccional: baja el siguiente pedido de la cola `PedidoPendienteAs2` |
| `PATCH /facturacion/pedidos/:id/estado` | `pedidos` | Cambio de estado **genérico, sin guarda de transición ni validación del valor** |
| `POST .../:id/rechazar` | `facturacion` (3) | Facturación devuelve el pedido a Ventas (`en_correccion`); exige motivo |
| `POST .../:id/anular` | `facturacion` | Cierre definitivo (`anulado`); exige motivo |
| `GET/POST .../:id/solicitud-despacho` | GET `pedidos`; POST `facturacion` | Solicitud de despacho a Bodega (exige estado `prefactura_generada`) |
| `GET .../:id/documentos` | `documentosOperativosRead` (7) | Documentos operativos del pedido |
| `GET/POST/DELETE .../:id/documentos-adjuntos[/:docId]` | GET `documentosOperativosRead`; POST y DELETE `pedidos` | Adjuntos reales (ficha de mezcla); DELETE borra fila y archivo |
| `GET/POST/DELETE .../:id/documentos-firmados[/:tipo/:referencia]` | GET `pedidos`; POST y DELETE `facturacion` | Versión firmada (RN: debe ir firmada antes de "Enviar al cliente") |
| `GET .../:id/avance` | `pedidos` | Avance documental; habilita "Generar prefactura" |
| `GET/POST .../:id/prefactura` | GET `pedidos`; POST `facturacion` | Prefactura del pedido (409 si ya hay una vigente, 422 si el respaldo está incompleto) |
| `GET/POST .../:id/guia-remision` | `pedidos` (ambos; **Ventas también puede generar la guía**) | Guía de remisión |
| `GET .../:id/aot` | `pedidos` | AOT del pedido |

Rutas vecinas del mismo prefijo que cambian el estado del pedido (se cortan juntas, ver §6): `GET/PATCH /facturacion/prefacturas[/:id/enviar|firmar|rechazar]`, `POST /facturacion/prefacturas/:id/aot`, `GET/PATCH /facturacion/aots`, `/facturacion/guias-remision`, `/facturacion/listas-precios`, `/facturacion/documentos-operativos` (el `POST` lo usan FCR y Pumping), `GET/POST /facturacion/solicitudes-despacho[/:id/despachar|rechazar]` (Bodega).

### 1.3 Modelos Prisma y conteos (SQLite `prisma/dynadrill.db`, 14/10/2026)

| Tabla | Filas | Notas |
|---|---:|---|
| `pedidos` | **10** | `id` autoincremental; `code` único (4 dígitos, de 4180 a 4316); `createdAt` guardado como número (epoch ms) |
| `PedidoPendienteAs2` | 1 | Cola del mock de AS2 (payload JSON) |
| `pedido_documentos` | 3 | Adjuntos; en disco `uploads/pedidos/` hay **12** archivos (9 sin fila: causa no verificada) |
| `documentos_firmados` | 20 | **10 son `qhse_*`** (Formato de Recepción, ART, PT, SFI) que QHSE guarda en la misma tabla; 10 son de Pedidos (`despacho_bodega` 2, `mezcla` 2, `monitoreo` 2, `prefactura` 2, `reporte_job` 2). En disco `uploads/pedidos-firmados/`: 20 archivos |
| `solicitudes_despacho_bodega` | 2 | Ambas `despachado` |
| `documentos_operativos` | 13 | `reporte_job` 11, `reporte_herramientas` 2 |
| `prefacturas` | 6 | `firmada` 5, `generada` 1 |
| `guias_remision` / `aots` | 0 / 1 | |
| `listas_precios` / `lista_precios_items` | 6 / 5.840 | 1 lista sin `clienteId` |
| `solicitudes_cambio_items` | 0 | Pumping, ver §3 |
| Referencian al pedido | `fcr_tickets` 2 de 9, `pumping_tickets` 4 de 7, `qhse_ptw` 3 de 6 | Los tickets tienen `pedidoId` único |
| `users` / `roles` | 24 / 16 | |

Columnas relevantes de `pedidos` (`schema.prisma` líneas 186-226): `id`, `code`, `origen`, `as2Ref`, `lastSyncedAt`, `cliente`, `clienteRuc`, `clienteId?`, `lineaServicio`, `tipoServicio` (JSON texto), `subTipoServicio` (JSON texto), `tipoOt`, `campo`, `bloque`, `pozo`, `taladroRig`, `numeroContrato`, `estado`, `historialEstados` (JSON texto), `payload` (JSON texto), `createdAt`, `createdBy`.

Claves encontradas dentro de `payload` (solo nombres): `agenteComercial`, `representanteCampo`, `representanteQuito`, `analistaFacturacion`, `condicionPago`, `zona`, `bodega`, `fechaInicioServicio`, `fechaFinServicio` (las 9 en los 10 pedidos); `itemEstimado` (7, forma antigua de una sola línea); `itemsEstimados` (3); `campoId`, `bloqueId`, `pozoId`, `nombreCompletoPozo`, `taladroId`, `tecnicoHseResponsableId`, `tecnicoHseResponsableNombre`, `solicitudMedio` (3 cada una); y una clave `id` sobrante en 7. Los cuatro responsables y los estimados son **texto libre**, no ids.

Calidad de datos medida (de 10 pedidos):

| Aspecto | Resultado |
|---|---|
| `clienteId` nulo | 7 (9 de 10 se resuelven por RUC contra `clientes_catalogo`; 1 no se resuelve) |
| Ids de ubicación (`pozoId`, `campoId`, `bloqueId`, `taladroId`) | Solo 3 pedidos los traen. Por nombre exacto (sin distinguir mayúsculas) se resuelven: campo 8, pozo 8, taladro 7, bloque **3** |
| Responsables resueltos por nombre exacto contra `personas_contacto` | agente comercial 4, representante de campo 5, representante Quito 10, analista de facturación 10 |
| `tecnicoHseResponsableId` | 3 pedidos, los 3 existen en `users` |
| Fechas de servicio | 10 de 10 con formato `AAAA-MM-DD` |
| Historial | 30 eventos en total (`estado`, `fecha`, `usuario` como nombre, `actorRol`, `macroEstado`); ningún pedido con historial vacío |
| Estados en datos | `abierto` 1, `en_operacion` 1, `en_elaboracion_operativa` 1, `documentos_completos` 1, `prefactura_generada` 1, `ticket_firmado` 1, `aot_generada` 1, `facturado` 3. Ningún `anulado`, `en_correccion`, `por_despachar_bodega` |
| Origen / línea / tipo de OT | `as2`+`fcr`+`venta` 3; `as2`+`pumping`+`venta` 4; `portal`+`pumping`+`servicio` 3 |
| Pedidos sin ticket FCR ni Pumping | 4 |

### 1.4 Máquina de estados (derivada del código; la demo no la valida como máquina)

Estados que el código conoce: los 14 de `PEDIDO_ESTADO_MACRO` (`pedido-estados.maps.ts`) más `en_revision_prefacturacion` (solo en `ESTADOS_RECHAZABLES`). El frontend añade `borrador`, `enviado_a_control_de_costos`, `listo_para_facturar` (`pedido.model.ts`, `EstadoPedido`).

| Disparador (método) | Desde | Hacia | Precondición real en código |
|---|---|---|---|
| Alta Portal (`PedidosController.create`) / `syncAs2` | — | `abierto` | Técnico HSE válido (solo alta Portal) |
| `rechazarPedido` (Facturación) | `abierto`, `en_operacion`, `en_elaboracion_operativa`, `documentos_completos`, `en_revision_prefacturacion` | `en_correccion` | Motivo obligatorio |
| `anularPedido` (Facturación) | cualquiera salvo `anulado`, `facturado` | `anulado` | Motivo obligatorio |
| `generarPrefactura` | (no valida el estado del pedido) | `prefactura_generada` | `calcularAvance().completo`; 409 si hay prefactura no rechazada |
| `solicitarDespachoBodega` | `prefactura_generada` | `por_despachar_bodega` | Sin solicitud pendiente; al menos un ítem |
| `despacharSolicitudDespacho` / `rechazarSolicitudDespacho` (Bodega) | `por_despachar_bodega` | `prefactura_generada` | Solicitud `pendiente` |
| `enviarPrefactura` | — | `enviado_para_firmas` | Prefactura existente |
| `firmarPrefactura` | — | `ticket_firmado` | |
| `rechazarPrefactura` (cliente) | — | `rechazado_por_cliente` y luego `en_correccion` (2 eventos) | Regenerar la prefactura rechazada reemplaza a la anterior |
| `generarAot` | — | `aot_generada` | Prefactura `firmada`; una AOT por pedido |
| `PATCH :id/estado` | **cualquiera** | **cualquier texto** | Ninguna (4 roles) |

Ningún método de dominio produce hoy `en_operacion`, `en_elaboracion_operativa`, `documentos_completos` ni `facturado` (solo aparecen en datos sembrados o por el `PATCH` genérico; ver comentario en `pedido-estados.maps.ts`). Terminales: `anulado` y `facturado`. Cada cambio añade un evento a `historialEstados` con `macroEstado` y `actorRol`; el evento inicial se sintetiza al armar el timeline si falta.

### 1.5 Reglas de negocio y efectos secundarios

- **Código** (`siguienteCodigoPedido`): mayor `code` numérico existente + 1, con piso en 4313. No es atómico (condición de carrera) y comparte secuencia con AS2 (Secuencial Tk Control).
- **Técnico HSE** (`validarTecnicoHseResponsable`): debe ser un usuario con rol `tecnico_hse` y `status` activo; el nombre lo resuelve el servidor, no el cliente. Se revalida en el `PUT` si cambia.
- **Validaciones del DTO** (`pedidos.dto.ts`): `origen` as2|portal; `lineaServicio` fcr|pumping; `tipoServicio` arreglo no vacío de 17 valores; `tipoOt` venta|servicio; `campo`, `bloque`, `pozo`, `taladroRig`, `numeroContrato`, `cliente`, `createdBy` texto. El resto (ítems, responsables, fechas, ids de catálogo) viaja en `payload` sin validación de forma.
- **Efectos del alta** (`create`, sin transacción): crea el pedido con historial inicial; si la línea es FCR crea un `FcrTicket` (`FCR-${200+n}`, fase `revision_inicial`, precarga las herramientas con `esHerramienta` cruzando con `articulos`); si es Pumping crea un `PumpingTicket` (`PUMP-2026-NNNNN`); en ambos casos pide a QHSE (`QhseDomainService.asegurarPtwDeServicio`) abrir el PTW, **ignorando el error si falla**.
- **Edición**: si la prefactura vigente está `generada`, se recalcula con los datos nuevos (`recalcularPrefacturaSiAplica`); una vez enviada o firmada queda congelada.
- **Avance documental** (`calcularAvance`): lee `documentos_operativos`, `guias_remision`, `qhse_ptw`, `pumping_tickets`, `fcr_tickets`, `pumping_documentos`, `pedido_documentos`, `documentos_firmados`, `solicitudes_despacho_bodega` y `qhse_derrames`. Es decir, **Facturación lee directamente las tablas de otros tres dominios**.
- **Prefactura**: IVA 15 %, retención IR 1 % del subtotal, retención de IVA 30 % del IVA; lista de precios por `clienteId` y, si no, por texto del cliente; si no hay coincidencia factura con el valor cotizado a mano (`personal_manual`) y deja una advertencia.
- **Adjuntos** (`TIPOS_ARCHIVO_DOCUMENTO_PEDIDO`): PDF, JPEG, PNG, docx, xlsx y CFB, tamaño máximo `maxUploadSizeBytes`, guardados en `uploads/pedidos/<pedidoId>/<uuid>.<ext>` y servidos solo autenticados. Firmados: `(pedidoId, tipo, referencia)` único, en `uploads/pedidos-firmados/<pedidoId>/`; `listar` excluye los `qhse_*`.
- **Hallazgo**: el frontend envía un archivo `msds` al despachar (`SolicitudesDespachoBodegaService.despachar`), pero el controller solo recibe `FileInterceptor('file')`: el MSDS **se descarta**. El SQL v1 ya prevé `msds` como tipo de documento firmado.
- **Notificaciones**: la demo no tiene un sistema de notificaciones propio para Pedidos. Hay dos sustitutos calculados al leer: el aviso "llegó hace <72 h" que arma el frontend con los documentos operativos (comentario de `module-roles.ts`, `documentosOperativosRead`) y los avisos de QHSE (`libs/domains/qhse/src/avisos/qhse-avisos.service.ts`) que consultan los pedidos de Pumping. No hay documentos operativos, prefactura, guía ni AOT disparados por eventos: todo es síncrono y en proceso.
- **Roles de la matriz** (`module-roles.ts`): `pedidos`, `pedidosCreate`, `pedidosRead`, `facturacion`, `documentosOperativosRead`, `documentosOperativosPush`, `listasPreciosRead`, `solicitudDespachoBodegaRead|Gestion`. Detalle y equivalencia en §5.

---

## 2. Qué consume el frontend (`C:\Users\Digitec\Documents\proyectos\dynadrill\dynadrill-frontend-platform`)

### 2.1 Servicio y contrato HTTP

Todo pasa por `src/app/features/facturacion/services/pedido.service.ts` (`PedidoService`, `ListaPreciosService`, `DocumentoOperativoService`, `PrefacturaService`, `GuiaRemisionService`, `AotService`, `SolicitudesDespachoBodegaService`), con `environment.apiUrl = '/api'`. `proxy.conf.json` apunta al gateway (`localhost:3100`). Modelo: `src/app/features/facturacion/models/pedido.model.ts`.

Contrato de `Pedido` que el frontend espera (nombres y tipos): `id: number`; `code: string`; `origen`; `as2Ref?`; `lastSyncedAt?` (ISO); `cliente`, `clienteRuc?`, `clienteId?: number`, `subcliente?`; `lineaServicio`; `tipoServicio: string[]`; `subTipoServicio?: string[]`; `tipoOt`; `campo`, `bloque`, `pozo`, `taladroRig` (texto); `campoId?`, `bloqueId?`, `pozoId?`, `taladroId?` (numéricos), `nombreCompletoPozo?`; `numeroContrato`; `agenteComercial`, `representanteCampo`, `representanteQuito`, `analistaFacturacion?` (**texto**); `tecnicoHseResponsableId: number` y `tecnicoHseResponsableNombre?`; `condicionPago?`, `zona?`, `bodega?`, `solicitudMedio?`; `itemsEstimados: ItemEstimado[]` (`codigo`, `descripcion`, `unidad`, `cantidad`, `valorUnitario`, `descuentoPorcentaje?`, `esQuimico?`, `esHerramienta?`, `esMovilizacion?`); `fechaInicioServicio?`, `fechaFinServicio?` (`AAAA-MM-DD`); `estado`; `historialEstados: {estado, fecha, usuario, motivo?, macroEstado?, actorRol?}[]`; `timelineResumen?` (calculado); `createdAt`, `createdBy` (nombre).

Otros contratos relevantes: la lista no está paginada; `anular` y `rechazar` envían `{usuario, motivo}`; `solicitarDespacho` envía `{usuario, bodegaOrigen, fechaRequerida, items, nota?}`; los adjuntos usan `multipart` con `file` y `descripcion`; los firmados van por `.../documentos-firmados/:tipo/:referencia`.

### 2.2 Pantallas y quién llama a qué

| Pantalla / componente | Llamadas a Pedidos |
|---|---|
| `pedidos-list-page` | `list()` + `DocumentoOperativoService.listTodos()` en un `forkJoin`; `sincronizarConAs2()` |
| `pedido-detail-page` | `get`, `solicitudDespacho`, `descargarDocumentoAdjunto|Firmado`, `subirDocumentoFirmado`, prefactura, guía, AOT, avance, documentos |
| `nuevo-pedido-dialog` | `create`, `update`, `listarDocumentosAdjuntos`, `subirDocumentoAdjunto`, `eliminarDocumentoAdjunto`; también `CatalogosService.clientes()`, `RolesService.usuariosPorRol('tecnico_hse')`, `ArticulosService.list`, `ListaPreciosService.list` |
| `anular-pedido-dialog`, `rechazar-pedido-dialog`, `solicitar-despacho-dialog`, `editar-representantes-dialog` | `anular`, `rechazar`, `solicitarDespacho`, `update` |
| `ver-pedido-dialog` | Solo lectura; se abre desde Pumping (`ticket-detail-page`) y QHSE (`ptw-list-page`) |
| `prefacturas-list-page`, `prefactura-detail-page`, `reporteria-page`, `dashboard-page` | `pedidoService.list()` (todas cargan todos los pedidos) |
| FCR `ticket-detail-page` (línea 2060), Pumping `ticket-detail-page` (líneas 2126, 2130, 2219) | `get(ticket.pedidoId)` y `listarDocumentosAdjuntos(p.id)` con el `pedidoId` **numérico** del ticket |
| `despachos-bodega-list-page`, `gestionar-despacho-dialog` (Inventario) | `SolicitudesDespachoBodegaService` |
| `OperativoDocsBridgeService` (shared) | `POST /facturacion/documentos-operativos` con `pedidoCode` (por código, no por id) |
| QHSE `documentos-pedidos-page` | `/api/qhse/pedidos` (lo sirve QHSE, no Facturación) |

### 2.3 Ids y el puente actual

- En `routes.ts` del gateway (`apps/gateway/src/app/routes.ts`) el prefijo `/api/facturacion` ya está asignado a `comercial`, pero `COMERCIAL_URL` está comentado en `apps/gateway/.env`, así que hoy cae en la demo.
- El frontend ya usa el patrón de transición `conIdLegacy`/`legacyId` para usuarios (ej. `nuevo-pedido-dialog.ts` línea 957 ofrece solo técnicos HSE con `legacyId`, porque `tecnicoHseResponsableId` viaja a la demo como número). Ese comentario dice textualmente que se retira "cuando facturación/pedidos migre".
- **No verificado**: `/api/catalogos` **no figura** en `ROUTE_RULES` (comentario "se agregan `/api/catalogos` y `/api/files` cuando existan esos módulos") y el frontend modela los catálogos con `id: number` (`shared/models/catalogos.model.ts`). El módulo `catalogos` está montado en `apps/plataforma`, pero según el código leído el gateway todavía no le enruta tráfico. Confirmar si ya hay un cambio local no versionado (el `git status` de `dynadrill-platform` muestra archivos eliminados ajenos a este tema).

### 2.4 Consecuencia para el contrato del nuevo backend

Mientras haya tickets en la demo, `ticket.pedidoId` seguirá siendo un entero. Por eso el nuevo `GET /facturacion/pedidos/:id` debe aceptar **UUID o entero (resuelto por `legacy_id`)** y devolver `id` (UUID) más `legacyId`, como ya hacen `identidad` y `catalogos`. Los ids de Prefactura, AOT, guía y documento operativo viajan hoy como números en rutas del frontend (`/prefacturas/:id`, `/aots/:id`): llevan el mismo tratamiento.

---

## 3. Dependencias con otros módulos

### 3.1 De Pedidos hacia otros

| Dependencia | Cómo es hoy | Qué implica |
|---|---|---|
| Catálogos (cliente, campo, bloque, pozo, taladro, personas) | `clienteId` (FK real a `clientes_catalogo`) y los demás ids dentro de `payload`; texto de respaldo en columnas | Los ids ya tienen equivalente en `catalogos.*.legacy_id` (6 tablas, hecho). Falta resolver 7 pedidos sin `clienteId` y los 7 sin ids de ubicación |
| Usuarios (identidad) | `tecnicoHseResponsableId` (id numérico de `users`) validado con `prisma.user` | Se valida contra `identidad` (UUID, con `usuario.legacy_id`). Sin FK entre schemas: puerto o réplica (§4.3) |
| FCR | Al crear: `FcrTicket` con `pedidoId`; `calcularAvance` lee `fcr_tickets` | Escritura (creación) y lectura |
| Pumping | Igual, `PumpingTicket` + `pumping_documentos` (monitoreo/mezcla); `heredarDatosDelPedido` lee `pedido` | Escritura y lectura |
| QHSE | Alta abre el PTW (`asegurarPtwDeServicio`); `calcularAvance` lee `qhse_ptw` y `qhse_derrames`; `documentos_firmados` compartida (`qhse_*`) | Escritura y lectura |
| Inventario | `resolverHerramientasDelPedido` lee `articulos` y `movimientos_inventario`; la Solicitud de Despacho es de Bodega | Lectura; la solicitud cambia el estado del pedido |
| Mantenimiento | No hay referencia al pedido (verificado: `pedidoId` no aparece en sus tablas ni servicios) | Sin dependencia |
| AS2 | `sync-as2` es un mock; `as2Ref`, `lastSyncedAt` | El módulo `integraciones` ya existe; falta decidir si reemplaza al mock (pregunta 5) |

### 3.2 De otros hacia Pedidos (quién referencia `pedido_id`)

| Quién | Cómo lo usa | Dirección del acceso |
|---|---|---|
| `fcr_tickets.pedidoId` (FK, único) y `fcr-domain.service.ts` (líneas 435-470) | Al aprobar reportes / enviar un día, empuja `documentos_operativos` con `FacturacionDomainService.pushDocumentoOperativo` **en proceso** | **Demo → pedidos (escritura)** |
| `pumping_tickets.pedidoId` (FK, único) y `pumping-tickets.service.ts` (líneas 70-100) | Lee `prisma.pedido` para heredar `numeroContrato` y `taladroRig` | Demo lee pedido |
| `solicitudes-cambio-items-domain.service.ts` (líneas 55-75) | Al aprobar, `PedidosService.update(itemsEstimados)` y `recalcularPrefacturaSiAplica` | **Demo → pedidos (escritura)** |
| `qhse_ptw.pedidoId` (FK) y `qhse-domain.service.ts` (líneas 264-400, 590-650) | PTW por pedido; resuelve el pedido desde el código del ticket | Demo lee/escribe su propia tabla con el id del pedido |
| `qhse-documentos.service.ts` | `documentos_firmados` por `pedidoId`, tipos `qhse_*`; lee `pumping_tickets` | Demo, sobre su propia tabla |
| `qhse-avisos.service.ts` | Avisos por pedido de Pumping | Demo lee |
| Frontend (FCR, Pumping, QHSE) | `GET /facturacion/pedidos/:id` con el `pedidoId` del ticket | Vía gateway (se resuelve en el contrato, §2.4) |

Conclusión: las únicas **escrituras demo → pedidos** son dos (documentos operativos desde FCR, y aprobación de cambio de ítems desde Pumping). Las demás son lecturas.

---

## 4. Modelo de datos propuesto en PostgreSQL (`schema comercial`)

### 4.1 Base y principios

Base: DDL de `dynadrill_propuesta_v1.sql` líneas 300-423 (`pedido`, `pedido_tipo_servicio`, `pedido_subtipo_servicio`, `pedido_item`, `pedido_historial_estado`, `pedido_documento`, `pedido_documento_firmado`, `as2_pedido_pendiente`) y 425-639 para el resto del ciclo (`lista_precios`, `documento_operativo*`, `prefactura*`, `guia_remision*`, `aot*`). Principios heredados: UUIDv7 generado por la aplicación; sin FK entre schemas (las FK dentro de `comercial` sí, líneas 2467 y siguientes del SQL); la aplicación `app_comercial` no tiene `DELETE` (anulación y borrado lógico); `legacy_id` transitorio con el mismo patrón que `rol`, `usuario` y `catalogos` (se elimina al migrar el último módulo que usa ids enteros); outbox en `msg_comercial.outbox` (ya existe en `infra/db/init`, junto con el rol `app_comercial`).

### 4.2 Estructura de módulo

`libs/comercial/pedidos/` con la misma forma que `libs/plataforma/catalogos` (`prisma/schema.prisma` con `schemas = ["comercial"]`, `prisma.config.ts`, `migrations/`, `controllers/`, `services/`, `dto/`, `prisma/migrate-from-demo.ts`) y `apps/comercial` (hoy no existe). Mapeos de tag/`tsconfig.base.json` `@dyn/pedidos`. Scripts npm `db:migrate:comercial`, `db:migrate-demo:comercial`.

### 4.3 Desviaciones respecto del SQL v1 (para revisión del supervisor, mismo formato que §9 de `PROPUESTA-DESARROLLO-F0-F1.md`)

| # | Cambio | Dónde | Motivo (con el dato que lo respalda) | Carácter |
|---|---|---|---|---|
| D1 | `cliente_id` pasa de `NOT NULL` a **nulo permitido**; se conservan `cliente_nombre` y `cliente_ruc` como instantánea | `pedido` | 7 de 10 pedidos no traen `clienteId`; 1 de 10 no se resuelve ni por RUC. Los pedidos de AS2 llegan con texto. `CHECK (cliente_id IS NOT NULL OR cliente_ruc IS NOT NULL)` | Permanente |
| D2 | Columnas de texto `campo_nombre`, `bloque_nombre`, `taladro_nombre`, `pozo_codigo`; `campo_id`, `bloque_id`, `pozo_id`, `taladro_id` siguen nulos | `pedido` | El contrato del frontend exige `campo`, `bloque`, `pozo`, `taladroRig` como texto; solo 3 de 10 pedidos traen ids; por nombre exacto el bloque se resuelve en 3 de 10. El SQL v1 solo tenía ids y `pozo_nombre` | Permanente (instantánea histórica) |
| D3 | `agente_comercial_nombre`, `representante_campo_nombre`, `representante_quito_nombre`, `analista_facturacion_nombre`, `tecnico_hse_nombre` (texto); los `*_id` quedan nulos hasta resolverse | `pedido` | En la demo los cuatro responsables son texto libre en los 10 pedidos; coinciden con `personas_contacto` en 4, 5, 10 y 10 casos respectivamente. Los documentos impresos usan el nombre | Permanente |
| D4 | `usuario_nombre` (texto) y `usuario_id` nulo | `pedido_historial_estado` | El historial de la demo guarda el nombre (30 de 30 eventos), no un id | Permanente |
| D5 | `creado_por_nombre` (texto); `created_by` nulo en filas migradas | `pedido` | `createdBy` de la demo es un nombre, no un id | Permanente |
| D6 | Secuencia `comercial.pedido_codigo_seq`; `codigo` sigue `UNIQUE` | `pedido` | `siguienteCodigoPedido` hace máximo + 1 sin bloqueo (carrera). La secuencia arranca en `max(codigo)+1` al migrar | Permanente |
| D7 | `legacy_id integer UNIQUE` | `pedido`, `prefactura`, `aot`, `guia_remision`, `documento_operativo`, `lista_precios` | Los tickets y el frontend referencian por id entero; los hijos para enlaces profundos | **Transitoria** |
| D8 | Tabla `solicitud_despacho` (y `solicitud_despacho_item`) **temporalmente en `comercial`**, con la forma exacta de `inventario.solicitud_despacho` (SQL líneas 696-740) | `comercial` | El SQL v1 la ubica en `inventario`, que aún no existe, y su resolución cambia el estado del pedido (`por_despachar_bodega` ⇄ `prefactura_generada`). 2 filas | **Transitoria** (se mueve a `inventario` y pasa a evento) |
| D9 | `pedido_documento.archivo_id` y `pedido_documento_firmado.archivo_id` exigen el módulo `archivos` | `pedido_documento*` | El módulo `archivos` y `libs/shared/storage` no existen en `dynadrill-platform` (verificado: `libs/shared` solo tiene `authz`, `common`, `config`, `messaging`, `utils`). No se propone una columna de ruta local: se hace `archivos` antes (F3) | Prerrequisito |
| D10 | Tabla `comercial.migracion_control (clave, valor)` con la marca `corte_realizado` | `comercial` | Permite que la migración sea repetible durante la fase sombra (la demo es maestra) y se niegue a sobrescribir después del corte | **Transitoria** |
| D11 | `pedido.estado` por defecto `abierto` en la aplicación (el DDL mantiene `borrador`) | API | La demo nunca crea en `borrador`; el DDL no cambia, solo lo que la API envía | Sin cambio de DDL |
| D12 | `as2_pedido_pendiente`: **no se migra la cola mock** (1 fila de datos de prueba); queda la tabla del SQL v1 para la integración real | `as2_pedido_pendiente` | `as2_ref NOT NULL UNIQUE` no se cumple en la cola mock; la sincronización real debe salir del módulo `integraciones` | Pendiente de decisión (pregunta 5) |

Sin desviación (se adopta tal cual): `pedido_tipo_servicio` con los 17 valores del `CHECK`, `pedido_subtipo_servicio`, `pedido_item` (`es_quimico`, `es_herramienta`, `es_movilizacion`), `estado` con los 17 valores del `CHECK` (los 8 estados presentes en los datos están incluidos), `anulado_at`/`motivo_anulacion`, `version` (control optimista de concurrencia: nuevo, la demo no lo tiene), los `CHECK` de `pedido_documento_firmado.tipo` (no incluye los `qhse_*`, que son de QHSE).

### 4.4 Reglas de modelo

- **Sin `DELETE`**: `DELETE /pedidos/:id` de la demo se **retira** (el frontend no lo usa). Eliminar un adjunto o un firmado pasa a ser anulación lógica (estado + `anulado_at`; el archivo se retiene según `archivos.retener_hasta`).
- **Borrado lógico vs. anulación**: el pedido se anula (`anulado`); los adjuntos y firmados se marcan `eliminado` en `archivos.archivo` y se ocultan en la lista.
- **Estado y reglas en código** (no solo en el `CHECK`): una tabla de transiciones permitidas por estado (derivada de §1.4). El `PATCH :id/estado` genérico se acota a los destinos válidos (hoy acepta cualquier texto). Se conserva el permiso como en la demo (§5) y se registra la decisión de endurecerlo después (pregunta 6).
- **Historial**: `pedido_historial_estado` se escribe en la misma transacción que el cambio de estado; `macro_estado` y `actor_rol` se conservan. El mapa estado → macro-estado y estado → rol responsable (`pedido-estados.maps.ts`) y `buildTimelineResumen` (`libs/common/src/estados/timeline.ts`) se portan a una lib compartida o al módulo (no existen en `dynadrill-platform`: verificado con `grep`).
- **Dinero y fechas**: `numeric(14,2)`, fechas `date`/`timestamptz` UTC (`libs/shared/utils`).

### 4.5 Eventos al outbox (`msg_comercial.outbox`, formato de `libs/shared/messaging/src/lib/envelope.ts`: `comercial.<entidad>.<hecho_en_pasado>`, versión 1, ids y datos mínimos)

| Evento | Cuándo | Datos mínimos | Consumidores previstos |
|---|---|---|---|
| `comercial.pedido.abierto` | Alta (Portal o AS2) | `pedido_id`, `legacy_id`, `codigo`, `linea_servicio`, `tipo_ot`, `tipos_servicio[]`, `cliente_id?`, `pozo_id?`, `campo_id?`, `bloque_id?`, `taladro_id?`, `numero_contrato`, `fecha_inicio_servicio`, `codigos_herramienta[]` | `operaciones` (ticket FCR/Pumping), `qhse` (PTW), espejo a la demo, `reporting` |
| `comercial.pedido.actualizado` | Edición de datos | `pedido_id`, campos cambiados (lista) | espejo a la demo, `reporting` |
| `comercial.pedido.estado_cambiado` | Cada transición | `pedido_id`, `estado_anterior`, `estado_nuevo`, `macro_estado`, `motivo?` | espejo, `avisos`, `auditoria`, `reporting` |
| `comercial.pedido.anulado` y `comercial.pedido.rechazado` | Anulación / rechazo a Ventas | `pedido_id`, `motivo` | `operaciones`, `qhse` (congelar el ticket) |
| `comercial.pedido.items_modificados` | Cambio de ítems | `pedido_id`, `version` | recálculo de prefactura (interno), `pumping` |
| `comercial.prefactura.generada|enviada|firmada|rechazada`, `comercial.aot.generada|firmada`, `comercial.guia_remision.generada`, `comercial.documento_operativo.recibido` | Resto del ciclo | ids y estado | `avisos`, `reporting` |
| Consumidos: `inventario.despacho.despachado|rechazado` | Resolución de Bodega (cuando exista `inventario`) | `solicitud_id`, `pedido_id` | transición `por_despachar_bodega` → `prefactura_generada` |
| Consumidos: eventos de `operaciones` (ticket iniciado, reportes aprobados) | Futuro | | transiciones a `en_operacion`, `en_elaboracion_operativa`, `documentos_completos`, hoy sin productor (§1.4, pregunta 7) |

Los efectos que hoy son llamadas en proceso (crear tickets, abrir PTW) pasan a ser **consumidores** de `comercial.pedido.abierto`; mientras operaciones/QHSE estén en la demo, el espejo (§6.4) hace ese papel.

---

## 5. Permisos propuestos (`comercial.<recurso>.<accion>`) y equivalencia con los roles actuales

### 5.1 Punto de partida en el código nuevo

`libs/shared/authz/src/lib/permissions.ts` ya define, para comercial: `comercial.pedidos.gestionar` (matriz `pedidos`), `comercial.pedidos.crear` (`pedidosCreate`), `comercial.pedidos.ver` (`pedidosRead`), `comercial.facturacion.gestionar`, `comercial.listas_precios.ver`, `comercial.documentos_operativos.ver|enviar`, `inventario.despachos.ver|gestionar`. Los permisos de un rol los edita un administrador desde la app y `@RequirePermission(...)` exige **al menos uno** de los listados (`libs/shared/common/src/lib/auth/guards.ts`). El mecanismo para cambios de catálogo sin quitar acceso es `PERMISSION_REPLACEMENTS` + `syncPermisos` (`libs/plataforma/identidad/src/catalog/sync-permisos.ts`): el viejo se retira y todos sus titulares reciben los nuevos.

### 5.2 Conjuntos de roles de la demo (de `module-roles.ts`)

- `pedidos` = facturacion, ingenieria_ventas, superadmin, jefe_base (4)
- `pedidosCreate` = ingenieria_ventas, superadmin, jefe_base (3)
- `facturacion` = facturacion, superadmin, jefe_base (3)
- `pedidosRead` (14) = `pedidos` + ingenieria_ventas_fcr, supervisor, supervisor_pumping, operador, operador_fcr, bodeguero, supervisor_operaciones_fcr, tecnico_hse, coordinador_hse, gerente_hse
- `documentosOperativosRead` (7) = facturacion, ingenieria_ventas, supervisor, supervisor_pumping, operador, superadmin, jefe_base

### 5.3 Catálogo propuesto para el ciclo de Pedidos (semilla = el mismo conjunto de roles que hoy)

Se conservan los códigos existentes `comercial.pedidos.crear` y `comercial.pedidos.ver` (mismo significado y mismos roles: ningún rol gana ni pierde) y se **retira** `comercial.pedidos.gestionar` con traspaso a sus sustitutos (los 4 roles que lo tienen reciben todos). Las acciones propias del negocio van aparte de las estándar.

| Código nuevo | Acción | Semilla | Endpoint(s) de la demo que reemplaza | Origen en la matriz |
|---|---|---|---|---|
| `comercial.pedidos.listar` | propia | `pedidos` (4) | `GET /pedidos` | `pedidos` |
| `comercial.pedidos.ver` *(existe)* | estándar | `pedidosRead` (14) | `GET /pedidos/:id` | `pedidosRead` |
| `comercial.pedidos.crear` *(existe)* | estándar | `pedidosCreate` (3) | `POST /pedidos` | `pedidosCreate` |
| `comercial.pedidos.editar` | estándar | `pedidos` (4) | `PUT /pedidos/:id` | `pedidos` |
| `comercial.pedidos.cambiar_estado` | propia | `pedidos` (4) | `PATCH /pedidos/:id/estado` | `pedidos` |
| `comercial.pedidos.rechazar` | propia | `facturacion` (3) | `POST :id/rechazar` | `facturacion` |
| `comercial.pedidos.anular` | estándar | `facturacion` (3) | `POST :id/anular` | `facturacion` |
| `comercial.pedidos.sincronizar_as2` | propia | `pedidos` (4) | `POST sync-as2` | `pedidos` |
| `comercial.pedidos_adjuntos.ver` | estándar | `documentosOperativosRead` (7) | `GET :id/documentos-adjuntos[/:docId]` | `documentosOperativosRead` |
| `comercial.pedidos_adjuntos.crear` | estándar | `pedidos` (4) | `POST :id/documentos-adjuntos` | `pedidos` |
| `comercial.pedidos_adjuntos.anular` | estándar | `pedidos` (4) | `DELETE :id/documentos-adjuntos/:docId` | `pedidos` |
| `comercial.pedidos_firmados.ver` | estándar | `pedidos` (4) | `GET :id/documentos-firmados[...]` | `pedidos` |
| `comercial.pedidos_firmados.crear` | estándar | `facturacion` (3) | `POST .../documentos-firmados/:tipo/:referencia` | `facturacion` |
| `comercial.pedidos_firmados.anular` | estándar | `facturacion` (3) | `DELETE .../documentos-firmados/...` | `facturacion` |
| `comercial.pedidos.solicitar_despacho` | propia | `facturacion` (3) | `POST :id/solicitud-despacho` | `facturacion` |
| `comercial.pedidos.ver_solicitud_despacho` | propia | `pedidos` (4) | `GET :id/solicitud-despacho` | `pedidos` |
| `comercial.avance.ver` | estándar | `pedidos` (4) | `GET :id/avance` | `pedidos` |
| `comercial.documentos_operativos.ver|enviar` *(existen)* | estándar / propia | `documentosOperativosRead` (7) / `documentosOperativosPush` (5) | `GET :id/documentos`, `GET/POST /documentos-operativos` | sin cambio |
| `comercial.prefacturas.ver` (`GET :id/prefactura` y rutas de prefactura) | estándar | `pedidos` (4) para `GET :id/prefactura`; `facturacion` (3) para `/prefacturas` | | `pedidos` / `facturacion` |
| `comercial.prefacturas.crear` (generar) y `comercial.prefacturas.editar` (enviar, firmar, rechazar) | estándar | `facturacion` (3) | `POST :id/prefactura`, `PATCH /prefacturas/:id/*` | `facturacion` |
| `comercial.guias_remision.ver` / `.crear` | estándar | `pedidos` (4) ambos | `GET/POST :id/guia-remision` | `pedidos` (hoy Ventas también genera la guía) |
| `comercial.aots.ver` / `.crear` / `.editar` | estándar | `pedidos` (4) / `facturacion` (3) | `GET :id/aot`, `POST /prefacturas/:id/aot`, `PATCH /aots/:id/firmar` | `pedidos` / `facturacion` |
| `comercial.listas_precios.ver` *(existe)*, `.crear`, `.anular` | estándar | `listasPreciosRead` (4) / `facturacion` (3) | `GET/POST/DELETE /listas-precios` | `listasPreciosRead` / `facturacion` |
| `inventario.despachos.ver` / `.gestionar` *(existen)* | | `solicitudDespachoBodegaRead` (4) / `Gestion` (3) | `GET /solicitudes-despacho`, `POST .../despachar|rechazar` | sin cambio |

`PERMISSION_REPLACEMENTS` propuesto: `comercial.pedidos.gestionar` → `listar`, `editar`, `cambiar_estado`, `sincronizar_as2`, `pedidos_adjuntos.crear`, `pedidos_adjuntos.anular`, `pedidos_firmados.ver`, `ver_solicitud_despacho`, `avance.ver`, `prefacturas.ver`, `guias_remision.ver`, `guias_remision.crear`, `aots.ver`. `comercial.facturacion.gestionar` → los de `facturacion` (`rechazar`, `anular`, `solicitar_despacho`, `pedidos_firmados.crear|anular`, `prefacturas.crear|editar`, `aots.editar`, `listas_precios.crear|anular`). Se crean por fases (cada código se agrega en la fase que migra su endpoint; el viejo se retira al final).

### 5.4 Cómo se verifica "nadie gana ni pierde acceso el día uno"

1. **Prueba de paridad generada**: un script lee `module-roles.ts` de la demo y los `@Roles` de cada endpoint (§1.2) y produce la matriz rol × endpoint esperada (16 roles × ~35 endpoints). Una prueba del contenedor `comercial` autentica con un token por rol y exige el mismo permitido/denegado. Falla si difiere una sola celda.
2. Comparación de `identidad.rol_permiso` antes y después de `syncPermisos`: el número de roles con acceso a cada grupo debe coincidir con el de §5.2.
3. Hallazgos que la prueba debe respetar tal cual (son comportamiento actual, no errores del plan): Ventas puede generar guías (`POST :id/guia-remision` hereda `pedidos`); `PATCH :id/estado` está abierto a 4 roles; `GET :id` (detalle) está abierto a 14 roles y `GET` de lista solo a 4.
4. **Pendiente de verificar**: si `comercial.pedidos.*` ya está sembrado en `identidad` (debe consultarse con un conteo de solo lectura de `identidad.permiso` y `identidad.rol_permiso`; no se consultó PostgreSQL en este análisis).
5. Los tokens llevan los permisos (`AuthUser.permissions`): tras cada sincronización de permisos hay que volver a iniciar sesión (las sesiones previas conservan los permisos antiguos hasta renovarse).

---

## 6. Migración de datos y coexistencia con la demo

### 6.1 Script de migración SQLite → PostgreSQL

`libs/comercial/pedidos/prisma/migrate-from-demo.ts`, mismo patrón que `libs/plataforma/catalogos/prisma/migrate-from-demo.ts` (usa `node:sqlite` en solo lectura, `PrismaPg` con schema `comercial`, informe por tabla). Requisitos de diseño:

- **Orden**: precondiciones `identidad` y `catalogos` ya migrados (se resuelven por `legacy_id`; la lectura de `catalogos.*` e `identidad.usuario` la hace el script con la conexión del migrador, no la aplicación). Luego: `pedido` → `pedido_tipo_servicio` → `pedido_subtipo_servicio` → `pedido_item` → `pedido_historial_estado` → (con `archivos`) `pedido_documento` y `pedido_documento_firmado` → resto del ciclo (documentos operativos, prefactura, guía, AOT, listas de precios, solicitud de despacho).
- **Idempotente**: clave `legacy_id` única; una corrida repetida no duplica. Antes del corte (la demo es maestra), un pedido **sin ediciones propias** (`updated_by IS NULL`, `version = 1`) se refresca con lo que tenga la demo; después del corte (`migracion_control.corte_realizado`) el script se niega a sobrescribir nada y solo completa enlaces.
- **Transformaciones**: `createdAt` de epoch ms a `timestamptz`; `tipoServicio` y `subTipoServicio` de JSON a filas hijas; `itemEstimado` (forma antigua, 7 pedidos) e `itemsEstimados` (3 pedidos) se normalizan a `pedido_item` con `orden` (resultado esperado: **10 ítems**, ningún pedido tiene ambas formas); `historialEstados` a `pedido_historial_estado` (esperado **30** filas; `usuario` → `usuario_nombre`); `payload` aplanado a columnas; se descarta la clave sobrante `id` del payload.
- **Resolución de referencias** (con informe de no resueltos, nunca se inventa un id): `cliente_id` por `clienteId` o, si es nulo, por `clienteRuc` (esperado 9 de 10); ids de ubicación por los que traiga el payload (3 pedidos) y, si faltan, por nombre exacto (campo 8, pozo 8, taladro 7, bloque 3); responsables por nombre exacto contra `catalogos.persona_contacto` (4, 5, 10, 10); `tecnico_hse_id` por `usuario.legacy_id` (3 de 3). Lo no resuelto queda en columnas de texto (D1-D3) y en el informe.
- **Archivos**: `uploads/pedidos/` (12 archivos, 3 filas) y `uploads/pedidos-firmados/` (20 archivos, 10 filas de Pedidos y 10 `qhse_*`) se suben al almacenamiento de `archivos` (Azurite); los `qhse_*` **no** se migran aquí (los migra QHSE a `qhse.documento_pedido`); se reportan los archivos sin fila (esperado: 9 en `uploads/pedidos/`).
- **Informe final** (por tabla): filas en la demo, creadas, enlazadas, ya migradas, omitidas con motivo, no resueltas por referencia, más una **suma de verificación por pedido** (`codigo`, `estado`, `numero_contrato`, número de ítems y de eventos) comparada contra la demo. Resultados esperados con los datos de hoy: 10 / 10 ítems / 30 eventos / 3 adjuntos / 10 firmados / 13 documentos operativos / 6 prefacturas / 1 AOT / 6 listas con 5.840 ítems / 2 solicitudes de despacho.

### 6.2 El problema de fondo

Con la demo intacta, FCR, Pumping y QHSE seguirán leyendo `prisma.pedido` y las demás tablas por `pedidoId` entero, y FCR/Pumping seguirán empujando documentos al `FacturacionDomainService` **en proceso**. Además, `FcrTicket` y `PumpingTicket` tienen FK real a `pedidos`. Por tanto en la demo debe existir un pedido con el mismo id numérico (`legacy_id`) mientras esos módulos vivan allí. Además el **estado** y los **ítems** del pedido los modifican operaciones de prefactura/AOT/despacho y de cambio de ítems (§1.4, §3.2): quien tenga prefactura/AOT debe ser también el dueño del estado, o habrá dos escritores.

### 6.3 Alternativas comparadas

**A. Solo Pedido, escritura doble bidireccional.** El nuevo `comercial` y la demo escriben el pedido y se replican en ambos sentidos; prefactura, AOT, guía y despacho se quedan en la demo.
- A favor: alcance inicial pequeño; el primer corte es solo `/pedidos`.
- En contra: dos escritores de `estado` e `itemsEstimados` (la demo los modifica al generar prefactura y al aprobar un cambio de ítems); hace falta resolver conflictos y reintentos en ambos sentidos; sin transacción distribuida las dos copias divergen ante cualquier fallo; el código de sincronización es descartable y delicado. Es la opción más frágil.

**B. Solo Pedido como dueño, con fachada hacia la demo.** `comercial` es dueño del pedido; las nueve operaciones que cambian el estado (prefactura enviar/firmar/rechazar, AOT, despacho, etc.) se enrutan a `comercial`, que las **delega** a la demo (donde siguen prefactura y AOT) y luego registra el estado y el historial él mismo.
- A favor: primer corte pequeño y con un solo dueño del estado; no exige migrar prefactura todavía.
- En contra: la fachada es código desechable (≈9 operaciones, cada una con su espejo de errores); la prefactura de la demo sigue calculando contra un pedido espejo que puede quedar atrasado en ítems; y se sigue necesitando el flujo demo → pedidos de ítems aprobados y documentos operativos. Trabaja dos veces la misma lógica (fachada ahora, migración real después).

**C. Ciclo comercial completo con una sola frontera (recomendada).** Un solo dueño de Pedido, documentos operativos, prefactura, guía, AOT, listas de precios y despacho, cortado por el prefijo `/api/facturacion` (ya asignado a `comercial` en `routes.ts`).
- Maestro único. Hacia la demo: **espejo unidireccional por su propia API** (§6.4). Desde la demo: dos flujos y lecturas bajo demanda por puertos (§6.4).
- Antes del corte hay una **fase sombra** sin tráfico de usuarios (§7).
- A favor: no hay escritura bidireccional sobre el mismo dato; no se escribe código desechable de fachada de prefactura; el ciclo se porta una sola vez (el `facturacion-domain.service.ts` ya está concentrado en un archivo); los datos son pequeños (6 prefacturas, 1 AOT, 13 documentos); la frontera ya está en el gateway.
- En contra: el primer corte visible llega más tarde (tras F1-F5) y es más grande; el rollback después de escribir en el nuevo backend no es automático (se acepta con datos de prueba: reejecutar la migración desde una copia de la demo y rehacer a mano lo creado tras el corte).
- Se mitiga el tamaño con fases pequeñas y verificables y con el interruptor por prefijo (variable `COMERCIAL_URL`) y, si se necesita, por ruta específica antes del corte total.

**Descartadas**: compartir base de datos (obligaría a cambiar el proveedor de la demo a PostgreSQL: modifica la demo); migrar FCR/Pumping/QHSE primero (circular: todos referencian al pedido); lectura directa del archivo SQLite desde el servicio nuevo en producción (acopla despliegues; solo se usa en el script de migración).

### 6.4 Cómo queda la alternativa C (coexistencia concreta)

**Espejo comercial → demo** (puerto `OperacionesLegacyPort` con adaptador HTTP que llama a la API de la demo en `LEGACY_URL`, con token HS256 de la demo equivalente al del gateway):
- Alta: `POST /api/facturacion/pedidos` de la demo con `code`, `estado` e `historialEstados` ya definidos por `comercial` (el controller de la demo los acepta, ver `pedidos.controller.ts` líneas 83-106). Eso **crea además el ticket FCR/Pumping y abre el PTW** (efectos que hoy son del `create` de la demo). El id que devuelve la demo se guarda en `pedido.legacy_id`.
- Edición: `PUT /api/facturacion/pedidos/:legacyId`. Estado: `PATCH .../:legacyId/estado` (genérico, sin guarda: sirve para espejar). Anulación y rechazo: igual, por `estado`.
- Cola con reintentos: evento `comercial.pedido.*` en el outbox y consumidor propio; si la demo falla, el pedido de `comercial` queda con marca `espejo_pendiente`. Hace falta un usuario de servicio de la demo para los reintentos sin sesión (pregunta 4).
- La prefactura/AOT/guía/despacho que se generen en `comercial` **no** se espejan: solo el pedido, que es lo que leen FCR, Pumping y QHSE.

**Lectura bajo demanda comercial → demo** (puertos de solo lectura, adaptador HTTP hoy, adaptador por eventos cuando migre cada módulo):
- Tickets por pedido: `GET /operations/fcr/tickets?pedidoId=` y `GET /operations/pumping/tickets?pedidoId=` (existen, ver los controllers con `@ApiQuery pedidoId`).
- PTW por pedido: `GET /qhse/ptw` (filtra por `pedidoId` en `PtwService.scalarColumns`; **no verificado** que el controller acepte el query `pedidoId`).
- Documentos de Pumping y derrames: endpoints de Pumping y `/qhse/derrames` (verificar contrato antes de F4).

**Demo → comercial** (las dos únicas escrituras, §3.2):
1. Documentos operativos que FCR empuja **en proceso** a la tabla de la demo: se leen bajo demanda con `GET /facturacion/documentos-operativos?pedidoId=<legacy>` de la demo (al calcular el avance y al generar la prefactura) y se guardan en `comercial.documento_operativo` de forma idempotente por `(pedido, origen, tipo, fecha)`, igual que `pushDocumentoOperativo`. Los que Pumping envía por el frontend (`POST /facturacion/documentos-operativos`, con `pedidoCode`) ya llegan directo a `comercial`.
2. Aprobación de un cambio de ítems en Pumping (`solicitudes-cambio-items-domain.service.ts`): modifica el pedido de la demo. Se reconcilia con un trabajo que compara los ítems del pedido espejo con los de `comercial` y aplica el cambio si `comercial` no tuvo ediciones desde el último espejo (control por `version`); si hay conflicto, lo reporta. Hoy hay 0 solicitudes, así que el riesgo es de futuro (pregunta 8).

**Gateway**: se activa `COMERCIAL_URL`. Las rutas hijas que siguen en la demo (p. ej. `/api/qhse/pedidos`) no cambian porque tienen su propio prefijo. Si se quiere un corte parcial por ruta, `routes.ts` admite reglas más específicas antes de la general.

**Ids para el frontend (§2.4)**: la API de `comercial` devuelve `id` (UUID) y `legacyId`, y acepta ambos en la ruta. El frontend adapta con el mismo patrón `conIdLegacy`: los enlaces desde tickets usan `legacyId`; los enlaces propios, el UUID.

**Retiro del espejo**: cuando FCR, Pumping y QHSE migren (consumen `comercial.pedido.abierto` y publican sus propios eventos), se retiran el puerto de espejo y las lecturas bajo demanda, y finalmente `legacy_id` (patrón expand/contract ya descrito en §9 de `PROPUESTA-DESARROLLO-F0-F1.md`).

### 6.5 Recomendación y razones

**Se recomienda C**, ejecutada en la secuencia de §7, por: (1) un solo dueño de cada dato en todo momento; (2) el ciclo ya está acoplado por el estado, así que cortarlo a medias obliga a código desechable y a conciliar dos copias; (3) los datos son pocos y el código a portar está concentrado; (4) la demo no se toca (todo el pegamento está en `comercial` y en el gateway); (5) el patrón de espejo por API reutiliza la lógica de la demo que ya crea tickets y PTW. Se asume el costo de un primer corte más tardío, aliviado por la fase sombra y las fases pequeñas.

Si el usuario necesita un corte anticipado solo de `/pedidos` (poco recomendable), la B es el plan de contingencia, nunca la A.

---

## 7. Plan por fases (cada una pequeña y verificable)

Convención de tamaño: S (hasta unos 2 días), M (3-5 días), L (más de una semana). Son estimaciones gruesas, no compromisos.

| Fase | Entrega | Cómo se prueba |
|---|---|---|
| **F0. Decisiones y andamiaje** (M) | Respuestas a las preguntas 1-4 y 6. `apps/comercial` (health, JWT, outbox `msg_comercial`), lib `libs/comercial/pedidos`, `@dyn/pedidos` en `tsconfig.base.json`, migración inicial vacía y rol `app_comercial`. Extraer el puente de tokens del gateway (`bridgeToLegacy`) a una lib compartida (`@dyn/legacy-bridge`) para que `comercial` pueda llamar a la demo. Portar `buildTimelineResumen`, mapas de estado/macro-estado. Decidir si `archivos` va antes (ver F3) | Compila y arranca; `/health`; prueba de unidad del puente y del timeline contra los casos de `timeline.spec.ts` de la demo |
| **F1. Modelo y migración en sombra** (M) | Migración SQL del schema `comercial` para el pedido (§4, desviaciones D1-D7, D10); `migrate-from-demo.ts` (§6.1) para `pedido`, tipos, subtipos, ítems e historial; endpoints **solo de lectura** `GET /facturacion/pedidos[/:id]` en `comercial`, sin tráfico del gateway | Informe: 10 / 10 ítems / 30 eventos, no resueltos documentados; segunda corrida idempotente (0 creados); **comparador de contrato**: para cada pedido, `GET` de la demo vs `GET` de `comercial` (a través de `legacyId`) campo a campo, 0 diferencias salvo ids y los campos nuevos documentados |
| **F2. Escritura del Pedido, permisos y eventos** (M-L) | `POST`, `PUT`, `PATCH estado`, `rechazar`, `anular` con transiciones validadas, historial, `version`, código por secuencia, validación de Técnico HSE contra `identidad` (por puerto), eventos `comercial.pedido.*` en el outbox, permisos del §5 para esos endpoints y su `PERMISSION_REPLACEMENTS`. Espejo a la demo (§6.4) con reintentos | Pruebas de unidad de la máquina de estados (todas las celdas de §1.4); prueba de paridad de permisos (§5.4) para los endpoints de esta fase; e2e: crear un pedido en `comercial` crea el pedido, el ticket y el PTW en la demo y deja `legacy_id`; fallar la demo deja `espejo_pendiente` y el reintento lo cierra; evento visible en RabbitMQ con su traza |
| **F3. Adjuntos y firmados (con `archivos`)** (L) | Si se aprueba, construir `libs/shared/storage` (+ escáner) y el módulo `plataforma/archivos`; luego `pedido_documento` y `pedido_documento_firmado` (D9), migración de los 12 y 20 archivos a Azurite, anulación lógica | Conteos de filas y archivos (3 / 10 + reporte de los 9 huérfanos); descarga autenticada de cada archivo y comparación de hash con el original; un archivo con tipo no permitido y uno mayor al límite son rechazados |
| **F4. Documentos operativos y avance** (M) | `documento_operativo*` (+ `POST /documentos-operativos` por `pedidoCode`), `calcularAvance` con los puertos de lectura a la demo (tickets, PTW, derrames, documentos de Pumping), importación de los que FCR empuja en proceso (§6.4) | 13 documentos migrados; el `avance` de cada uno de los 10 pedidos es idéntico al de la demo (comparador); un día enviado desde FCR en la demo aparece en `comercial` tras la siguiente consulta |
| **F5. Prefactura, guía, AOT, listas y despacho** (L) | `prefactura*`, `guia_remision*`, `aot*`, `lista_precios*`, solicitud de despacho temporal en `comercial` (D8), cálculo de prefactura portado con las mismas tasas (IVA 15 %, IR 1 %, retención de IVA 30 %) y regla de lista de precios; `comercial.pedido.estado_cambiado` en cada transición | Prefacturas de los 6 pedidos recalculadas en `comercial` y comparadas con las de la demo (`netoCobrar`, subtotales, ítems) con tolerancia cero; AOT del pedido 8; paridad de permisos completa (§5.4) sobre toda la matriz |
| **F6. Corte** (M) | Última migración con la demo congelada (se marca `corte_realizado`); activar `COMERCIAL_URL`; frontend adaptado a `id` UUID + `legacyId` (§2.4); retiro de `sync-as2` mock o su reemplazo (pregunta 5) | Recorrido completo con el frontend adaptado y un usuario por rol: alta, edición, rechazo, anulación, despacho, prefactura, firma, AOT; FCR y Pumping abren el pedido desde su ticket; QHSE ve el PTW del pedido nuevo; el tablero de conteos coincide con el de la demo |
| **F7. Estabilización y retiro del espejo** (S-M) | Período con ambos sistemas en paralelo para lectura; reconciliación de ítems (§6.4); cuando migren FCR/Pumping/QHSE, retirar espejo, puertos y `legacy_id` | Cero `espejo_pendiente` durante el período acordado; revisión de las diferencias de reconciliación |

**Orden recomendado**: F0 → F1 → F2 → F4 → F5 → F6 y **F3 en paralelo** (por ser la más larga y no bloquear lo demás), con la salvedad de que el corte (F6) necesita F3 terminada o, si no, mover los endpoints de adjuntos y firmados a una regla específica del gateway que los deje en la demo hasta que F3 cierre (aceptable porque operan sobre el pedido espejo con su `legacy_id`; pregunta 3). Checkpoint tras F1 (comparador en cero) y tras F2 (paridad de permisos y espejo funcionando) antes de seguir.

### 7.1 Riesgos

| Riesgo | Efecto | Mitigación |
|---|---|---|
| Divergencia entre el pedido de `comercial` y el espejo de la demo | FCR/Pumping muestran datos viejos; un ticket sin pedido | Outbox con reintentos, marca `espejo_pendiente`, informe de diferencias periódico (código, estado, contrato, ítems) |
| Acoplamiento por tablas de la demo (`calcularAvance` lee 10 tablas de otros dominios) | El `avance` puede diferir | Puertos de lectura con comparador contra la demo (F4); no copiar tablas ajenas |
| Dos únicas escrituras demo → comercial | Pérdida silenciosa de documentos o de un cambio de ítems | Importación idempotente y reconciliación con reporte de conflictos |
| Contrato por id numérico en el frontend (rutas, tickets) | Enlaces rotos, 404 | La API acepta UUID o `legacyId`; prueba de contrato en F1 y F6 |
| Permisos distintos el día uno | Acceso ganado o perdido | Prueba de paridad generada desde `module-roles.ts` (§5.4), no escrita a mano |
| Tokens con permisos viejos tras la siembra | 403 inesperados | Reiniciar sesiones; documentarlo en F2/F6 |
| Carrera en el código de pedido y secuencia compartida con AS2 | Código repetido | Secuencia en BD (D6); pregunta 5 sobre la autoridad del correlativo |
| Rollback después del corte | Datos creados en el nuevo backend no vuelven a la demo | Datos de prueba, migración repetible desde copia de la demo, ventana de corte acordada |
| `archivos` no existe | F3 bloquea adjuntos y firmados | Construirlo antes o dejar esas rutas en la demo (con el espejo) hasta que cierre |
| Efectos de `create` no transaccionales en la demo (ticket y PTW; el error del PTW se ignora) | Un pedido sin PTW queda sin avisar | El espejo reporta la respuesta de la demo y reintenta; el `avance` ya trata "sin PTW" como alerta |
| El `PATCH` de estado genérico acepta cualquier valor | Estados inválidos en el histórico | Validarlo contra las transiciones en el nuevo backend; los datos actuales solo tienen estados válidos |

### 7.2 Lo que no se pudo verificar

- Si `/api/catalogos` ya está enrutado a `plataforma` en el gateway en ejecución (`routes.ts` no lo lista) y cómo maneja el frontend los ids UUID de catálogos (el modelo dice `number`).
- Si los permisos `comercial.*` ya están sembrados en `identidad.permiso` (no se consultó PostgreSQL).
- Si `GET /qhse/ptw` acepta el filtro `pedidoId`; los contratos de `/qhse/derrames` y de documentos de Pumping para las lecturas bajo demanda.
- La configuración de `ValidationPipe` de la demo (si descarta o rechaza campos desconocidos como `subcliente`).
- La causa de los 9 archivos de `uploads/pedidos/` sin fila en `pedido_documentos`.
- Cuántas sesiones o clientes usan hoy `DELETE /pedidos/:id`: se asume ninguno porque el frontend no lo llama (los registros de acceso no se revisaron).
- No se ejecutó ninguna prueba de la demo ni del backend nuevo.

---

## 8. Preguntas abiertas (solo las puede responder el usuario; máximo 8)

1. **Alcance del primer corte**: ¿acepta que "Pedidos" se corte junto con el resto del ciclo comercial (documentos operativos, prefactura, guía, AOT, listas de precios, despacho) bajo `/api/facturacion`, como propone la alternativa C, o necesita absolutamente un corte anticipado solo de `/pedidos` (alternativa B, con código desechable)?
2. **Ids hacia el frontend**: ¿está de acuerdo en que `comercial` devuelva `id` UUID más `legacyId` y que los enlaces desde tickets de FCR/Pumping/QHSE usen `legacyId` hasta que migren, igual que usuarios y catálogos? (Confirme también si el cambio de los catálogos ya está activo en el gateway, §2.3.)
3. **Archivos**: ¿se construye `archivos` (almacenamiento + escáner) antes del corte, o se acepta dejar adjuntos y firmados en la demo hasta que exista? Esto fija si F3 bloquea o no a F6.
4. **Usuario de servicio hacia la demo**: el espejo y sus reintentos necesitan un token de la demo sin sesión humana. ¿Qué usuario de la demo debe usarse (hoy es Superadmin), y acepta que las acciones espejadas figuren con ese usuario?
5. **AS2 y correlativo**: ¿el botón "Sincronizar con AS2" (hoy un mock con cola) debe reemplazarse por la integración real de `integraciones` (qué operación de AS2 trae pedidos), y quién es la autoridad del número de pedido cuando el Portal y AS2 comparten secuencia (4313, 4314...)?
6. **`PATCH :id/estado`**: hoy 4 roles pueden poner cualquier estado. ¿Se conserva así el día uno (como propone el plan, para no cambiar accesos) y se endurece después, o prefiere restringirlo ya a las transiciones válidas?
7. **Estados sin productor**: `en_operacion`, `en_elaboracion_operativa`, `documentos_completos` y `facturado` no los produce ningún código hoy. ¿Debe el nuevo backend generarlos a partir de eventos de operaciones (inicio de ticket, reportes aprobados), o siguen siendo manuales?
8. **Cambio de ítems desde Pumping**: mientras Pumping esté en la demo, ¿acepta una conciliación periódica con aviso de conflicto, o prefiere pausar esa función (hoy 0 solicitudes) hasta migrar Pumping?
