# Plan: Flota

**Schema:** `flota` · **Contenedor:** operaciones (3103) · **Librería:** `libs/operaciones/flota` (`@dyn/flota`) · **Prefijo HTTP:** `/api/operaciones/flota`
**Estado:** F1 en curso (backend terminado y verificado; frontend a medias) · **Ola:** 1 (es prerrequisito de Mantenimiento, Pumping y FCR)
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


## 13. Estado de avance (actualizado 16/10/2026, sesión Flota)

### Objetivo de la sesión
Construir el módulo Flota por tramos (F1 a F5). Hoy solo se trabajó el **tramo F1 (unidades y lecturas)**.

### Hecho en F1 (backend, verificado)
- **Librería** `libs/operaciones/flota` (`@dyn/flota`, alias en `tsconfig.base.json`, scripts `db:migrate:flota` y `db:seed:flota` en `package.json`, `FlotaModule` importado en `apps/operaciones/src/app/app.module.ts`).
- **Migraciones aplicadas** (schema `flota`): `20261016170000_unidades_y_lecturas` y `20261016173000_preventivo_responsable_opcional`. Tablas: `proveedor_mantenimiento`, `regla_preventiva` (reglas MAN-002 como datos), `unidad`, `unidad_lectura`, `unidad_preventivo`; 7 enums; FK reales a `catalogos.vehiculo`, `identidad.usuario` y `archivos.archivo`; sin JSON ni copias de nombre. Nota operativa: Prisma no inicializó `flota._prisma_migrations`; se creó a mano (como `postgres`, dueño `dyn_migrator`).
- **Semilla** aplicada: 5 reglas, 1 proveedor y las 10 unidades de la demo (PUM-07, PUM-15, 4-CTV-03, PMP-14, PUM-03, CIS-02, GEN-01, GEN-02, CAM-04, CAM-08) con lecturas y últimos preventivos.
- **API** `/api/operaciones/flota`: `unidades` (listar, ficha, crear, editar, baja/reactivación), `unidades/alertas`, `unidades/:id/lecturas` (GET/POST), `unidades/:id/preventivos` (GET/POST), `proveedores-mantenimiento`. Servicios exportados para Mantenimiento: `UnidadesService`, `LecturasService.registrar(...)`, `PreventivosService.registrar(...)` y `calcularAlertas`.
- **Reglas**: la lectura nunca baja respecto de la línea de tiempo; el preventivo B reinicia también el A; transporte cada 5.000 km (tolerancia 500); auxiliares y cisternas por tiempo (6 meses); un transporte sin preventivo previo no genera alerta (decisión conservadora).
- **Eventos** (con `source: 'flota'`, vía `createEvent`; `bus.create` no sirve porque fija el contenedor `operaciones`): `flota.unidad.creada`, `flota.unidad.lectura_registrada`, `flota.unidad.preventivo_registrado`.
- **Permisos** nuevos (7): `flota.unidades.ver|crear|editar|inactivar`, `flota.lecturas.registrar`, `flota.preventivos.registrar`, `flota.proveedores.gestionar`. Semilla de identidad corrida.
- **Pruebas**: 9 unitarias (alertas) y 16 de integración con base real, todas verdes. `nx lint test build` de flota, authz y operaciones en verde. Contenedor operaciones reiniciado (3103) y respondiendo.

### Hecho en F1 (frontend, parcial; NO verificado, sin `ng build` ni `ng test`)
En `dynadrill-frontend-platform/src/app/features/flota/`: modelo, servicio `FlotaUnidadesService`, utilidades, diálogos (`unidad-form-dialog`, `lectura-dialog`, `preventivo-dialog`), página de listado (ts, html, scss) y el `.ts` de la ficha de la unidad.

