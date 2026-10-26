# Plan: FCR (Fishing, Completion & Remedial)

**Schema:** `fcr` · **Contenedor:** operaciones (3103) · **Librería:** `libs/operaciones/fcr` (`@dyn/fcr`) · **Prefijo HTTP:** `/api/operaciones/fcr`
**Estado:** por construir · **Ola:** 2 (necesita Inventario y Flota; conviene que QHSE ya publique SWA) · **Tamaño:** grande (≈ 1.800 líneas de backend y ≈ 5.900 de frontend en la demo)
**Lea antes:** `00`, `01`, `02` (4.1, 4.2, 4.4, 4.5, 4.10, 4.11), `03`, `04-REVISION-CONTRA-DEMO-MAIN.md` (hallazgos 4, 5, 6, 10) y `plan-comercial-ajustes.md`. **Revisado contra el `main` de la demo (08/10/2026).** De la demo: `dynadrill-frontend-platform/specs/ot-fcr/*`, `specs/fcr-precarga-herramientas/*`, `specs/fcr-bitacora-envio-diario/*`, `documentacion/fcr/*.xlsx`.
**Referencia de implementación:** `libs/operaciones/pumping` (ticket por pedido, pasos y roles en base de datos, requisitos por paso, eventos, avisos).

## 1. Objetivo

Llevar el ticket de servicio de la línea **FCR** (pesca, completación y remediales) desde que Ventas abre el pedido hasta el cierre, con la preparación e **inspección de herramientas**, el registro diario y el envío de reportes a Facturación.

## 2. Qué hay en la demo

| Parte | Dónde |
|---|---|
| Backend | `dynadrill-backend/libs/domains/operaciones/src/fcr-tickets` (`fcr-tickets`, `fcr-domain`, `fcr-actions`, `fcr-documentos` (adjuntos con 6 campos), `fcr-tool-inspecciones`) y `workflow/` (mapas rol↔paso) |
| Frontend | `features/operations/fcr` (≈ 5.900 líneas) y `features/operations/shared` (progreso del ticket, banner QHSE) |
| Specs vigentes (más nuevas que el backend) | `specs/ot-fcr` (flujo dual y catálogos), `specs/fcr-precarga-herramientas`, `specs/fcr-bitacora-envio-diario` |
| Formatos | `documentacion/fcr/`: inspección y dimensionamiento de herramientas, inspección y reparación, movimiento local y de retorno, prueba de *intensifier*, prueba de *jar*, registro de dureza, inspección de moledores |

Flujo (`FcrPhase`): **dos entradas que confluyen en un tronco común** (spec `ot-fcr`).
- Entrada **SERVICIOS** (OT tipo servicio): `tipo_operador` → `inspeccion` (formulario de inspección con 6 adjuntos) → `aprobacion_supervisor_operaciones`.
- Entrada **VENTA** (OT tipo venta): `revision_inicial` (la validación del programa).
- **Tronco común**: `preparacion_herramientas` → `asignacion` (de operador) → `reunion_operativa` → `ejecucion_operativa` → `revision_reportes` → `control_retorno` → `cierre`.
- El **tipo de OT** (`venta` | `servicio`) se decide en el **pedido** (ya existe en `comercial`: `pedido.tipo_ot`); FCR lo hereda del evento. Roles propios: `operador_fcr`, `supervisor_operaciones_fcr`.

