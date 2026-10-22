# Pendientes de migración: módulos y funcionalidades que faltan en el backend nuevo

> Creado el 22/10/2026. Inventario de lo que **todavía no está mapeado en el backend nuevo y normalizado según las normas de la base de datos nueva**, y de lo que, aun estando en el backend nuevo, le falta cerrar su ciclo (frontend adaptado, corte del gateway, retiro de lo transitorio).
> Fuentes: el backend de la demo (`dynadrill-backend`, 54 modelos), el backend nuevo (`dynadrill-platform`, revisado en código el 22/10/2026), los planes de `documentacion/modulos` y las capturas de la demo. Donde un plan dice algo distinto del código, **manda el código**; los puntos que no pude comprobar van marcados **(verificar)**.

---

## 0. Reglas que aplican a TODO lo pendiente

### 0.1 Backend y base de datos

Cada módulo o funcionalidad que se migra debe cumplir el estándar de calidad de `plan-corte-de-la-demo.md` (11 puntos). En resumen:

- **Normalizado de verdad:** catálogos como tablas con `id uuid` + `codigo` único + FK (o enum de PostgreSQL si el valor es fijo del sistema); nada de JSON ni de texto libre donde hay un conjunto conocido; sin copias de datos (un dato vive en un solo lugar y se consulta con JOIN).
- **Integridad en la base, no solo en el servicio:** CHECK, FK (compuestas si hace falta), índices únicos parciales, NOT NULL.
- **Sin FK entre contenedores** (`plataforma`, `comercial`, `operaciones`, `qhse`): el id va con un COMMENT que lo diga; solo se copia el texto imprescindible y se justifica.
- **Historia inmutable** (kardex, firmas, historiales, registros firmados): `REVOKE UPDATE, DELETE`; los errores se corrigen con un registro nuevo.
- **Auditoría uniforme:** `created_at/created_by/updated_at/updated_by` con FK a `identidad.usuario`.
- **Una migración por cambio**, sin editar migraciones ya aplicadas; los datos sembrados van en la semilla idempotente.
- **Pruebas de integración con base real** que intenten violar las reglas (CHECK, FK, REVOKE) y esperen el rechazo.
- **No hay datos reales que migrar** (D11, resuelta el 21/10/2026): se arranca vacío y solo se llevan catálogos.

### 0.2 Frontend (obligatorio)

**Cuando se cambia el backend y la base, el frontend se adapta al backend nuevo, pero debe respetar el diseño visual de la demo, tanto en escritorio como en móvil, que ya tiene.** Esto significa:

- Se conservan las **mismas pantallas, pasos, textos, componentes del sistema de diseño y estilos** de la demo. **No se inventa diseño** ni se hacen «copy-pages sin estilos».
- Lo que se adapta es solo la capa de datos: servicios que apuntan a las rutas nuevas, **ids UUID (string) en lugar de numéricos**, modelos y mapeadores, permisos y errores claros del backend.
- Si el backend nuevo cambia una regla (por ejemplo, el reporte de herramientas por ítem de la lista de precios), se adapta la **lógica** y se conserva el **diseño** de la demo; si la demo hace algo que el negocio considera incorrecto, se corrige la lógica sin cambiar el aspecto.
- **Criterio de «terminado» de una pantalla:** se compara contra la demo (o sus capturas) en **escritorio y en móvil** (ancho de teléfono: sin scroll horizontal de página, tablas con desplazamiento propio, diálogos a pantalla completa o en hoja inferior, como la demo) y se prueba en el navegador antes de darla por buena.
- Se retiran del frontend los servicios y mocks de la demo que quedan huérfanos al migrar cada módulo.

---

## 1. Resumen: los 54 modelos de la demo y a dónde van