### Falta de F1
1. Ficha: crear `unidad-detail-page.html` y `.scss` (datos, alertas con `dynadrill-progress` y `statusOverride`, tablas de lecturas y preventivos, botones editar, lectura, preventivo y baja). Corregir en el `.ts`: usar `ActivatedRoute` (no está habilitado `withComponentInputBinding`, así que `input()` de `:id` no funciona) y quitar el alias `DynadrillTagColumns`.
2. `flota.routes.ts` (`unidades` y `unidades/:id`, con `roleGuard`), entrada `dashboard/flota` en `app.routes.ts` y entrada de menú en `navigation.service.ts` (Jefe de Mantenimiento, Bodeguero, Jefe de Base, Superadmin); ajustar `navigation.service.spec.ts` si falla.
3. `ng build` y `ng test` (con el bloqueo `.bloqueos/nx.lock`), prueba manual de la pantalla.
4. Consultas a Dynadrill (sección `## Flota` en `documentacion/mantenimiento/CONSULTAS-PARA-DYNADRILL.md`): umbrales del viaje, quién mantiene proveedores, datos de matrícula de CAM-04/CAM-08 (no existen en `catalogos.vehiculo`, quedaron sin vínculo), responsable patrimonial de la carga inicial, transporte sin preventivo previo.
5. **Commits locales**: ninguno hecho todavía. Como el árbol de trabajo es compartido, no se hizo `checkout`; propuesta: commit en `modulo/flota` solo con las rutas de Flota (índice temporal), en backend y frontend.

### Tramos pendientes (no iniciados)
- **F2** conductores y permisos con vigencias y alertas.
- **F3** inspección de vehículos (caso por ticket desde `asignacion_realizada`, aprobación, eventos `flota.inspeccion_vehiculo.*` con `vehiculoId` y `unidadId`; retira el puente temporal de Pumping).
- **F4** gerenciamiento de viaje y portal del Conductor (agregar al Gerente HSE a `gerenciamientoViajeApprove`; permiso `pumpingContextoConductor`).
- **F5** migración de Pumping/FCR de `catalogos.vehiculo` a `flota.unidad` (D2), coordinada con la sesión de Pumping.

### Decisiones que necesita del usuario
- Confirmar el manejo de git (rama `modulo/flota` sin `checkout` en el árbol compartido).
- Las consultas del punto 4 de arriba.

## Hallazgos de la revisión de base de datos (17/10/2026): pulir antes de seguir

Revisado sobre las migraciones `20261016170000_unidades_y_lecturas` y `20261016173000_preventivo_responsable_opcional`.

1. **`unidad_lectura.fuente_id` es un id polimórfico sin FK** (apunta según `fuente` a una inspección, un reporte o un mantenimiento). Reemplácelo por columnas con FK por cada origen (`inspeccion_id`, `reporte_unidad_id`, `preventivo_id`...) y un CHECK de que, según `fuente`, solo la que corresponde esté llena; o una tabla puente por origen. Hasta que existan las tablas de inspecciones, deje la columna sin usar y documentado.
2. **Las lecturas no son inmutables.** `unidad_lectura` es historia: REVOKE UPDATE, DELETE al rol de la aplicación; una lectura mal tomada se corrige con una lectura nueva y una marca de anulación, no editándola.
3. **`unidad_preventivo`:** hoy es editable y sin `updated_*`. Decida si es historia (inmutable, igual que las lecturas) o editable (entonces agregue auditoría completa). Los preventivos de la carga inicial sin responsable están bien, pero la carga debe quedar marcada para distinguirlos de los registrados por la aplicación.
4. **`unidad.tipo` y `categoria_peso` son enums:** confirme con el negocio que no se ampliarán; si Flota debe poder agregar tipos, conviértalos en catálogo.
5. **Datos de la demo:** confirme que `unidad.codigo` y `unidad.nombre` no repiten lo que ya trae `catalogos.vehiculo` cuando hay `vehiculo_id`; la unidad aporta lo operativo, la matrícula sale del JOIN.
6. **Permisos de lectura amplios:** `GRANT SELECT` de toda `catalogos.vehiculo` y `tipo_vehiculo`; reduzca a las columnas que usa.
7. **Falta construir** (con el mismo estándar): F2 inspecciones de vehículos (con sus ítems en tablas, no JSON) y F3 gerenciamiento de viaje; publique `flota.inspeccion_vehiculo.*` y `flota.gerenciamiento_viaje.*` con `source: flota` y pruebe que el consumidor de Pumping los recibe.
8. **Pruebas:** agregue pruebas que intenten violar el CHECK de `categoria_peso`, el de `ejecutado_por = tercero` sin proveedor y el REVOKE de lecturas.

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