Otras reglas vistas:
- **Herramientas del pedido**: cada línea del pedido es un **código de lista de precios**, no una herramienta. En el `main` hay una **configuración por cliente + código** (`ConfiguracionCodigoFcr`) con **`clase`: `herramienta` o `servicio`** (la **movilización no es una clase**: la marca el **pedido**, con su tipo de línea «Movilización») y, para `herramienta`, un **kit** de artículos de Inventario (categoría `HERRAMIENTAS`, con partes) con cantidades. La configuración es **aparte** de la lista de precios a propósito (esa tabla se recrea al importar). La arma **Ventas FCR** desde la pantalla «Códigos por cliente» (en el portal nuevo, Ingeniería de Ventas: D4). El ticket se crea con las herramientas **precargadas**; hay una **recarga desde el pedido** si cambia; la movilización se muestra aparte, sin acción de Bodega.
- **Inspección de herramientas**: por herramienta del ticket, un checklist con las **partes del artículo** (copia fija de las partes al iniciar: un cambio posterior al catálogo no altera una inspección iniciada; si la herramienta no trae partes, o falta una, quien inspecciona **agrega partes a mano** —columna `manual`— y solo esas se pueden quitar), resultado visual y por END (`ok`/`defectuoso`), cambio de elemento (informativo; no mueve el kardex), tres firmas, estados `borrador → enviado → aprobado/rechazado`. Inspeccionado y reparado por `dynadrill` o `proveedor_externo`.
- **Bitácora diaria**: el operador **envía día por día** a Facturación (sin aprobación del Supervisor por día; reenviar no duplica); una sola fuente de verdad (la bitácora del ticket); el Reporte Job del día se regenera. **Reglas del `main`**: la bitácora y el uso de herramientas **no se salen de las fechas del servicio del pedido**; el **operador corrige solo durante la ejecución, antes de finalizarla**; **Facturación corrige hasta que el pedido sale al cliente para firmas** (`fcrBitacoraCorreccion`: Operador FCR y Facturación).
- **Cierre**: **solo desde la fase Cierre y una sola vez** (después es de solo lectura); **exige el Acta de Entrega de Locación** (QHSE, contrato 4.11) y al cerrar se **genera la prefactura** si la documentación está completa (contrato 4.10). El Supervisor ve «Ver prefactura» y gestiona la firma del Company Man (`prefacturaTicket`).
- **Documentos QHSE en el ticket de FCR**: el Supervisor sube **ART y PT** del día (`fcr-documentos-qhse`); QHSE los ve en «Documentos por pedido».
- **Reporte de herramientas y Reporte Job**: se envían a `comercial` como documentos operativos (`origen: fcr`).

## 3. Qué hacen los otros módulos

- **Comercial** abre el pedido y publica `comercial.pedido.abierto` (`lineaServicio: 'fcr'`, `tipoOt`); recibe los documentos operativos (contrato 4.4).
- **Inventario** administra artículos, partes y kardex; FCR consume su servicio (herramientas, salidas y retorno).
- **Flota** (unidades) y **Mantenimiento** (reporte de unidad de llegada, contrato 4.2): FCR publica `operaciones.fcr.reporte_unidad_llegada` igual que Pumping.
- **QHSE**: SWA activa bloquea el reporte (D10); banner QHSE en el ticket; PTW.
- **Pumping** (otra línea): comparte el patrón, no el código.

## 4. Modelo de datos propuesto

Siga el patrón de `pumping`: `paso`, `paso_rol`, `transicion`, `requisito`/`paso_requisito`/`ticket_requisito`, `ticket`, `ticket_historial`, `ticket_persona`, con **dos recorridos** (entrada servicios / entrada venta) modelados en `transicion` (con una columna `entrada` o con pasos distintos de arranque).

- `ticket` (`pedido_id` único sin FK a comercial (otro contenedor, D1), ids de catálogo con FK: cliente, campo, bloque, pozo, taladro, `tipo_ot` enum, `numero_ticket` = el de la prefactura reservado por comercial (**no** invente numeración: ver `pumping`), `paso_codigo`).
- Catálogos fijos de la spec (`fcr-catalogos-roles`): `tipo_operador`, `tipo_completacion`, `tipo_picker`, `tipo_trabajo` como **tablas**.
- `configuracion_codigo_fcr` (`cliente_id`, `codigo` de lista de precios, `clasificacion` enum) y `configuracion_codigo_fcr_kit` (`configuracion_id`, `articulo_id` FK a `inventario.articulo`, `cantidad`).
- `ticket_herramienta` (`ticket_id`, `articulo_id`, `cantidad`, estado: seleccionada/instalada/devuelta, número de serie).
- `inspeccion_herramienta` (`ticket_herramienta_id`, fechas, `inspeccionado_por` enum, `reparado_por` enum, estado enum) + `inspeccion_herramienta_parte` (copia fija de la parte: `articulo_parte_id` FK **y** columnas copiadas solo si el negocio exige que no cambien —documentado como documento emitido—; resultados `visual`, `end` enums, `cambio_cantidad`, `accion`) + tres firmas (`inspeccion_firma`: rol, usuario FK, fecha).
- `ticket_documento` (`ticket_id`, `campo` enum de los 6 adjuntos, `archivo_id` FK a `archivos.archivo`).
- `bitacora_dia` (`ticket_id`, `fecha`, enviada_at/por) y `bitacora_actividad` (`bitacora_dia_id`, hora inicio/fin, detalle, tablas) — es la **fuente** del Reporte Job.
- Reportes de unidad: igual que `pumping.reporte_unidad` (puede **reutilizar el diseño**; no comparta tablas entre módulos: cada uno con el suyo, Mantenimiento referencia ambos).

