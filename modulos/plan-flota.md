# Plan: Flota

**Schema:** `flota` · **Contenedor:** operaciones (3103) · **Librería:** `libs/operaciones/flota` (`@dyn/flota`) · **Prefijo HTTP:** `/api/operaciones/flota`
**Estado:** por construir · **Ola:** 1 (es prerrequisito de Mantenimiento, Pumping y FCR)
**Lea antes:** `00-CONTEXTO-COMPARTIDO.md`, `01-REGLAS-DE-COORDINACION.md`, `02-CONTRATOS-ENTRE-MODULOS.md`, `03-DECISIONES-PENDIENTES.md` (D2, D13) y `04-REVISION-CONTRA-DEMO-MAIN.md` (hallazgos 2 y 3). **Revisado contra el `main` de la demo (08/10/2026).**

## 1. Objetivo

Ser el dueño de **las unidades de Dynadrill, sus lecturas, los conductores y sus permisos, la inspección de vehículos y el gerenciamiento de viaje**. El schema `flota` está definido como "Unidades, conductores, inspecciones vehiculares y Gerenciamiento de Viaje". En la demo todo esto vive mezclado dentro del dominio `maintenance`; aquí se separa de Mantenimiento.

## 2. Qué hay en la demo (léalo, es de solo lectura)

| Parte | Dónde |
|---|---|
| Backend `unidades`, `conductores-permisos`, `vehicle-inspections`, `gerenciamiento-viaje` | `dynadrill-backend/libs/domains/maintenance/src/{unidades,conductores-permisos,vehicle-inspections,gerenciamiento-viaje}` (≈ 370 líneas; casi todo se guarda en `payload` JSON) |
| Modelos del frontend (la fuente real de los campos) | `dynadrill-frontend-platform/src/app/features/maintenance/models/{unidad,vehicle-inspection}.model.ts` y `features/conductor/models/gerenciamiento-viaje.model.ts` |
| Pantallas | `features/maintenance/` (unidades, diálogo de inspección de vehículos), `features/conductor/` (portal del Conductor, ≈ 870 líneas) |
| Formatos | `documentacion/mantenimiento/DYN-SGI-RE-068 Inspeccion de vehiculos V091.xlsx`; `Plan Mantenimiento Dynadrill 2026.docx`; el formato DYN-SGI-RE-049 (gerenciamiento de viaje) está dentro del frontend |
| Spec relacionada | `dynadrill-frontend-platform/specs/pumping-mantenimiento-fuera-de-flujo/SPEC.md` |

Reglas de negocio que ya se vieron en la demo:

- **Tipos de unidad** (Plan de Mantenimiento 2026, MAN-002): **Servicio** (se controla por horas de operación, horómetro), **Auxiliar** (por tiempo: cada 6 meses) y **Transporte** (por kilometraje: cada 5.000 km). Subclasificación de peso de Transporte: **Pesado** (camiones, cabezales) y **Liviano** (camionetas).
- **Servicios preventivos de las unidades de Servicio**: Tipo A cada 250 h (tolerancia 30 h) y Tipo B cada 2.000 h (tolerancia 50 h; el B incluye al A y reinicia su contador).
- Una unidad puede tener **proveedor externo** de mantenimiento y **datos patrimoniales** (placa, marca, modelo, activo fijo) que edita Inventario/Patrimonio sin tocar las lecturas.
- **Inspección de vehículos (DYN-SGI-RE-068)**: se hace antes de salir **por cada unidad de tipo Transporte asignada** (sin unidades de Transporte no bloquea) y **solo cuenta la del ticket**; la hace el Operador (condición para salir del traslado de salida) y la **aprueba el Supervisor al revisar la salida** (condición para pasar a la ejecución); si un ítem queda "No cumple" se ofrece generar un Reporte de Unidad (lo recibe Mantenimiento); la Nota 1 prohíbe usar el vehículo si el cinturón de seguridad no cumple; alimenta el kilometraje de la unidad. Trae 24 ítems del vehículo y 6 del equipo (C / NC / NA), documentos del vehículo (matrícula, póliza), documentos del conductor (6) y firmas.
- **Conductores y permisos**: seis documentos con vigencia (licencia, manejo defensivo, examen médico, examen psicosensométrico, documentos de clientes, vacunas); si alguno no está vigente, la inspección **no se puede guardar**; hay alerta de próximo vencimiento.
- **Gerenciamiento de viaje (DYN-SGI-RE-049)**: lo solicita el **Conductor** desde su portal (uno de **salida** y otro de **retorno** por ticket: tiene `tipo` y `ticketId`). Cuestionario de 12 preguntas con puntaje → nivel de riesgo **BAJO / MEDIO / ALTO**; **siempre queda pendiente**: BAJO lo autoriza el Supervisor (de Pumping); **MEDIO y ALTO el Jefe de Base o el Gerente HSE** (el Supervisor solo gestiona los BAJO); respuestas "999" significan "no conduce / deténgase". **Es una condición del ticket**: el de salida aprobado para salir de la revisión de reportes de salida y el de retorno aprobado para salir del control de retorno (requisitos `gerenciamiento_viaje_*_aprobado` de Pumping, que Flota cumple con eventos). El Conductor necesita una **lectura mínima del ticket** (código, origen, destino, línea, supervisor asignado) para autocompletar su solicitud (permiso `pumpingContextoConductor`).