## 14. Cumplimiento de la revisión de base de datos (17/10/2026)

Corregido con la migración nueva `20261017100000_pulir_f1_integridad` (las anteriores no se editaron), más cambios de servicio y pruebas. Pruebas: 9 unitarias y 22 de integración, todas verdes; `eslint` sin errores.

| # | Hallazgo | Resultado |
|---|---|---|
| 1 | `fuente_id` polimórfico sin FK | **Corregido**: columna eliminada. El origen de una lectura de mantenimiento ya está en `unidad_preventivo.lectura_id` (FK). Las columnas con FK para inspección (F2) y reporte de unidad se agregan cuando existan esas tablas, con CHECK de «una sola llena». |
| 2 | Lecturas editables | **Corregido**: `REVOKE UPDATE, DELETE` a `app_operaciones`; tabla `unidad_lectura_anulacion` (solo INSERT, motivo obligatorio ≥ 5 letras, quién y cuándo). La vigente, la historia vigente y la línea de tiempo ignoran las anuladas. No se anula una lectura que respalda un preventivo vigente (409). Endpoint `POST /lecturas/:id/anular`, permiso `flota.lecturas.anular`, evento `flota.unidad.lectura_anulada`. |
| 3 | `unidad_preventivo` editable | **Decidido: es historia inmutable** (igual que las lecturas): REVOKE, tabla `unidad_preventivo_anulacion`, `POST /preventivos/:id/anular`, permiso `flota.preventivos.anular`, evento `flota.unidad.preventivo_anulado`. Columna `origen` (`carga_inicial` / `aplicacion`) con CHECK: lo registrado por la aplicación siempre lleva responsable. La semilla marca su carga como `carga_inicial`. |
| 4 | Enums `tipo` y `categoria_peso` | **Se mantienen como enum**: el tipo decide la regla preventiva y la lectura (MAN-002) y la categoría solo existe para los indicadores de Pesado/Liviano; ninguno lo amplía el negocio. Anotado en un COMMENT. **Confirmar con Dynadrill.** |
| 5 | Duplicados con `catalogos.vehiculo` | **No aplica**: `unidad` no guarda placa, marca, modelo ni año (salen del JOIN por `vehiculo_id`); `codigo` y `nombre` son el código y nombre operativos (PUM-07), que el catálogo no tiene. COMMENT en `nombre`. |
| 6 | GRANT amplio | **Corregido**: `SELECT` solo de `(id, placa, marca, modelo, anio, tipo_vehiculo_id, habilitado)` en `catalogos.vehiculo` y `(id, nombre)` en `tipo_vehiculo`. Afecta también a Pumping, que usa el mismo usuario (sus columnas están incluidas); registrado. |
| 8 | Pruebas de reglas de la base | **Hecho**: CHECK de `categoria_peso`, CHECK de tercero sin proveedor y de responsable, FK compuesta de tipo de lectura, REVOKE de UPDATE/DELETE y de la columna `transportista_id`, anulaciones. |
| extra | Integridad en la base | Nueva columna generada `unidad.tipo_lectura` y FK compuesta `(unidad_id, tipo)` en `unidad_lectura`: el tipo de lectura (horómetro/odómetro) lo garantiza la base, y las auxiliares no admiten lecturas. Lo que sigue validando solo el servicio: que una lectura no baje respecto de la línea de tiempo y que `tipo_servicio` A/B solo exista en unidades de servicio. |