## 5. Eventos

**Consume:** `comercial.pedido.abierto` (crea el ticket si `lineaServicio = 'fcr'`).
**Publica:** `operaciones.fcr.ticket_creado`, `.asignacion_realizada` (con `asignados` y `operadoresUnidades`), `.paso_cambiado`, `.reporte_unidad_llegada`, `.bitacora_enviada` (cada día), `.cerrado`; avisos por cuenta elegida.

## 6. API y permisos

`/api/operaciones/fcr/tickets` (misma forma que Pumping: lista `mios`, detalle, avanzar, asignar), `.../herramientas`, `.../inspecciones`, `.../documentos`, `.../bitacora`, `/api/operaciones/fcr/configuracion-codigos`. Permisos: ya existen `fcr.tickets.operar` y `fcr.tickets.ver`; agregue los de inspección, configuración de códigos y bitácora. **Solo el equipo asignado ve y mueve el ticket** (mismo criterio que Pumping).

## 7. Pantallas

`features/operations/fcr/*` con servicios nuevos hacia `/api/operaciones/fcr`; formatos imprimibles de los xlsx de `documentacion/fcr`.

## 8. Tramos

1. **C1 — Catálogos, ticket y pasos** (ambas entradas), bandeja, avisos, consumo del evento de pedido abierto.
2. **C2 — Herramientas** (configuración por cliente y código, kits, preparación, "solicitar a Bodega" con Inventario).
3. **C3 — Inspección de herramientas** (partes, firmas, adjuntos reales).
4. **C4 — Asignación, ejecución y bitácora diaria** (envío a comercial, regeneración del Reporte Job).
5. **C5 — Revisión, control de retorno, reporte de unidad de llegada y cierre.**

## 9. Pruebas

Integración: ambas entradas llegan al mismo tronco, kit por cliente y código, snapshot de partes inmutable, firmas, bitácora día por día con corrección de Facturación, equipo asignado, eventos.

## 10. Consultas (`documentacion/fcr/CONSULTAS-PARA-DYNADRILL.md`, sección `## FCR`)

Las "Open Questions" de `specs/ot-fcr/SPEC-fcr-flujo-dual.md` y `specs/fcr-precarga-herramientas/SPEC.md`; ¿los dos documentos de la rama VENTA (registro de dureza y QAQC firmado) son campos del ticket?; ¿cuántos días máximos para corregir una bitácora ya enviada?

## 11. Puntos de choque

Los de Flota/Mantenimiento/Inventario (`permissions.ts`, `app.module.ts` de operaciones, `package.json`, `tsconfig.base.json`, `plantillas/fcr.ts`). **No** toque `libs/operaciones/pumping`: si un patrón común conviene (pasos, requisitos), **cópielo** y proponga la extracción a una librería compartida en `03-DECISIONES-PENDIENTES.md`.

## 12. Preguntas abiertas entre módulos

_(Inventario: ¿kits y partes de herramientas ya modelados como `articulo_parte`? · Comercial: ¿el evento de pedido abierto trae todo lo que FCR necesita para el kit?)_

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

## 12. Encargo de la sesión (18/10/2026)

**Estado:** sin construir (no existe `libs/operaciones/fcr`). **Pumping ya está construido y es la referencia viva**: copie su estructura y sus decisiones, no su código (cada módulo con sus propias tablas).