| Dominio de la demo (modelos) | Destino en el backend nuevo | Estado |
|---|---|---|
| Role, User | `plataforma/identidad` | Hecho |
| Catálogos: Bloque, Campo, Taladro, Pozo, PersonaContacto, ClienteCatalogo | `plataforma/catalogos` (`/api/v2/catalogos`) | Hecho en backend; el frontend aún usa el catálogo de la demo en varios sitios (§4) |
| Pedido, PedidoPendienteAs2, PedidoDocumento, DocumentoFirmado, ListaPrecios(+Item), DocumentoOperativo, Prefactura, GuiaRemision, Aot, SolicitudDespachoBodega | `comercial/pedidos` | Hecho en backend; **falta el corte** del prefijo `/api/facturacion` y varios ajustes (§2.5) |
| Articulo, ArticuloParte, MovimientoInventario | `operaciones/inventario` | Hecho en backend (artículos, partes, kardex, despachos); faltan pantallas y decisiones (§2.4) |
| PumpingTicket, ChecklistIngresoPumping, PumpingDocumento | `operaciones/pumping` | Hecho (flujo completo); quedan detalles del reporte diario (§2.6) |
| FcrTicket, FcrToolInspection(+Parte), FcrDocumento | `operaciones/fcr` | Hecho en backend; quedan pendientes de pantalla y de contrato (§2.7) |
| SolicitudCambioItems | `pumping` y `fcr` (cambio de ítems del pedido) | Hecho |
| Unidad, VehicleInspection, ConductorPermisos, GerenciamientoViaje | `operaciones/flota` | Hecho en backend; faltan verificación de extremo a extremo y la migración D2 (§2.3) |
| UnitReport, MaintenanceOrder, SubOrder, HistorialMantenimiento | `operaciones/mantenimiento` (+ historial/preventivos en Flota) | Hecho en backend (reportes, órdenes, sub-órdenes, retorno); **faltan KPI, hojas, consumidor de QHSE y pantallas** (§2.2) |
| Iperc, IpercCoberturaLinea, Ptw, StopCard, SwaEvento, EntregaEpi, InspeccionEquipo | `qhse/seguridad` | Hecho (IPERC maestra y cobertura, PTW, SWA, STOP, inspecciones de campo, EPI, documentos por pedido y Acta) |
| **DerrameEvento, Desecho, AspectoAmbiental, DocumentoLegalQhse, ObjetivoAmbiental, EmergenciaEvento, Investigacion, DashboardMetas** | `qhse/seguridad` | **PENDIENTE: sin tablas ni API en el backend nuevo (§2.1)** |
| QhseChecklistEquipo | — | **No se migra**: la demo `main` lo eliminó; lo reemplaza la inspección de vehículos de Flota |
| (sin modelo propio) Auditoría y Firmas | `plataforma/auditoria`, `plataforma/firmas` | **PENDIENTE: los schemas existen vacíos (§2.8)** |
| (sin modelo propio) Reportería y Dashboard (KPI por módulo y rol) | `worker/reporting` | **PENDIENTE (§2.9)** |

---

## 2. Pendientes de backend y base de datos, por módulo

### 2.1 QHSE: subdominios sin construir (tramos Q4, Q5 y Q6 del plan)

Cada uno necesita: migración normalizada, semilla de catálogos, API bajo `/api/v2/qhse`, permisos en `permissions.ts`, eventos por el outbox, plantillas de avisos si aplica, pruebas de integración con las reglas de la base, y su pantalla adaptada (§0.2).