Estándar de calidad, puntos revisados sobre F1: 1 sin duplicados ✔, 2 sin ids sin FK ✔ (tras el punto 1), 3 catálogos ✔ (proveedores y reglas son tablas), 4 integridad en la base ✔, 5 historia inmutable ✔, 6 auditoría ✔ (`created_*` y `updated_*` en `unidad` y `proveedor_mantenimiento`; la historia solo `created_*`), 7 permisos mínimos ✔, 8 migraciones sin editar ✔, 9 backend ✔, 10 pruebas de reglas ✔.

### Pendiente (no iniciado en esta pasada)
- **Hallazgo 7**: F2 inspecciones de vehículos (ítems en tablas) y F3 gerenciamiento de viaje, con los eventos `flota.inspeccion_vehiculo.*` y `flota.gerenciamiento_viaje.*` y la prueba de que el consumidor de Pumping los recibe. La numeración de tramos del plan cambia: conductores y permisos pasan a F2/F3 según se reordene; sigue pendiente decidirlo.
- Terminar el frontend de F1 (ficha, rutas, menú, `ng build`/`ng test`) y agregar la anulación de lecturas y mantenimientos en la ficha.
- `build` del contenedor operaciones y reinicio: lo estaba haciendo la sesión principal (bloqueo `nx.lock`); el código de Flota ya está en el árbol, así que su build lo incluye. Falta verificar a mano `/api/operaciones/flota/unidades` tras ese reinicio.
- Commits locales en `modulo/flota` (sin hacer; ver sección 13).

## 15. Encargo de la sesión (18/10/2026)

**Estado:** F1 (unidades, lecturas, preventivos, proveedores) construido en backend (5 servicios, 3 migraciones); su frontend (`features/flota`) quedó sin verificar. **Mantenimiento y Pumping ya dependen de Flota**, así que es una de las piezas que más destraba.

**Orden de trabajo**
1. **Verifique y cierre F1:** `ng build`, `ng test`, probar en pantalla unidades, lecturas, preventivos y proveedores. Exporte en `index.ts` los servicios que Mantenimiento necesita para M3 (registrar una lectura de horómetro o kilometraje y leer el preventivo) y avise en el registro.
2. **Inspección de vehículos (DYN-SGI-RE-068):** ítems en tablas (no JSON), aprobación por permiso, y los eventos que **Pumping ya consume** (no cambie sus nombres): `flota.inspeccion_vehiculo.realizada|anulada|aprobada|rechazada` con `ticketId` y `vehiculoId` (el del **catálogo**, D2) más `unidadId`. Hoy el Supervisor del ticket aprueba la inspección con el puente temporal de Pumping (origen `manual_temporal`); su evento no choca con eso. Pregunte a Dynadrill si la **inspección de llegada** es la misma inspección o una nueva (consulta).
3. **Gerenciamiento de viaje (DYN-SGI-RE-049)** y **portal del Conductor:** eventos `flota.gerenciamiento_viaje.aprobado|rechazado` con `ticketId` y `tipo` (`salida`/`retorno`), que Pumping ya consume. El Conductor necesita una lectura mínima del ticket (código, origen, destino, supervisor): **pídasela a la sesión principal** con una pregunta abierta en `plan-pumping-restante.md` (endpoint de Pumping con permiso propio); no lea el schema de Pumping por su cuenta salvo lo que ya está mirrored.
4. **Frontend de Mantenimiento que le toca:** las pestañas Preventivo, Inspecciones e Historial de `features/maintenance` y el servicio de unidades siguen contra la demo (`UnidadesService`, `VehicleInspectionsService`, `HistorialMantenimientoService`). Migrelas a Flota con el patrón adaptador. **Excepción a la regla de dueños:** puede editar `unidades.service.ts`, `vehicle-inspections.service.ts`, `historial-mantenimiento.service.ts`, `vehicle-inspections-table`, `vehicle-inspection-dialog`, `register-pm-dialog`, `historial-dialog` y lo que de `maintenance-list-page` use esos servicios; el resto de `features/maintenance` es de la sesión principal.
5. **D2:** el enlace `flota.unidad.vehiculo_id` ya lo usan Mantenimiento y Pumping; no lo cambie. La migración de Pumping de `catalogos.vehiculo` a `flota.unidad` (F5) la coordina la sesión principal.