**Qué reutilizar de Pumping (ya probado)**
- Pasos, roles y transiciones en tablas; requisitos por paso (`requisito`, `paso_requisito`, `ticket_requisito`) cumplidos desde el módulo, por evento de otro módulo o por el puente temporal; solo el equipo asignado mueve el ticket (`puedeActuarEn`).
- Asignación con equipo y unidades, y `operaciones.fcr.asignacion_realizada` con `asignados` y `operadoresUnidades` (QHSE abre el EPI por cada operador).
- Reporte de unidad de salida y de llegada (`operaciones.fcr.reporte_unidad_llegada`; Mantenimiento lo recibirá: la FK `fcr_reporte_unidad_id` y el CHECK de origen los agrega la sesión principal cuando exista su tabla).
- **Reporte diario (bitácora) → Comercial por evento:** copie `reportes-diarios.service.ts` de Pumping (borrador, completar, reabrir, bloqueo del día corregido por Facturación con `comercial.documento_operativo.corregido`, origen `fcr`) y publique `operaciones.fcr.bitacora_enviada` con la misma forma que `operaciones.pumping.reporte_diario_completado`. En Comercial agregue (edición pequeña, anótela en el registro) el patrón ya hecho en `consumers/reporte-diario.consumer.ts` para el origen `fcr`; el **Reporte de Herramientas** (`tipo: reporte_herramientas`) usa el mismo mecanismo.
- Cierre: publica `operaciones.fcr.cerrado` (Comercial ya lo consume y genera la prefactura si la documentación está completa); exige el **Acta de Entrega** (QHSE, contrato 4.11) y «Ver prefactura» / firma del Company Man desde el ticket (endpoints de Comercial `prefactura-vista` y `prefactura/firma-company-man`; el diálogo del frontend está en `pumping/tickets-nuevos/components/ticket-prefactura-dialog`: pida a la sesión principal moverlo a un lugar compartido o impórtelo).
- Herramientas y artículos: Inventario ya tiene artículos con partes (`articulo_parte`) y kardex; use su servicio exportado (con transacción **propia**, ver regla 1 de la sección 9 de `01-REGLAS-DE-COORDINACION.md`).

**Orden de trabajo:** F1 contenedor + ticket + pasos + asignación (los dos recorridos), F2 configuración por cliente y código + herramientas del ticket, F3 inspección de herramientas, F4 bitácora y reportes a Comercial, F5 retorno, cierre y prefactura, F6 frontend de cada tramo (`features/operations/fcr`, con el patrón adaptador, sin tocar las pantallas viejas hasta el Corte).

**Antes de empezar:** las consultas de FCR (sección 10 de este plan) van en un archivo nuevo, `documentacion/fcr/CONSULTAS-PARA-DYNADRILL.md`, que usted crea; cualquier decisión de negocio va a `03-DECISIONES-PENDIENTES.md`. Commit con `scripts/commit-modulo.ps1 -Modulo fcr`.

## 13. Avance de la sesión (18/10/2026)

**Estado:** F1 y F2 entregadas (F1: contenedor, ticket, pasos y asignación con los dos recorridos; F2: configuración por cliente y código y herramientas del ticket). Consultas de negocio en `documentacion/fcr/CONSULTAS-PARA-DYNADRILL.md` (F-1 a F-25, cada una con la opción conservadora que se aplicó).

### F1 — ticket, pasos y asignación (hecho)

- **Librería** `libs/operaciones/fcr` (`@dyn/fcr`), schema `fcr`, migración `20261018150000_init` (aplicada) y semilla `npm run db:seed:fcr` (12 pasos, 12 transiciones, requisitos y catálogos).
- **Los dos recorridos son datos, no código:** `entrada_ot` dice en qué paso nace cada tipo de OT (venta → `revision_inicial`, servicio → `tipo_operador`); `transicion` y `paso_requisito` hacen el resto. No existe ninguna transición que lleve a un ticket de venta a la entrada de servicios (prueba de integración).
  - Venta: `revision_inicial → preparacion_herramientas`.
  - Servicios: `tipo_operador → inspeccion → aprobacion_supervisor_operaciones → preparacion_herramientas` (el rechazo vuelve a `inspeccion` con motivo).
  - Tronco: `preparacion_herramientas → asignacion → reunion_operativa → ejecucion_operativa → revision_reportes → control_retorno → cierre → cerrado`. El rechazo de la revisión vuelve a la ejecución con motivo. `cierre` es el paso del Supervisor y `cerrado` el terminal (publica `operaciones.fcr.cerrado`).