## 3. Qué hacen los otros módulos (para que no se pisen)

- **Mantenimiento** (otra sesión) consume `flota.unidad` y escribe lecturas y preventivos **a través de un servicio exportado por Flota**; nunca escribe las tablas de Flota.
- **Pumping** (esta sesión) hoy asigna `catalogos.vehiculo`; migrará a `flota.unidad` (D2). Espera de Flota los eventos `flota.inspeccion_vehiculo.*` (contrato 3 y 4.7).
- **QHSE** no es dueño de nada de Flota; el gerenciamiento de viaje lo puede autorizar el Gerente HSE (permiso).
- **Inventario** no duplica la unidad: lee `flota.unidad` para los datos patrimoniales (hoy la demo los trata como un solo registro).

## 4. Modelo de datos propuesto (sin JSON, con FK y enums)

Enums: `tipo_unidad` (servicio, auxiliar, transporte), `categoria_peso` (pesado, liviano), `tipo_servicio_preventivo` (a, b), `resultado_checklist` (cumple, no_cumple, no_aplica), `nivel_riesgo_viaje` (bajo, medio, alto), `tipo_gerenciamiento` (salida, retorno), `estado_gerenciamiento` (pendiente, aprobado, rechazado).

Tablas (ids UUIDv7; auditoría con FK a `identidad.usuario`):

- `unidad` (`codigo` único, `nombre`, `tipo`, `categoria_peso` solo Transporte, `vehiculo_id` opcional FK a `catalogos.vehiculo` (D2), `proveedor_mantenimiento` como FK a un catálogo `proveedor_mantenimiento` o a `catalogos.transportista`, `activa`).
- `unidad_lectura` (histórico de horómetro y kilometraje: `unidad_id`, `tipo` (horometro/odometro), `valor`, `leida_at`, `fuente` enum (inspeccion, reporte_unidad, mantenimiento, manual), `fuente_id`). La lectura vigente es la última; **no** se guarda como columna editable.
- `servicio_preventivo` (catálogo: `tipo`, `intervalo_horas`, `tolerancia_horas`) y `unidad_preventivo` (`unidad_id`, `tipo`, `horas_al_hacerlo`, `hecho_at`).
- `conductor` (FK a `identidad.usuario`: el conductor **es** una cuenta con rol `conductor`), `tipo_permiso_conductor` (catálogo: licencia, manejo defensivo, ...) y `conductor_permiso` (`conductor_id`, `tipo_id`, `vigente_hasta`, `archivo_id` FK a `archivos.archivo`).
- `inspeccion_vehiculo` (`unidad_id`, `ticket_id` uuid **con FK a `pumping.ticket`** (mismo contenedor, D1) o nulo si se hace fuera de un ticket, `fecha`, `punto_partida`, `destino`, `km_inicial`, `km_final`, `proximo_mantenimiento`, `inspeccionado_por` (FK usuario), `conductor_id`, documentos del conductor verificados, `observaciones`, `aprobada_por` y `aprobada_at` (FK), `reporte_unidad_id` si generó uno).
  - Catálogo `item_inspeccion_vehiculo` (sección vehículo/equipo, orden, etiqueta; los 24 + 6 ítems) y `inspeccion_vehiculo_resultado` (`inspeccion_id`, `item_id`, `resultado`).
  - Documentos del vehículo (matrícula, póliza): columnas de fecha de vigencia en `inspeccion_vehiculo` o tabla propia, si se quiere historial.
- `gerenciamiento_viaje` (`codigo`, `tipo`, `solicitante_id` FK usuario, `conductor_id`, `unidad_id`, `ticket_id` opcional, `ruta`..., `puntaje_total`, `nivel_riesgo`, `estado`, `autorizado_por`/`autorizado_at`), catálogo `pregunta_riesgo_viaje` y `opcion_pregunta_riesgo` (etiqueta, valor; el 999 se modela como columna `impide_conducir` booleana) y `gerenciamiento_viaje_respuesta` (`gerenciamiento_id`, `opcion_id`).
  - El **nivel de riesgo** y quién autoriza son una regla del servidor (tabla de umbrales en catálogo `umbral_riesgo_viaje`), no del frontend.

## 5. Eventos

**Publica** (contratos 3): `flota.inspeccion_vehiculo.realizada|anulada|aprobada|rechazada` y **`flota.gerenciamiento_viaje.aprobado|rechazado`** (`ticketId` y `tipo`: `salida`/`retorno`), ya con consumidor en Pumping. En las de inspección (`ticketId`, `vehiculoId`... ojo: en Flota el id de la unidad es `unidadId`; el contrato con Pumping usa `vehiculoId` del **catálogo**. Mientras dure D2 publique **ambos**: `vehiculoId` (del catálogo, que es lo que Pumping guarda) y `unidadId`). También `flota.gerenciamiento_viaje.solicitado|autorizado|rechazado` y `flota.unidad.lectura_registrada`.
**Consume:** `operaciones.pumping.asignacion_realizada` (deja el caso de inspección por cada `{ usuarioId, vehiculoId }`); más adelante el equivalente de FCR.