| Subdominio (modelo de la demo) | Qué hace en la demo (reglas a respetar) | Notas de modelado |
|---|---|---|
| **Desechos** (`Desecho`) | Peligroso / no peligroso con características CRETIB, contenedor por color, **límite de almacenamiento de 12 meses** (AM 142), manifiesto con tres firmas, certificado | Catálogos de característica, contenedor y estado en tablas; firmas en tabla inmutable; usa el OCR de firmas cuando se cargue el documento firmado (D6) |
| **Derrames** (`DerrameEvento`) | Alerta por volumen y ubicación, checklist de contención de 5 minutos, **notificación obligatoria al MAE**, un derrame en suelo **genera un desecho** | Umbrales de las bandas: son un supuesto de la demo, **consultar a Dynadrill** (no inventar); enlace con Desechos |
| **Emergencias / MEDEVAC** (`EmergenciaEvento`) | Activación con cronómetro, nivel 1–3, conteo de personal (locación, evacuados, faltantes), triage médico por color, signos vitales, notificación a hospital | El vínculo SWA ↔ emergencia queda para este tramo |
| **Investigación de incidentes** (`Investigacion`, DYN-SGI-RE-034) | Near Miss / Leve / Grave / Fatal (plazo de 30 días para Near Miss), 5 Porqués, Ishikawa, acciones correctivas y preventivas | 5 Porqués y causas de Ishikawa como filas, no JSON |
| **Requisitos legales** (`DocumentoLegalQhse`) | Registro y vigencia de requisitos legales | Documento por el servicio de archivos |
| **Objetivos ambientales** (`ObjetivoAmbiental`) | Objetivos, metas y seguimiento | — |
| **Aspectos ambientales** (`AspectoAmbiental`) | Matriz de aspectos e impactos | — |
| **Metas del dashboard y dashboard HSE-MASTER-001** (`DashboardMetas`) | TRIR, LTIR, días sin LTI, ratio Near Miss:incidente, % PTW a tiempo, desechos, etc. | Depende de §2.9 (proyecciones) y de las demás tablas de QHSE |
| **Avisos de QHSE** (servicio de avisos de la demo) | Alertas agregadas (vencimientos de ART, límite de desechos, inspecciones vencidas…) | Se resuelve con el módulo de Avisos de la plataforma (reglas + plantillas), **no** con un servicio aparte; ver también `qhse-avisos-feeder.service` del frontend |

Además, dentro de QHSE ya construido quedan abiertos: **B1/B2** (SWA activa y PTW pendiente bloquean el traslado de salida: decididos el 21/10/2026 y ya implementados en Pumping; verificar que FCR no necesite equivalente), **B8** (EPI y términos con FCR/Pumping) y el permiso `qhse.documentos.ver_ticket` para los roles de FCR en bases existentes (asignarlo desde la pantalla de Roles).

### 2.2 Mantenimiento

- **KPI de mantenimiento:** las fórmulas de `MAN-MASTER-001` **no están confirmadas con Dynadrill** (consultar, no inventar: `documentacion/mantenimiento/CONSULTAS-PARA-DYNADRILL.md`). Hoy los KPI siguen en la demo.
- **Hojas imprimibles:** informe DYN-MNT-RE-008 y órdenes General y Operativa, leyendo del backend nuevo.
- **B3 — QHSE → Mantenimiento:** falta el consumidor de `qhse.reporte_unidad.generado` (suscripción única a `source: 'qhse'`, idempotente por `casoId`, crea el reporte recibido con origen QHSE). Hoy Mantenimiento solo consume `operaciones.pumping.reporte_unidad_llegada`.
- **Origen «Vehículos»** del reporte de unidad: el alta desde la demo (`UnitReportsService.create/update`, marcada `@deprecated`) debe retirarse o reemplazarse **(verificar con Dynadrill si existe un origen distinto de Pumping y QHSE)**. FCR **no** genera reporte de unidad (retirado el 21/10/2026).
- **Preventivo, historial e inspecciones de vehículos:** el backend nuevo ya los tiene (Flota y `unidades/:id/historial`); falta que el frontend deje de usar los servicios de la demo (§4).
- **Reclasificar novedades** de un reporte entre categorías quedó apagado a propósito (en el backend nuevo las novedades se leen del reporte de origen): decidir con Dynadrill cómo se corrigen en el origen.
- **Derivar a Pumping y reasignar operador** no tienen endpoint propio (el adaptador usa la reclasificación): evaluar si conviene darles endpoint.

### 2.3 Flota

- **D2 — vehículo del catálogo vs. unidad de Flota:** migrar Pumping de `catalogos.vehiculo` a `flota.unidad` (la asignación y la guía siguen usando el vehículo del catálogo). FCR **ya no usa unidades**.
- **B5 — Pumping ↔ Flota de extremo a extremo** y **B6 — portal del Conductor con `mis-viajes`:** verificar con eventos reales (no solo con pruebas por consumidor).
- Hoja imprimible DYN-SGI-RE-068 del detalle nuevo (la actual lee el modelo viejo); anulación de documentos de conductor en pantalla (el backend ya la ofrece).
- Datos patrimoniales de las unidades de la carga inicial y consultas pendientes a Dynadrill (sección `## Flota`).