- **Quién actúa:** `paso_rol` (FK al código de `identidad.rol`) y `paso.requiere_equipo`. Los pasos de arranque (`revision_inicial`, `tipo_operador`), la aprobación de SERVICIOS y el control de retorno (Bodega) los atiende cualquier cuenta del rol; el resto, solo el equipo asignado (`ticket_persona` + `ticket.inspector_id`) o quien coordina (Superadmin y Jefe de Base, solo si el rol del paso lo permite). El Supervisor que saca el ticket de un paso de arranque queda como su supervisor.
- **Bandeja** `GET /api/operaciones/fcr/tickets?mios=true`: los pasos sin equipo se ven por rol; los demás, solo si es del equipo.
- **Asignación** `POST tickets/:id/asignar`: operadores (cuenta `operador_fcr`) con su unidad opcional; pasa a `reunion_operativa`, crea los requisitos de operador/unidad y publica `operaciones.fcr.asignacion_realizada` (`asignados`, `operadoresUnidades` con `vehiculoId` posiblemente nulo).
- **Entrada de SERVICIOS** `POST tickets/:id/tipo-operador` (tipo de operador + operador FCR que inspecciona); requisito `tipo_operador_definido`.
- **Catálogos** (tablas con id uuid, código único y auditoría): `tipo_operador`, `tipo_completacion`, `tipo_trabajo`, `tipo_picker`; `GET /api/operaciones/fcr/catalogos`.
- **Consumo** de `comercial.pedido.abierto` (cola propia `operaciones.comercial.fcr`, grupo `fcr`): crea el ticket (uno por pedido, idempotente). Un pedido sin tipo de OT se trata como venta.
- **Eventos publicados:** `operaciones.fcr.ticket_creado`, `.paso_cambiado`, `.asignacion_realizada`, `.cerrado`. Avisos: `fcr_ticket_creado_supervisor`, `fcr_asignacion_supervisor` y `fcr_asignacion_operador` (campanita y correo).
- **Permisos:** reutiliza `fcr.tickets.operar` y `fcr.tickets.ver`; nuevo `fcr.requisitos.puente` (Superadmin y Jefe de Base).

**Estándar de calidad (verificado):** sin datos duplicados (el nombre de cliente, campo, pozo, taladro, persona y unidad sale del JOIN; las únicas copias son `pedido_codigo` y los códigos de tipo de servicio, de otro contenedor y con `COMMENT`); todas las FK reales dentro del servidor (el pedido es el único id sin FK, por ser de `comercial`, con `COMMENT`); catálogos en tablas y valores fijos en enums; CHECK (`ticket_servicios_check`, `ticket_fechas_check`, `ticket_persona_unidad_check`, `ticket_requisito_*`), FK compuestas (unidad del operador, requisito de unidad u operador), índices únicos (un supervisor por ticket, un requisito por clave); historial inmutable (`REVOKE UPDATE, DELETE`); auditoría `created_by/updated_by` con FK en `ticket` y en los catálogos; permisos de lectura de otros schemas mínimos; 33 pruebas de integración con base real, 8 de ellas intentan violar las reglas de la base.

**Decisiones de diseño que conviene revisar** (cada una aislada y reversible): `cierre` + `cerrado` como dos pasos (la demo tenía solo `cierre` y su macro era «aprobado»); no hay fase «reparación» (es un dato de la inspección, F-7); el Supervisor «toma» el ticket al sacarlo del arranque en vez de que lo asigne alguien (F-3 y F-4).

**Pendiente:** F2 (configuración por cliente y código, kits, herramientas del ticket), F3 (inspección), F4 (bitácora y reportes), F5 (retorno, reporte de unidad, cierre), F6 (frontend de cada tramo). QHSE debe suscribirse a `operaciones.fcr.asignacion_realizada` para abrir la entrega de EPI de cada operador (hoy solo lee la de Pumping).

### F2 — configuración por cliente y código, y herramientas del ticket (hecho)

