# Plan: Mantenimiento

**Schema:** `mantenimiento` · **Contenedor:** operaciones (3103) · **Librería:** `libs/operaciones/mantenimiento` (`@dyn/mantenimiento`) · **Prefijo HTTP:** `/api/operaciones/mantenimiento`
**Estado:** por construir · **Ola:** 1 (empieza cuando Flota tenga la tabla `unidad`; mientras tanto puede avanzar con el diseño y las órdenes)
**Lea antes:** `00-CONTEXTO-COMPARTIDO.md`, `01-REGLAS-DE-COORDINACION.md`, `02-CONTRATOS-ENTRE-MODULOS.md` (4.2 y 4.3), `03-DECISIONES-PENDIENTES.md` (D2, D14), `04-REVISION-CONTRA-DEMO-MAIN.md` (hallazgo 8) y `plan-flota.md`. **Revisado contra el `main` de la demo (08/10/2026).**

## 1. Objetivo

Recibir los **reportes de unidad** (de Pumping, FCR, inspección de vehículos o QHSE), que el Jefe de Mantenimiento **clasifica**, y llevar las **órdenes y sub-órdenes** de mantenimiento correctivo y el **historial** de mantenimientos preventivos y correctivos, con los **indicadores (KPI)** del Plan de Mantenimiento 2026.

## 2. Qué hay en la demo

| Parte | Dónde |
|---|---|
| Backend `unit-reports`, `maintenance-orders`, `maintenance-suborders`, `historial-mantenimiento` | `dynadrill-backend/libs/domains/maintenance/src/...` (≈ 440 líneas; payloads JSON) |
| Modelos del frontend (fuente real de los campos) | `features/maintenance/models/{maintenance-order,unit-report,historial-mantenimiento}.model.ts` |
| Pantallas (≈ 5.000 líneas) | `features/maintenance/`: lista de reportes y órdenes, detalle, clasificación (MAN-001-A), ejecución, revisión de cierre, derivación a Pumping, retorno a operación, registro de preventivo, KPIs, "mis tareas", página del operador |
| Formatos y plan | `documentacion/mantenimiento/`: *Plan Mantenimiento Dynadrill 2026.docx*, *Reporte de Unidad V01 modif.xlsx*, *DYN-MNT-RE-008 Informe de mantenimiento V01.xlsx*, *Orden de Mantenimiento General.xlsx*, *Orden de Mantenimiento Operativo.xlsx*, el diagrama, y `aporte_documentacion_mantenimiento.txt` |
| Spec | `dynadrill-frontend-platform/specs/pumping-mantenimiento-fuera-de-flujo/SPEC.md` |

Reglas ya vistas:

- **Reporte de unidad (DYN-MNT-RE-012)**: lo registra el **Operador** en su área (Pumping/FCR), **no** Mantenimiento; Mantenimiento solo lo **recibe y clasifica** (MAN-001-A). Trae chasis, plataforma e instrumentación (cada ítem con resultado de salida y de llegada), problemas (mecánica, instrumentación, operaciones), si la operación se interrumpió y si la unidad queda lista.
- **Clasificación**: el Jefe de Mantenimiento descarta el reporte ("no requiere mantenimiento", **con motivo obligatorio**) o genera una **orden** con una o más **sub-órdenes** de tipo **Mecánico**, **Instrumental** u **Operativo**.
- **Sub-orden**: estados `Pendiente → En Diagnóstico → En Ejecución → En Revisión de Cierre → Cerrado`, con `Corrección Solicitada` (el Jefe rechaza el cierre con una nota) y `Derivado a Pumping` (solo Operativo: no se asigna a un mecánico, se deriva). Datos: diagnóstico, actividades correctivas, horas de trabajo, repuestos (número de parte, cantidad, descripción), trabajos adicionales, tiempos para KPI (inicio de ejecución, fin, aprobación del cierre).
- **Orden**: estados `Pendiente`, `En Mantenimiento`, `Requiere cambios`, `Aceptado`, `Rechazado`, `Cerrado`; la orden queda **Aceptada** cuando todas sus sub-órdenes están cerradas o derivadas. Estado final de la unidad: `Disponible` o `Con restricciones`; "retorno a operación".
- **Historial** (MAN-003): cada mantenimiento ejecutado (preventivo o correctivo; interno o de tercero; con proveedor; horómetro/km; checklist de fábrica adjunto; orden de origen). Es la fuente de cronograma, informe e indicadores. El **preventivo** actualiza el contador de la unidad (lo escribe Flota).
- **Mantenimiento ya no es un paso del ticket de Pumping** (spec y commit del 06/10/2026; la demo trae el script `migrate-pumping-sin-mantenimiento` que pasa los tickets parados en `mantenimiento` a la revisión de llegada): el ticket muestra una **tarjeta "Mantenimientos"** con **todas las sub-órdenes de la unidad** del ticket (no solo las originadas por él), visible siempre —también con el ticket cerrado— y sin bloquear nada. El Jefe y el Operador de Mantenimiento entran al ticket desde su bandeja («Ver ticket»): permiso de **lectura del detalle del ticket** (`pumpingDetalleRead` en la demo: Supervisor, Supervisor Pumping, Operador, Jefe y Operador de Mantenimiento). El Supervisor Pumping revisa las sub-órdenes Operativas desde esa tarjeta.
- **Indicadores (KPI)**: MAN-MASTER-001: tiempos de respuesta y de ejecución, cantidad por tipo, disponibilidad; separan unidades Pesadas y Livianas.

## 3. Qué hacen los otros módulos