**Entregables por tramo:** migración, semilla, pruebas de integración (incluidas las reglas de la base), pantalla verificada, plan actualizado, registro, commit con `scripts/commit-modulo.ps1 -Modulo flota`. Regla nueva: sección 9 de `01-REGLAS-DE-COORDINACION.md`.

## 16. Avance del 18/10/2026 (sesión Flota): F1 cerrado, F2 y F3 construidos

### F1 (unidades, lecturas, preventivos, proveedores)
- Backend verificado: 31 pruebas verdes al empezar la sesión. Frontend cerrado: ficha de la unidad (lee `:id` con `ActivatedRoute`), `flota.routes.ts`, ruta `dashboard/flota` en `app.routes.ts` y menú **por permiso** (`NavEntry.permission`: cada destino de Flota sale con su propio permiso). `ng test` 402/402.
- Exportado para Mantenimiento (M3): `UnidadesService`, `LecturasService.registrar(unidadId, entrada, actor, tx?)`, `PreventivosService.registrar(...)`, `ConductoresService` y `calcularAlertas`.

### F2 — Documentos de los conductores (migración `20261018150000_conductores_y_permisos`)
- El conductor **es una cuenta de `identidad.usuario`**; no hay tabla de conductores (repetiría la cuenta). Catálogo `tipo_permiso_conductor` (licencia, manejo defensivo, examen médico, psicosensométrico, documentos de clientes, vacunas) con `con_vigencia`; `conductor_permiso` es **historia inmutable** (REVOKE UPDATE/DELETE) con `conductor_permiso_anulacion` (motivo ≥ 5 letras). El vigente de cada tipo es el último no anulado. La base exige la fecha solo cuando el documento vence (FK compuesta `(tipo_id, con_vigencia)` + CHECK).
- API: `GET conductores`, `GET conductores/:usuarioId`, `GET|POST conductores/:usuarioId/permisos`, `POST conductores/permisos/:id/anular`, `GET conductores/tipos-permiso`. Permisos nuevos `flota.conductores.ver|gestionar`. Eventos `flota.conductor.permiso_registrado|anulado`. «Por vencer» = 30 días.
- La vigencia se cuenta por días calendario de Ecuador (`America/Guayaquil`).