## 6. API y permisos

- Prefijo `/api/operaciones/flota`: `unidades`, `unidades/:id/lecturas`, `conductores`, `conductores/:id/permisos`, `inspecciones-vehiculo`, `gerenciamientos-viaje`. Para el ticket: `GET /api/operaciones/flota/inspecciones-vehiculo?ticketId=` con el estado por unidad (`pendiente`, `por_aprobar`, `aprobada`).
- Permisos nuevos en `permissions.ts` bajo un bloque `flota`: ya existe `flota.inspecciones.aprobar`. Agregue los de unidades (ver/crear/editar), conductores, inspecciones (ver/crear), gerenciamiento (solicitar/autorizar) y la **lectura mínima del ticket para el Conductor** (`pumpingContextoConductor` en la demo). Matrices de la demo `main`: `gerenciamientoViajeApprove` = Supervisor, Supervisor Pumping, **Gerente HSE**, Superadmin y Jefe de Base (la plataforma hoy no incluye al Gerente HSE: agréguelo); `vehicleInspectionApprove` = Supervisor, Supervisor Pumping y Jefe de Mantenimiento. Roles: `jefe_mantenimiento`, `operador_mantenimiento`, `conductor`, `operador`, `supervisor`, `supervisor_pumping`, `jefe_base`, `gerente_hse`, `tecnico_hse` (no existen `coordinador_hse` ni `ingenieria_ventas_fcr`: D4).
- Contenedor operaciones: agregue su módulo a `apps/operaciones/src/app/app.module.ts`. Gateway: `/api/operaciones` ya va a operaciones; los prefijos viejos de la demo (`/api/unidades`, `/api/vehicle-inspections`, `/api/gerenciamientos-viaje`, `/api/conductores-permisos`) se cortan en el **Corte** (ver su plan).

## 7. Pantallas (frontend)

- Unidades (lista, ficha, lecturas, preventivos), conductores y permisos con alerta de vencimiento, inspección de vehículos (diálogo del formato 068, con la Nota 1), gerenciamiento de viaje y **portal del Conductor** (`features/conductor`).
- Hojas imprimibles con `window.print()` (DYN-SGI-RE-068 y DYN-SGI-RE-049) en `shared/documentos/formatos`.
- Inspección dentro del ticket de Pumping: el panel de requisitos ya muestra "Inspección de vehículos realizada/aprobada" por unidad; cuando Flota exista se reemplaza el "Confirmar a mano" por el enlace al diálogo.

## 8. Tramos

1. **F1 — Unidades y lecturas**: catálogos, `unidad`, lecturas, preventivos, migración de las unidades desde la demo (`prisma/seed` con los códigos reales: PUM-07, PUM-15, 4-CTV-03, CAM-04, CAM-08, GEN-01, GEN-02...), API y pantalla.
2. **F2 — Conductores y permisos** con vigencias y alertas.
3. **F3 — Inspección de vehículos** con su caso por ticket, aprobación del Supervisor y los eventos del contrato 3 (retira el puente temporal en Pumping).
4. **F4 — Gerenciamiento de viaje** y portal del Conductor.
5. **F5 — Migración de Pumping/FCR de `catalogos.vehiculo` a `flota.unidad`** (D2), coordinada con la sesión de Pumping.

## 9. Pruebas

Integración con base real: lecturas (la vigente es la última), preventivos A/B (el B reinicia el A), vigencia de permisos que bloquea guardar la inspección, Nota 1 del cinturón, aprobación por permiso, eventos del contrato (consumidor de Pumping simulado), reglas de riesgo (puntajes, 999, quién autoriza).

## 10. Consultas para Dynadrill (anótelas en `documentacion/mantenimiento/CONSULTAS-PARA-DYNADRILL.md`, sección `## Flota`)

- (Resuelta, D8) La inspección de vehículos aplica solo a unidades de Transporte.
- ¿Los umbrales del gerenciamiento de viaje (BAJO/MEDIO/ALTO) están fijos por el formato o los define el negocio?
- ¿Quién mantiene el catálogo de proveedores de mantenimiento?

## 11. Puntos de choque

`permissions.ts` (su bloque `flota`), `apps/operaciones/src/app/app.module.ts`, `package.json` (scripts), `tsconfig.base.json`, plantillas de avisos (`plantillas/flota.ts`). **No** toque `libs/operaciones/pumping` ni `libs/operaciones/mantenimiento`.

## 12. Preguntas abiertas entre módulos

_(escriba aquí lo que necesite de otra sesión, con su nombre; quien lo reciba lo contesta debajo)_