- **Flota** (otra sesión) es dueña de `unidad`, sus lecturas y preventivos: usted **llama a su servicio exportado**, no escribe sus tablas.
- **Pumping/FCR** publican el reporte de unidad de llegada (contrato 4.2). En Pumping el reporte vive en `pumping.reporte_unidad` (ya construido): **usted lo referencia con FK** (mismo contenedor); no lo copia.
- **QHSE** puede originar un reporte por una inspección de vehículo-grúa rechazada (origen `QHSE`).
- **Inventario** puede ser el origen de los repuestos (más adelante; hoy son texto con número de parte).

## 4. Modelo de datos propuesto

Enums: `origen_reporte` (pumping, fcr, vehiculos, qhse), `tipo_mantenimiento` (mecanico, instrumental, operativo), `estado_suborden`, `estado_orden`, `estado_final_unidad` (disponible, con_restricciones), `clase_mantenimiento` (preventivo, correctivo), `ejecutado_por` (interno, tercero).

- `reporte_unidad_recibido` (`id`, `origen`, `reporte_unidad_id` FK a `pumping.reporte_unidad` o a la tabla equivalente de FCR/inspección — modele una columna por origen con `CHECK` de que solo una esté llena, **o** una tabla puente por origen; **no** un id polimórfico sin FK), `unidad_id` FK a `flota.unidad`, `recibido_at`, `descartado` + `motivo_descarte` + `descartado_por`, `orden_id`).
- `orden` (`codigo` por secuencial propio, `reporte_id`, `estado`, `estado_final_unidad`, `retorno_a_operacion_at`/`por`), `suborden` (`codigo`, `orden_id`, `tipo`, `estado`, `asignado_a` FK usuario, `asignado_por`, `derivada_a_pumping` + `nota_derivacion`, `diagnostico`, `actividades`, `horas_trabajo`, `trabajos_adicionales`, `nota_correccion`, tiempos para KPI) y `suborden_repuesto` (`suborden_id`, `numero_parte`, `cantidad`, `descripcion`; o FK a `inventario.articulo` cuando exista).
- `registro_mantenimiento` (historial: `unidad_id`, `clase`, `tipo_servicio` (A/B de Flota) si aplica, `fecha`, `horometro`/`km` (también quedan como lectura en Flota), `responsable` FK, `ejecutado_por`, `proveedor` (FK al catálogo de Flota), `observaciones`, `orden_id`, `archivo_id` del checklist de fábrica).
- Secuenciales: use el motor de `comercial` como **ejemplo** pero **no lo importe** (otro contenedor): el código de la orden/sub-orden/reporte sale de un contador propio con bloqueo de fila (tabla `contador` o `secuencia` del módulo).

## 5. Eventos

**Consume:** `operaciones.pumping.reporte_unidad_llegada` y `operaciones.fcr.reporte_unidad_llegada` (contrato 4.2); `flota.inspeccion_vehiculo.*` si una "No cumple" debe generar reporte.
**Publica:** `mantenimiento.orden.creada|cerrada`, `mantenimiento.suborden.asignada|cerrada|derivada_a_pumping` (con `unidadId`, `ticketId` si aplica, `asignados` para avisar al operador de mantenimiento y al supervisor de Pumping), `mantenimiento.unidad.retornada_a_operacion`.

## 6. API y permisos

`/api/operaciones/mantenimiento/{reportes,ordenes,subordenes,historial,kpis}` y, para el ticket de Pumping, `GET /api/operaciones/mantenimiento/unidades/:unidadId/subordenes` (alimenta la tarjeta "Mantenimientos"). Permisos nuevos en el bloque `mantenimiento` de `permissions.ts` (ver, clasificar, asignar, ejecutar, revisar cierre, derivar, registrar preventivo, ver KPI). Roles: `jefe_mantenimiento` (clasifica, asigna, revisa), `operador_mantenimiento` (ejecuta), `supervisor_pumping` (revisa las Operativas), lectura para el resto con acceso al ticket.

## 7. Pantallas

Las de `features/maintenance` (reportes, órdenes, ejecución, revisión, derivación, retorno, preventivo, KPI, mis tareas) más la **tarjeta "Mantenimientos"** dentro del ticket de Pumping (componente nuevo; coordine con la sesión de Pumping, que la ubica en la columna lateral). Hojas imprimibles: informe de mantenimiento (DYN-MNT-RE-008) y órdenes General y Operativa.

## 8. Tramos

1. **M1 — Diseño y reportes recibidos + clasificación** (con el contrato 4.2 acordado con Pumping).
2. **M2 — Órdenes y sub-órdenes** con su máquina de estados (estado en tablas de catálogo/transiciones, como `pumping.paso`/`transicion`, no en `if` sueltos).
3. **M3 — Historial y preventivos** (usa el servicio de Flota para actualizar lecturas).
4. **M4 — Tarjeta en el ticket, avisos, KPI y hojas imprimibles.**

## 9. Pruebas

Integración: clasificar con motivo, orden aceptada cuando todas las sub-órdenes se cierran o derivan, corrección solicitada, derivación a Pumping, preventivo que actualiza la lectura de la unidad (a través de Flota), consumidor del evento de llegada idempotente, KPI.

## 10. Consultas para Dynadrill (`documentacion/mantenimiento/CONSULTAS-PARA-DYNADRILL.md`, sección `## Mantenimiento`)

- Fórmulas exactas de los KPI de MAN-MASTER-001 y de la disponibilidad.
- ¿El checklist de fábrica del preventivo es obligatorio? ¿Quién lo carga?
- ¿Los repuestos deben salir de Inventario (salida real) o siguen siendo texto con número de parte?

## 11. Puntos de choque

Mismos que Flota. **No** toque `libs/operaciones/flota` ni `libs/operaciones/pumping`; pida lo que necesite en el registro.

## 12. Preguntas abiertas entre módulos

_(escriba aquí lo que necesite de Flota o de Pumping)_
