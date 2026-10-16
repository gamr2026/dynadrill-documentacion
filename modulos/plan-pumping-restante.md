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
