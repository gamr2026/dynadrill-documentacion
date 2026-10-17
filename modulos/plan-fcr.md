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