### 2.4 Inventario

- **Pantalla «Despachos de Bodega» sin conectar (detectado 22/10/2026):** el backend nuevo ya registra la solicitud (el pedido pasa a `por_despachar_bodega`, evento `comercial.despacho.solicitado`) y lista los pendientes en `GET /api/operaciones/inventario/despachos`, pero `/dashboard/inventario/despachos` sigue leyendo `/facturacion/solicitudes-despacho` de la demo y no muestra nada. Adaptarla a `operaciones/inventario/despachos` (despachar con respaldo y MSDS, rechazar) conservando el diseño de la demo; mientras tanto el despacho solo se completa desde la sección de guías del pedido. Revisar también que el texto de `prefactura-detail-page` use «usted» (hoy tiene voseo).
- **B7 — Inventario ↔ FCR: DECIDIDO el 22/10/2026:** las herramientas que el operador selecciona en el flujo de FCR **no mueven el kardex**; solo se registran en el ticket. No se agrega `ticket_fcr_id` a los movimientos.
- **Mínimos de stock** y evento `stock.bajo_minimo` (IN4); unidad como catálogo compartido (IN9).
- **Conciliación con AS2** (`articulo.as2_id`) cuando Asinfo exponga productos y existencias (depende de ellos).
- **Cargas pendientes:** `articulo_parte` y `articulo_codigo` vacíos de origen; si los datos de la demo no los traen, consultar a Dynadrill.
- Decisiones del usuario abiertas: IN1 (bodega del saldo inicial), IN2 (unidades reales), IN3 (datos negativos del export), IN5 (quién autoriza ajustes), IN8, D3/IN7 (fuente de verdad con AS2).

### 2.5 Comercial / Facturación

- **Corte del prefijo `/api/facturacion`** al contenedor nuevo (hoy sigue en demo-legacy; el frontend ya usa `/api/comercial` en lo migrado) y retiro del permiso `comercial.pedidos.gestionar`.
- **C9:** descargar el PDF de **todos** los documentos del pedido; **C10:** plantillas de ejemplo (Pumping y FCR) en «Nuevo pedido».
- Limpieza opcional: permiso `comercial.cierre.gestionar` y columnas `factura_*` sin uso (con migración).
- Consultas pendientes en `facturacion/CONSULTAS-PARA-DYNADRILL.md`: R5, R6, G6–G8.
- Validar que `documentoTicketId` de los documentos firmados pertenezca al ticket.
- **Distribución por día del Reporte de Herramientas (FCR):** Comercial recibe solo el total de cada ítem; para que la hoja de Facturación muestre las celdas por día de los ítems con cantidad hay que llevar la cantidad por día en el evento y en `documento_operativo_uso`.

### 2.6 Pumping

Del Reporte Diario de la demo **no está portado** (decisiones pendientes): la plantilla Excel DYN-SGI-RE-047 (y la hoja «Tablas»), el documento de monitoreo por día, las firmas dibujadas del supervisor y del cliente, y el archivo adjunto. Confirmar con el usuario cuáles se mantienen.

### 2.7 FCR

- **Disponibilidad de operadores por rango** en la asignación (✓/✗ por operador según el servicio, como la demo): requiere backend nuevo en FCR (Pumping ya tiene `ocupadas`).
- **Carga masiva de actividades por plantilla**, botón **Observaciones** del ticket, **PDF de resumen y encuesta de satisfacción** del cierre, y el banner de la **matriz IPERC** del ticket.
- **Pantalla «Códigos por cliente»** (configuración de kits por cliente y código): el backend nuevo la tiene; el frontend sigue con el servicio de la demo.
- **Inspección y reparación (DYN-FCR-RE-009):** el formato ya se imprime desde el ticket; Procedencia, Reporte Insp N°, OTI N° y Fecha de Ingreso quedan **abiertos para llenar a mano** (decisión del 22/10/2026).
- Decidir si el ticket del servicio puede **volver de Inspección a «Tipo de operador»** o si ese paso exige el listado de herramientas antes de avanzar (hoy un ticket pasado sin herramientas queda atascado).