- **Migraciones aplicadas:** `20261018160000_herramientas` y `20261018161000_herramienta_autor_de_la_precarga`.
- **Configuración por cliente y código** (`configuracion_codigo` + `configuracion_codigo_kit`): clasificación `herramienta` o `servicio` (enum); un código sin fila es servicio; **la movilización no es una clase** (la marca el pedido con su tipo de línea). La base garantiza que solo una `herramienta` lleva kit (FK compuesta con la clasificación) y que cada artículo del kit es una herramienta activa de Inventario (disparador sobre `categoria_articulo.lleva_partes`, sin comparar nombres). Endpoints `GET/PUT/DELETE /api/operaciones/fcr/configuracion-codigos` (leer: `fcr.tickets.ver`; escribir: **`fcr.configuracion.gestionar`**, Ingeniería de Ventas, Superadmin y Jefe de Base). FCR no lee la lista de precios (es de `comercial`): la pantalla trae los códigos de allá y los cruza; las configuraciones sin código en la lista quedan «huérfanas» en la pantalla. Selector `GET .../herramientas-disponibles?q=` (artículos activos de categorías con partes; endpoint estrecho, no abre permisos de Inventario).
- **Líneas del pedido** (`ticket_linea`, copia justificada de otro contenedor): vienen en `comercial.pedido.abierto` y, **desde hoy**, `comercial.pedido.actualizado` trae `lineas` (si cambiaron los ítems) y las fechas de inicio y fin del servicio (campos compatibles; edición pequeña en `pedidos.service.ts` de Comercial, con prueba). FCR actualiza las líneas y las fechas del ticket; **las herramientas no se tocan solas**: el Supervisor decide cuándo «Recargar desde el pedido».
- **Precarga** (`PrecargaService`): un juego del kit por unidad cotizada, salvo unidad de tiempo (tabla `unidad_cotizacion`, columna `es_tiempo`: día, hora, semana y mes): 1 juego. Cada herramienta física es una fila. Lo que no se resuelve queda como aviso (`ticket_aviso_precarga`: `pedido_sin_cliente`, `sin_configurar`, `kit_vacio`, `articulo_inactivo`), nunca como fallo. Recargar quita solo las herramientas del pedido nunca solicitadas, conserva las demás y las manuales, y agrega lo que falta; no se puede con el listado confirmado.
- **Herramientas del ticket** (`ticket_herramienta`): el estado **se deduce de las marcas** (solicitada → preparada → enviada → recibida → devuelta o faltante; CHECK que obliga el orden, la pareja quién/cuándo y que una novedad no convive con la marca de su paso) y cada marca deja un evento inmutable en `ticket_herramienta_evento` (sin UPDATE ni DELETE; una herramienta con historia no se puede borrar). Flujo: el Supervisor solicita a Bodega (evento `operaciones.fcr.herramientas_solicitadas` y aviso al rol `bodeguero`), Bodega prepara (con o sin novedad) y envía (permiso **`fcr.herramientas.preparar`**), el Supervisor recibe (con o sin novedad); cada paso se puede corregir mientras el siguiente no ocurra. Bodega tiene su bandeja `GET .../herramientas/pendientes-de-bodega`. Existencia informativa por artículo con `MovimientosService.stockDe` (Inventario); **no se mueve el kardex** (consulta F-10).
- **Requisitos para salir de la preparación:** `listado_herramientas_confirmado` (lo confirma el Supervisor; confirmado no se agrega, quita ni recarga) y `herramientas_recibidas` (se mantiene solo: cumplido cuando ninguna herramienta está sin recibir; sin herramientas, cumplido). Una herramienta agregada después (`agregada_tarde`) o dañada a sustituir se puede agregar en los pasos siguientes.
- **Pruebas:** 63 en total en la librería (27 nuevas de integración con base real, 7 de ellas intentan violar las reglas de la base, y las unitarias del estado y la unidad), más 1 en Comercial.
- **Estándar de calidad:** sin copias de nombre (el artículo y el cliente se leen por JOIN; solo `codigo_pedido`, el código de línea del pedido, es copia de otro contenedor y está justificado en la base); FK reales a `inventario.articulo` y `catalogos.cliente`; catálogos y enums; auditoría `created_by/updated_by` con FK (la precarga queda sin autor si quien abrió el pedido no es una cuenta; una herramienta manual siempre lo tiene); historia inmutable; permisos mínimos.

### F3 — inspección de herramientas, documentos y aprobación de SERVICIOS (hecho)