### F3 — Inspección de vehículos DYN-SGI-RE-068 (migraciones `20261018160000_inspeccion_vehiculo`, `…170000_caso_inspeccion_borrable`, `…180000_trigger_revision_con_esquema`)
- **Modelo:** `item_inspeccion_vehiculo` (24 + 6 ítems en tabla; la Nota 1 es la columna `bloquea_si_no_cumple`, no se compara el texto), `inspeccion_caso` (una unidad de transporte asignada a un ticket, FK a `pumping.ticket`; lo abre el consumidor de `asignacion_realizada`), `inspeccion_vehiculo` (documento firmado), `inspeccion_vehiculo_resultado`, `inspeccion_vehiculo_revision` (aprueba/rechaza el Supervisor; vale la última). El **estado del caso se calcula** (pendiente → por aprobar → aprobada), no se guarda.
- **Sin copias:** marca, modelo, placa, documentos del vehículo salen de `unidad`/`catalogos.vehiculo`; el **kilometraje es una lectura de odómetro** (`unidad_lectura.inspeccion_id`, FK + CHECK `(fuente = 'inspeccion') = (inspeccion_id is not null)`); los documentos del conductor se comprueban en vivo contra `conductor_permiso` (no se copian).
- **Reglas en la base:** inspección inmutable (solo se puede marcar la anulación, una vez; trigger); una sola vigente por caso y momento (índice único parcial); caso e inspección de la misma unidad (FK compuesta); no se revisa una anulada; **Nota 1: el trigger impide aprobar** con un ítem bloqueante en «No cumple».
- **Reglas del servicio:** solo unidades de transporte (D8), formato completo, conductor con los 6 documentos vigentes (422 `conductor_sin_condiciones`), odómetro no menor que la lectura anterior.
- **Aprobar / rechazar / anular:** aprobar = permiso `flota.inspecciones.aprobar`; **rechazar** deja la revisión y anula la inspección (se repite) y publica `rechazada` + `anulada`; **anular** una aprobada no se permite (primero se rechaza).
- **Eventos** (`source: 'flota'`): `flota.inspeccion_vehiculo.realizada|anulada|aprobada|rechazada` con `ticketId`, `vehiculoId` (catálogo, D2), `unidadId`, `inspeccionId`, `casoId`; más `flota.inspeccion_vehiculo.registrada` (siempre; con `momento`, `hayNovedades`, `bloqueaUso`) para Mantenimiento. La inspección de **llegada** es un registro aparte (`momento = llegada`) y **no** publica `realizada` (reabriría o cumpliría por error la condición de salida).
- **Consumidor** `AsignacionPumpingConsumer` (grupo `flota`, para no repartirse la cola con Mantenimiento): abre un caso por cada `{usuarioId, vehiculoId}` cuyo vehículo sea una unidad de transporte activa; reasignar actualiza el operador y retira los casos sin inspecciones.
- **API:** `inspecciones-vehiculo` (`items`, `casos?ticketId=`, `mis-casos`, listar, `:id`, crear, `:id/aprobar|rechazar|anular`). Permisos nuevos `flota.inspecciones.ver|crear|anular`.
- **Pruebas:** 55 en total (9+ unitarias y de integración con base real). Incluyen intentos de violar la base: CHECK de vigencia, FK compuestas, REVOKE de UPDATE/DELETE, anulación definitiva, único parcial, CHECK de origen de la lectura, trigger de la Nota 1. Una prueba encontró que `DELETE` no estaba concedido sobre `inspeccion_caso` y que el trigger usaba nombres sin esquema (migraciones `170000` y `180000`).

### Frontend (patrón adaptador, sin tocar lo viejo)
- Nuevo en `features/flota`: servicio y modelos de inspecciones/conductores, `InspeccionVehiculoDialog` (alta por pasos y detalle con aprobar/rechazar/anular), tabla de inspecciones, páginas **Inspecciones** (mis casos y lista) y **Conductores** (estado y registro de documentos).
- **Mantenimiento** (`maintenance-list-page`): las pestañas **Preventivo, Inspecciones e Historial** ya no usan la demo: alertas de Flota (traductor puro `flota-mantenimiento.mapper.ts` con su prueba), registro con el diálogo de preventivo de Flota, historial desde Flota (`HistorialDialog` con `unidadFlotaId`) e inspecciones de Flota; la campana de documentos por vencer sale de `GET conductores`.
- **Lo viejo se conserva** para las pantallas que siguen contra la demo hasta el Corte: `UnidadesService`, `VehicleInspectionsService`, `VehicleInspectionDialog`, `VehicleInspectionsTable`, `RegisterPMDialog` (usados por Inventario y por el ticket viejo de Pumping).

### Pendiente / a coordinar
- **Hoja imprimible DYN-SGI-RE-068** del detalle nuevo (la actual lee el modelo viejo de la demo).
- **Mantenimiento** debe enlazar el reporte de unidad con `flota.inspeccion_vehiculo` (consume `registrada` con `hayNovedades`); el seguimiento «reportado / en atención / atendida» de la tabla de inspecciones depende de eso.
- **Pumping** (tickets nuevos): usar `GET inspecciones-vehiculo/casos?ticketId=` y abrir el diálogo; retirar el puente `manual_temporal` cuando quiera. Pumping debería exigir la inspección solo a las unidades de transporte (D8).
- **Permisos de lectura:** FCR concedió `SELECT` de tabla completa sobre `catalogos.vehiculo` y `tipo_vehiculo` a `app_operaciones` (migración `fcr/20261018150000_init`), lo que anula la restricción por columnas del hallazgo 6; es el mismo usuario de la base, así que no se puede separar por módulo. Anotado en el registro.
- Anulación de documentos de conductor en pantalla (el backend ya la ofrece); F4 gerenciamiento de viaje y portal del Conductor; consulta a Dynadrill sobre la inspección de llegada.
- **Commits:** el frontend no se pudo confirmar con `commit-modulo.ps1` porque `commitlint` no está instalado en `dynadrill-frontend-platform` (`npx --no-install` falla). Ver el resumen al usuario.