### 2.8 Plataforma: Auditoría y Firmas

- **Auditoría** (`plataforma/auditoria`): proyectar los eventos que ya publican todos los módulos en una línea de tiempo consultable. Es independiente y de valor inmediato.
- **Firmas** (`plataforma/firmas`): evidencia de firma (hoy cada módulo guarda su «firma de una línea» y, en QHSE, el OCR de firmas). Plan: `plan-firmas-y-auditoria.md`.
- Ambos schemas existen vacíos; no tienen sesión asignada.

### 2.9 Plataforma: Reportería y Dashboard

- Módulo `worker/reporting` con proyecciones de los eventos para el **dashboard de la demo** (`features/dashboard`: pedidos por estado, unidades con alertas de mantenimiento, incidentes QHSE abiertos, inspecciones pendientes, artículos en inventario, tickets de operaciones…) y los KPI de QHSE y Mantenimiento. Plan: `plan-reporting-dashboard.md`. Hoy solo hay una reportería parcial de Comercial.

### 2.10 Plataforma: catálogos, identidad y AS2

- **Catálogos:** el frontend todavía usa `/api/catalogos` (ids numéricos de la demo) en varios servicios; migrar a `/api/v2/catalogos` (UUID) y, al terminar, **retirar** el catálogo de la demo.
- **Puente con la demo:** retirar `legacy_id` (usuarios, roles, catálogos) y `LEGACY_JWT_SECRET` al migrar el último módulo.
- **AS2:** la lista blanca del servidor de AS2 con TI (`http://190.12.33.14:8020/AS2/rest` está bloqueado por FortiGuard) sigue pendiente; sin ella la sincronización contra AS2 real no corre.
- **Cuentas de empleados:** siguen inactivas hasta entregar (correo de AS2 tal cual, clave iniciales+123*).

### 2.11 Gateway y corte de la demo

- Por cada módulo cortado: agregar los prefijos de la demo al contenedor nuevo (o retirarlos), corregir `routes.spec.ts`, sombra, corte y limpieza (`plan-corte-de-la-demo.md` §3).
- **B11:** comprobar con un `curl` autenticado que `/api/operaciones/{pumping,fcr,flota,mantenimiento,inventario}`, `/api/v2/qhse` y `/api/comercial` pasan por el gateway.
- Orden sugerido del corte: Comercial → Catálogos → Flota/Mantenimiento/Inventario (juntos, comparten la unidad) → QHSE → Pumping y FCR → retiro del puente y apagado de la demo.

---

## 3. Pendientes de frontend: adaptar al backend nuevo **conservando el diseño de la demo**

Aplican siempre las reglas de §0.2. Servicios del frontend que **todavía apuntan a la demo** (revisado el 22/10/2026), agrupados por lo que hay que hacer:

### 3.1 Ya existe backend nuevo: adaptar la pantalla y retirar el servicio de la demo

| Servicio / pantalla de la demo | Reemplazo en el backend nuevo |
|---|---|
| `features/inventario/services/articulos`, `articulo-partes`, `movimientos-inventario` | `/api/operaciones/inventario` (ya hay `inventario-plataforma.service`; faltan las pantallas de despachos —ver §2.4— y vehículos) |
| `features/maintenance/services/unidades`, `historial-mantenimiento`, `unit-reports`, `vehicle-inspections` | `/api/operaciones/flota` y `/api/operaciones/mantenimiento` |
| `features/conductor/services/gerenciamiento-viaje` (portal del Conductor) | `/api/operaciones/flota` (gerenciamientos de viaje) |
| `features/operations/fcr/services/fcr.service`, `fcr-configuracion-codigos` | `/api/operaciones/fcr` (los tickets nuevos ya lo usan) |
| `features/operations/pumping/services/pumping.service`, `solicitud-cambio-items`, `terminos-pumping` | `/api/operaciones/pumping` (los tickets nuevos ya lo usan) |
| `features/qhse/{epi, iperc, ptw, stop, swa, documentos}` (servicios de la demo) | `/api/v2/qhse` (existen las versiones `entrega-epi`, `iperc-maestra`, `permiso-trabajo`, `stop-plataforma`, `swa-plataforma`, `documentos-pedido`: retirar las viejas al cortar) |
| `features/facturacion` (servicios `/api/facturacion/*`: pedidos, prefacturas, aots, guías, listas de precios, documentos operativos, despachos) | `/api/comercial` (ya hay `pedidos-comercial`, `listas-precios-comercial`, `documentos-firmados-comercial`, `reporteria-comercial`); corte pendiente |
| `shared/services/catalogos.service` y usos de `/api/catalogos` | `/api/v2/catalogos` (UUID) |
| `shared/services/ticket-prefactura.service` | `/api/comercial` (la prefactura desde el ticket) |