- **Migración aplicada** `20261018170000_inspeccion_de_herramientas`. Tablas: `inspeccion_herramienta` (estado `borrador → enviada → aprobada | rechazada`, quién inspeccionó y reparó = enum `dynadrill | proveedor_externo`, fechas, nota; **cliente, pozo, descripción y serie se leen por JOIN** al ticket, artículo y herramienta), `inspeccion_parte` (copia fija de item, código, descripción y cantidad esperada de la parte del artículo, con FK `ON DELETE SET NULL` a `inventario.articulo_parte`; resultado visual y por END `ok | defectuoso`; cambio de elemento informativo; `manual` para las que agrega quien inspecciona), `inspeccion_firma` (inmutable; reparado por → revisado por → liberado por QHSE), `firma_rol_permitido` (qué roles dejan cada firma, en tabla) y `ticket_documento` (los seis campos de la demo; inmutable, vigente = el último).
- **Reglas que garantiza la base:** una sola inspección vigente por herramienta (índice parcial) y versión única; estado y marcas coherentes; solo herramientas de tickets de servicios; cabecera y partes bloqueadas desde que «reparado por» firma o se envía; la parte copiada no se edita y solo se borran las manuales (y si Inventario da de baja la parte, la copia queda); las firmas exigen el orden y el rol de la cuenta; el documento solo enlaza archivos del módulo `ticket_fcr_documento` no eliminados; una herramienta con inspección no se borra; **un ticket solo cambia de paso por una transición activa del catálogo** (disparador).
- **Transiciones «por acción propia»** (`transicion.solo_por_accion`): `asignacion → reunion_operativa` (asignar), `aprobacion → preparacion_herramientas` (aprobar) y `aprobacion → inspeccion` (rechazar). El avance genérico no las ofrece.
- **Flujo:** `POST tickets/:id/herramientas/:h/inspeccion` (inicia, idempotente; copia las partes), `PUT inspecciones/:i` (cabecera y serie), `PUT/POST/DELETE .../partes`, `POST .../firmas/:rol`, `POST .../enviar`, `POST aprobar-inspecciones` y `POST rechazar-inspecciones` (motivo; todas las enviadas o las herramientas indicadas). Rechazar deja las inspecciones como historia y las rehace como **versión nueva con lo registrado y sin firmas** (consulta F-18); avisa al operador que inspecciona. Salir de `inspeccion` exige los requisitos `inspecciones_enviadas` (mantenido solo) y `formulario_inspeccion_externo` (consulta F-9). Documentos: `GET/POST tickets/:id/documentos`; módulo de archivos nuevo `ticket_fcr_documento` (`npm run db:seed:archivos`).
- **Avisos:** `operaciones.fcr.aprobacion_solicitada` (al rol `supervisor_operaciones_fcr`) y `operaciones.fcr.inspeccion_rechazada` (al operador, por cuenta).
- **Pruebas:** 78 en la librería (15 de F3, la mitad intenta violar las reglas de la base).

### F4 — reunión operativa, bitácora diaria, uso de herramientas y revisión de reportes (hecho)

- **Migración aplicada** `20261018180000_bitacora_y_uso_de_herramientas`. Tablas: `reunion_operativa` (acta, una por ticket), `bitacora_dia` + `bitacora_actividad` (una por día; enviada/corregida; autor de cada actividad), `uso_herramienta_dia` (estado de cobro `operacion | stand_by | daily_charge | venta` —el mismo que recibe Comercial—, y, si se registra, completación **o** tipo de trabajo, picker, presión, peso y observación; una fila por herramienta y día). La base garantiza que los días de bitácora y de uso caen dentro de las fechas del servicio del pedido (disparadores), la exclusión completación/trabajo, medidas no negativas y un día por ticket.
- **Pasos:** `reunion_operativa → ejecucion_operativa` exige el requisito `acta_reunion_operativa` (`PUT tickets/:id/reunion-operativa`). La ejecución termina con la acción **`POST finalizar-ejecucion`** (exige la bitácora enviada —todos sus días— y el listado de uso confirmado, y envía el Reporte de Herramientas); la revisión es `aprobar-reportes` (→ control de retorno) o `rechazar-reportes` con motivo (→ ejecución; el listado de uso se reconfirma). Las tres son transiciones «por acción propia».
- **Bitácora** (`GET/PUT tickets/:id/bitacora[/:fecha]`, `POST .../enviar`): el operador envía **día por día** a Facturación sin aprobación; evento `operaciones.fcr.bitacora_enviada` con la forma de `operaciones.pumping.reporte_diario_completado`. Un día ya enviado que el operador corrige **se reenvía solo** y no puede quedar vacío; reenviar no duplica (Comercial reemplaza por clave). El operador corrige solo mientras el ticket está en ejecución. Facturación corrige hasta que el pedido sale al cliente: Comercial avisa con `comercial.documento_operativo.corregido` (`origen: fcr`) y el día queda `corregido` (no se edita ni reenvía).
- **Reporte de Herramientas** (`operaciones.fcr.reporte_herramientas_completado`): una sola vez al finalizar, solo con las herramientas con uso, con `codigo` = código de la línea del pedido (con él factura Comercial) y sus usos por día (consulta F-21).
- **Uso de herramientas** (`GET/PUT/DELETE tickets/:id/uso-herramientas…`): exige la herramienta recibida y sin retorno; cualquier cambio reabre `listado_uso_confirmado`.
- **Comercial** (edición pequeña en `consumers/reporte-diario.consumer.ts`): la misma suscripción recibe también los dos eventos de FCR y los guarda como documento operativo de origen `fcr` (`reporte_job` y `reporte_herramientas`); dos pruebas nuevas en `documentos-operativos.integration.spec.ts`.
- **Pruebas:** 92 en FCR (14 nuevas) y 21 en la suite de documentos operativos de Comercial.