## 17. Avance del 18/10/2026 (sesión Flota): F4 Gerenciamiento de Viaje y portal del Conductor

**Migración** `20261018190000_gerenciamiento_viaje` (aplicada) y semilla (12 preguntas, 3 umbrales).
- **Cuestionario en tablas:** `pregunta_riesgo_viaje`, `opcion_riesgo_viaje` (puntos; `impide_conducir` = la respuesta «Deténgase / no conduce», 999 del formato) y `umbral_riesgo_viaje` (BAJO desde 0, MEDIO desde 31, ALTO desde 76; cada fila dice **qué permiso autoriza ese nivel**, así no se decide por nombres de rol en el código).
- **Solicitud firmada:** `gerenciamiento_viaje` (+ respuestas, paradas y comunicación en filas, sin JSON). Origen y destino son una **base (`catalogos.bodega`) o un pozo** (CHECK de uno solo por extremo; salida = base → pozo del ticket; retorno al revés). Unidad, conductor, ticket y decisión con FK real; marca/placa salen del JOIN. `puntaje_total` y `nivel` son una **copia justificada** (documento emitido) con COMMENT.
- **Reglas en la base:** inmutable (solo se marca la decisión, una vez: trigger + `GRANT UPDATE` por columnas); la decisión exige quién, cuándo y motivo ≥ 5 letras al rechazar; **nadie decide sobre su propia solicitud** (CHECK); **un vigente por ticket y tipo** (índice único parcial; el rechazado deja rehacer); la opción debe ser de su pregunta (FK compuesta).
- **Servicio:** el puntaje y el nivel los calcula el servidor; todas las preguntas contestadas; una respuesta que impide viajar → 422 `conductor_no_debe_conducir`; unidad de transporte activa; quién autoriza = permiso del umbral del nivel (BAJO `flota.viajes.aprobar`; MEDIO/ALTO `flota.viajes.autorizar_mayor`, nuevo: Jefe de Base, Gerente HSE, Superadmin). `gerenciamientoViajeApprove` ganó al Gerente HSE en `module-roles.ts`.
- **API** `/api/operaciones/flota/gerenciamientos-viaje`: `preguntas`, `umbrales`, `unidades` y `bodegas` (para el Conductor, sin abrirle `flota.unidades.ver`), listar (el Conductor ve lo suyo; quien autoriza ve todo), `:id`, solicitar, `:id/autorizar`, `:id/rechazar`.
- **Eventos** (`source: 'flota'`): `flota.gerenciamiento_viaje.solicitado`, y los del contrato 3 `aprobado` / `rechazado` con `ticketId` y `tipo` (solo cuando la solicitud tiene ticket). Pumping ya los consume (`REGLAS_EXTERNAS`).
- **Pruebas:** 72 en total en Flota (14 de F4, incluidas las que intentan violar la base y los cuatro niveles de autorización).

**Frontend** (`features/flota`): página **Gerenciamiento de viaje** (portal del Conductor y bandeja de autorización según el permiso), asistente de 4 pasos con vista previa del riesgo, detalle con autorizar/rechazar y menú con `NavEntry.anyPermission`. Los tickets del Conductor salen de `GET /operaciones/pumping/tickets/mis-viajes` (Pumping, permiso `pumping.tickets.contexto_conductor`); la unidad se sugiere desde el caso de inspección del ticket. `ng build` y 409 pruebas en verde.