### 3.2 No hay backend nuevo: se adapta DESPUÉS de migrar el backend (§2)

`features/qhse/{derrames, desechos, emergencias, investigaciones, legal, objetivos-ambientales, aspectos-ambientales, dashboard}` y `core/services/qhse-avisos-feeder.service`: hoy funcionan contra la demo y se conectan al backend nuevo cuando exista. **Se conserva el diseño actual de esas pantallas** (escritorio y móvil).

### 3.3 Qué verificar en cada pantalla adaptada

- Ids como `string` UUID en rutas, selects y almacenamiento del navegador (`localStorage`); nada que asuma ids numéricos.
- Un solo `mensajeDeError` y un solo patrón de adaptador (servicio nuevo + mapeador puro + prueba).
- Permisos nuevos reflejados en menú, rutas y botones; sin pantallas colgando de roles retirados (`coordinador_hse`, `ingenieria_ventas_fcr`).
- Mismo aspecto que la demo en **escritorio** y **móvil**: mismos componentes del sistema de diseño, mismos encabezados («OPERATIVO · …», banner de turno, avance del ticket), mismas tablas con desplazamiento horizontal propio, mismos diálogos.
- Hojas imprimibles (PDF) con el mismo formato que la demo.

---

## 4. Lista de verificación para dar un módulo por «migrado»

1. Paridad funcional con la demo (el plan del módulo lista qué debe hacer) y **prueba de paridad rol × endpoint** contra `module-roles.ts` de la demo.
2. Base normalizada y con el estándar de §0.1; pruebas de integración que intentan violar las reglas.
3. Eventos y consumidores idempotentes; plantillas de avisos si aplica; semillas.
4. Frontend adaptado **respetando el diseño de la demo en escritorio y móvil** (§0.2), sin servicios de la demo huérfanos.
5. Gateway: prefijos movidos o retirados; `routes.spec.ts` al día.
6. Sombra, corte y limpieza de lo transitorio (puentes `manual_temporal`, columnas `legacy_id`) con migración y entrada en `REGISTRO-DE-CAMBIOS-COMPARTIDOS.md`.

## 5. Decisiones y consultas externas que desbloquean pendientes

- **Del usuario / Dynadrill:** D2 (Pumping a `flota.unidad`), B7 (¿la herramienta de FCR mueve el kardex?), qué del Reporte Diario de Pumping se mantiene (§2.6), IN1–IN8, fórmulas de KPI de Mantenimiento, umbrales de derrames, flujo de Inspección → Tipo de operador en FCR.
- **De terceros:** lista blanca de AS2 con TI; productos y existencias en la API de Asinfo.
- **Estado de las decisiones ya tomadas:** `03-DECISIONES-PENDIENTES.md` (D6, D9, D10, D11, D13 resueltas el 21/10/2026; D3, D7, D12, D14 y otras siguen con opción recomendada).

## 6. Orden sugerido de trabajo

1. Cerrar lo ya construido (§2.2–§2.7 y §3.1): conexiones B3, B5–B7, adaptar frontends y retirar servicios de la demo, con pruebas de punta a punta en el navegador (escritorio y móvil).
2. Construir QHSE Q4 → Q5 → Q6 (§2.1), cada uno con su pantalla adaptada.
3. Auditoría y Firmas, luego Reportería y Dashboard (§2.8–§2.9).
4. Corte de la demo módulo por módulo (§2.11) y retiro del puente de identidad.