### F5 — retorno, reporte de unidad de llegada y cierre (hecho)

- **Migración aplicada** `20261018190000_retorno_y_cierre`: `ticket_herramienta.faltante_causa` (enum `venta_complementaria | perdida | dano | otro`; el detalle va en `faltante_motivo`; CHECK de que causa, motivo, quién y cuándo van juntos) y `reporte_unidad_llegada` (uno por ticket y unidad con FK compuesta a `ticket_unidad`; **inmutable**: sin UPDATE ni DELETE; CHECK de que una operación interrumpida se explica y una que no, no lleva detalle).
- **Control de retorno** (Bodega, permiso `fcr.herramientas.preparar`): `POST tickets/:id/herramientas/devolver` (las indicadas o todas las recibidas) y `POST .../:herramienta/faltante` (causa + detalle), cada una con su evento inmutable; `GET herramientas/pendientes-de-retorno`. Requisito `herramientas_devueltas` (mantenido solo). No mueve el kardex (F-10).
- **Reporte de unidad de llegada** (`GET/POST tickets/:id/reportes-unidad-llegada[/:vehiculo]`): lo firma el operador asignado a esa unidad en el control de retorno; cumple el requisito de su unidad y publica `operaciones.fcr.reporte_unidad_llegada` (`ticketId`, `vehiculoId`, `reporteUnidadId`, `hayNovedades`). Sin unidades en la asignación no se pide (F-5). **FCR no tiene reporte de salida**: el servicio no tiene traslados y la demo no lo tiene (consulta F-26); las novedades quedan en las columnas de la tabla para que Mantenimiento las lea con FK real cuando la sesión principal agregue `fcr_reporte_unidad_id`.
- **Cierre:** `control_retorno → cierre` exige devolución completa y los reportes de llegada; `cierre → cerrado` exige el **Acta de Entrega de Locación** (requisito `acta_entrega_locacion`, dueño QHSE) que cumple `ActaEntregaConsumer` con `qhse.acta_entrega.cargada` (o `qhse.documento.acta_entrega_cargada`, el nombre del contrato 4.11) y reabre `qhse.acta_entrega.anulada` (cola propia `operaciones.qhse.fcr`); mientras QHSE no publique, el puente temporal con motivo (`fcr.requisitos.puente`). Al llegar a `cerrado` se publica `operaciones.fcr.cerrado` (Comercial genera la prefactura si la documentación está completa); `cerrado` es de solo lectura y no se cierra dos veces (no hay transición de salida).
- **Pruebas:** 98 en la librería (6 nuevas de F5, incluido el recorrido completo con unidad de punta a punta).

### F6 — frontend (hecho el 18/10/2026; commit 74b3090 en `modulo/fcr` del frontend, sin subir)

- **Ubicación:** `src/app/features/operations/fcr/tickets-nuevos/` (modelo con funciones puras y su spec, servicio `TicketsFcrService` con todos los endpoints, bandeja, detalle del ticket, paneles de herramientas, inspecciones, documentos, ejecución y retorno, y los diálogos de cada acción). Las pantallas viejas de la demo no se tocaron: conviven hasta el Corte.
- **Rutas:** `/modulos/operativo/fcr/pedidos` y `/pedidos/:id`, autorizadas por el permiso `fcr.tickets.operar` (no por rol). Menú: entrada «Pedidos de FCR» (`navigation.service.ts`, edición mínima) para los roles de operaciones y QHSE que ya veían FCR; Ventas FCR no la ve.
- **Detalle por paso:** tipo de operador, asignación, acta de reunión, finalizar ejecución, aprobar o devolver reportes, «Confirmar a mano (temporal)» para requisitos de otros módulos (puente), historial, prefactura de solo lectura y Acta de Entrega en el cierre.
- **Verificación:** `ng build` sin errores en lo de FCR (hoy falla solo por `qhse/iperc-maestra`, de otra sesión: variante de banner `error`/`success` inexistente), `ng test` de FCR (59 pruebas) y de navegación (16) en verde.
- **Pendiente de F6:** pantalla de «Códigos por cliente» contra `/api/operaciones/fcr/configuracion-codigos` (la de la demo sigue vigente), bandeja propia de Bodega (el backend ya expone `herramientas/pendientes-de-bodega` y `pendientes-de-retorno`) y prueba manual de punta a punta en el navegador.