**Decisiones conservadoras (ver consultas F-9 a F-12):** una respuesta «no viaja» (999) **no deja enviar** la solicitud; las opciones con 75 y 50 puntos rotuladas «no viaja» siguen **sumando** como en la demo (75 es MEDIO, no ALTO); sin aviso por correo todavía (falta plantilla en `plantillas/flota.ts`).

**Pendiente:** hoja imprimible DYN-SGI-RE-049; avisos (correo y campanita) al autorizador por nivel y al Conductor con la decisión; que Pumping valide que el solicitante es operador asignado al ticket (Flota solo verifica que el ticket exista); retirar las pantallas viejas de la demo (`maintenance/pages/gerenciamiento-viaje-page`, `features/conductor`) en el Corte.

## 18. Avance del 18/10/2026 (noche): regla de autorización corregida, avisos, hojas y documentos

- **Corrección de negocio (decisión del usuario, 18/10/2026).** El gerenciamiento de viaje de riesgo **MEDIO lo autoriza el Supervisor** (igual que el BAJO) y el **ALTO un gerente** (Gerente HSE o Jefe de Base, permiso `flota.viajes.autorizar_mayor`). Esto **reemplaza** lo que dice la sección 17 y difiere de la demo (el controlador de la demo deja al Supervisor solo el BAJO y manda MEDIO/ALTO al Jefe de Base; el formato impreso DYN-SGI-RE-049 dice «MEDIO: requiere aprobación de Jefe de Base»). Se aplicó como **datos**, no como código: migración `20261018200000_medio_lo_autoriza_el_supervisor` (cambia `permiso_autoriza` y la descripción de los umbrales medio y alto) y la semilla. Nueva regla de jerarquía: quien tiene `flota.viajes.autorizar_mayor` puede autorizar **cualquier** nivel. **Ojo:** la hoja imprimible sigue diciendo «Jefe de Base» para el MEDIO; es texto fijo del formato, a cambiar si Dynadrill lo confirma.
- **Avisos (correo y campanita)**, `libs/plataforma/avisos/.../plantillas/flota.ts` (+ una línea en el índice y una suscripción `source: 'flota'` en `eventos-con-aviso.consumer.ts`): `flota.gerenciamiento_viaje.por_autorizar_supervisor` (a `supervisor_pumping` y `supervisor`) o `por_autorizar_gerente` (a `gerente_hse` y `jefe_base`), según el permiso del umbral del nivel; `flota.gerenciamiento_viaje.decidido` (a la cuenta del Conductor, con `asignados`) y la inspección rechazada (`flota.inspeccion_vehiculo.rechazada` lleva ahora `asignados` con el conductor; Pumping ignora los campos extra). Plantillas y reglas sembradas (`db:seed:avisos`: 6 y 6); plataforma y operaciones reiniciadas; colas `plataforma.flota` y `operaciones.operaciones.flota` con su consumidor.
- **Hojas imprimibles** DYN-SGI-RE-068 y DYN-SGI-RE-049 desde el detalle («Ver PDF»): traductores puros `features/flota/models/hojas.mapper.ts` (con prueba) hacia el modelo que ya leen las hojas, sin tocar las hojas compartidas. Los seis documentos del conductor salen vigentes en la 068 porque el servidor no guarda una inspección si alguno no lo está. El detalle del viaje trae ahora el número de ticket (columna `ticket_numero` en el espejo de `pumping.ticket`, solo lectura).
- **Documentos de conductor:** diálogo de historia con **anulación** (motivo ≥ 5 letras) desde la pantalla Conductores.
- **Pruebas:** 73 en Flota (backend), 9 de plantillas en avisos y 432 en el frontend. Dos hallazgos de las pruebas: el ayudante de fechas debía contar los días en hora de Ecuador (de noche la fecha UTC ya es la de mañana) y se agregó el id UUIDv7 como desempate al ordenar los documentos.

**Pendiente (no es de Flota):** que Pumping valide que quien solicita el viaje es operador asignado del ticket; que Mantenimiento enlace su reporte con `flota.inspeccion_vehiculo.registrada`; retirar en el Corte las pantallas viejas de la demo.
