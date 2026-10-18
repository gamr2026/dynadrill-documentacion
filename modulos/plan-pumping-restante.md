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
- Pruebas: 18 de integración (4 nuevas).
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
