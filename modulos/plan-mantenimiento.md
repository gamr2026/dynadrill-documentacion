# Plan: Mantenimiento

**Schema:** `mantenimiento` · **Contenedor:** operaciones (3103) · **Librería:** `libs/operaciones/mantenimiento` (`@dyn/mantenimiento`) · **Prefijo HTTP:** `/api/operaciones/mantenimiento`
**Estado:** M1 backend hecho (ver sección 13) · **Ola:** 1 (empieza cuando Flota tenga la tabla `unidad`; mientras tanto puede avanzar con el diseño y las órdenes)
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

## 13. Estado de la construcción (actualizado 16/10/2026, sesión Mantenimiento)

### Qué se quería
Tramo **M1**: diseño y reportes recibidos + clasificación (descartar con motivo o generar orden con sub-órdenes), con el contrato 4.2 con Pumping, mientras Flota terminaba F1.

### Qué se hizo (backend, completo y verificado)
- Librería `libs/operaciones/mantenimiento` (`@dyn/mantenimiento`): schema Prisma con espejos de solo lectura de `flota.unidad`, `pumping.reporte_unidad`/`ticket` e `identidad`.
- Migración `20261016200000_reportes_ordenes_y_subordenes` **aplicada**; semilla corrida e idempotente (`npm run db:seed:mantenimiento`): 3 tipos de sub-orden, 7 estados, 11 transiciones, contador de reportes.
- Modelo normalizado: `reporte_recibido` (una referencia con FK por origen; QHSE sin FK por D1), `orden` (1 por reporte), `suborden`, catálogos `tipo_suborden`, `estado_suborden`, `transicion_suborden`, `contador`. El estado de la orden **se deriva** (no se guarda); los códigos de orden y sub-orden salen por JOIN (`R0001`, `R0001-M/I/O`).
- Servicios: recepción idempotente del evento de llegada, descartar (motivo obligatorio, también en la base), clasificar, reclasificar (conserva las cerradas), listados, tipos y `GET unidades/:id/subordenes` (tarjeta del ticket). Eventos publicados: `operaciones.mantenimiento.reporte.recibido|descartado`, `orden.creada`, `suborden.asignada|derivada_a_pumping`.
- Permisos: se reutilizan los seis `mantenimiento.*` existentes (sin cambios en `permissions.ts`).
- Verificación: 26 pruebas verdes (integración con base real + unitarias del estado de la orden), `lint` y `build` de `operaciones` en verde. Contenedor `operaciones` reiniciado (3103) y ruteado por el gateway (responde 403 sin permisos, no 404).
- Compartidos tocados (una línea cada uno): `package.json`, `tsconfig.base.json`, `apps/operaciones/src/app/app.module.ts`. Registrado en `REGISTRO-DE-CAMBIOS-COMPARTIDOS.md` junto con: pedido a Pumping del evento 4.2, riesgo de colas compartidas en RabbitMQ y nota de la primera migración de Prisma.
- Consultas anotadas: `documentacion/mantenimiento/CONSULTAS-PARA-DYNADRILL.md` (sección `## Mantenimiento`, M-1 a M-6).

### Qué se hizo del frontend (parcial, sin compilar)
Solo en `dynadrill-frontend-platform/src/app/features/maintenance/reportes-nuevos/`: `models/mantenimiento-nuevo.ts` y `services/mantenimiento-nuevo.service.ts`. **No** se ha compilado ni probado.

### Qué falta
1. **Frontend M1**: página de reportes recibidos (filtros, Clasificar, Descartar con `MotivoDialog`), diálogo de clasificación (tipos, operador de mantenimiento vía `usuariosPorRol('operador_mantenimiento')`, derivación del operativo), pestaña de órdenes, ruta con `permissionGuard` en `maintenance.routes.ts`, entrada de menú en `navigation.service.ts` (Jefe de Mantenimiento, Superadmin, Jefe de Base), pruebas del modelo, y luego `ng test` y `ng build` (con bloqueo `nx.lock`).
2. **Bloqueante externo**: Pumping debe publicar `operaciones.pumping.reporte_unidad_llegada` (hoy la bandeja solo se llena en pruebas); Flota debe enlazar cada vehículo del catálogo con su `flota.unidad`.
3. **M2**: ejecución de sub-órdenes (guardar avance, enviar a revisión, aprobar/pedir corrección, derivar, reasignar), tabla `suborden_repuesto`, retorno a operación y cierre de la orden (esto escribe el historial correctivo).
4. **M3**: historial de mantenimientos y preventivos usando el servicio exportado de Flota (ojo: Flota ya tiene `unidad_preventivo`; evitar duplicar) y lecturas de horómetro/km desde el reporte de llegada.
5. **M4**: tarjeta «Mantenimientos» en el ticket de Pumping (coordinar con esa sesión), plantillas de avisos (`plantillas/mantenimiento.ts` + eventos en `eventos-con-aviso.consumer.ts`), permiso de lectura del ticket para mantenimiento, KPI y hojas imprimibles (DYN-MNT-RE-008, órdenes General y Operativa).
6. Más adelante: columnas con FK para origen FCR y Vehículos (migraciones propias) y recepción del origen QHSE.
7. **Git**: no se hizo ningún commit. Todo está sin confirmar en el árbol compartido (rama `desarrollo`); para respaldar en `modulo/mantenimiento` conviene confirmar solo estas rutas: `libs/operaciones/mantenimiento`, las tres líneas compartidas y los archivos de documentación/frontend citados.

### Decisiones que necesito del usuario
- **Colas de RabbitMQ compartidas** entre módulos del mismo contenedor (cambio en `libs/shared/messaging`): ¿lo autoriza la sesión principal?
- Respuestas a M-1 a M-6 (en especial numeración de reportes y fórmulas de KPI).
- Cómo respaldar el trabajo en git dado que todas las sesiones comparten un solo árbol de trabajo.

## Hallazgos de la revisión de base de datos (17/10/2026): pulir antes de seguir

Revisado sobre `20261016200000_reportes_ordenes_y_subordenes`. El CHECK de origen del reporte, las FK reales a Flota y Pumping y los pares de columnas (asignación, cierre, retorno) están bien: manténgalos.

1. **Claves de texto en los catálogos** (`tipo_suborden`, `estado_suborden`): usan el código como clave primaria. El resto de la plataforma usa `id uuid` + `codigo` único + FK. Unifique el patrón (o documente por escrito por qué esta es la excepción) para no tener dos estilos.
2. **Copia de texto de QHSE:** `reporte_recibido.novedad_qhse` copia la novedad de otro módulo y `qhse_referencia_id` no tiene FK. Es aceptable solo por ser de otro contenedor (D1): déjelo anotado en COMMENT, en este plan y en la decisión D1, y mantenga el texto actualizado por evento o conserve solo el id y pida el texto por el contrato.
3. **Acoplamiento con `pumping.reporte_unidad`:** la FK es válida (mismo contenedor) pero ata los dos schemas. Agregue una prueba de integración que cubra el camino completo (reporte de Pumping, evento, reporte recibido, orden) y anótelo en el contrato 4.2 para que Pumping no cambie esa tabla sin avisar por el registro.
4. **Repuestos como texto:** la sub-orden lleva repuestos; modélelos en una tabla `suborden_repuesto` (número de parte, cantidad, descripción, o FK a `inventario.articulo` cuando exista), nunca en un campo de texto.
5. **Columnas pendientes de FCR y Vehículos:** agréguelas con migración propia cuando existan sus tablas, con su FK y el CHECK de origen ya previsto.
6. **Textos largos de la sub-orden** (`diagnostico`, `actividades_correctivas`, `trabajos_adicionales`): están bien como texto libre porque son redacción, pero compruebe que no haya conjuntos conocidos escondidos ahí.
7. **Contador propio:** pruebe que 25 reportes simultáneos no repiten número (bloqueo de fila, igual que la prueba de secuenciales).
8. **Falta construir** con el mismo estándar: M2 máquina de estados completa (el estado de la orden se deriva, no se guarda), M3 historial de mantenimientos y preventivos (usa el servicio de Flota, no escribe sus tablas), M4 tarjeta en el ticket, avisos, KPI.
9. **Auditoría:** `reporte_recibido` no tiene `created_by/updated_by`; agréguelos o justifique con `recibido_por`.

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

## 14. Respuesta a la revisión de base de datos y verificación del estándar (17/10/2026)

Migración nueva `20261017100000_catalogos_con_id_auditoria_y_repuestos` (aplicada; la anterior no se editó). Pruebas: 30 verdes.

| Hallazgo | Qué se hizo |
|---|---|
| 1. Catálogos con clave de texto | `tipo_suborden` y `estado_suborden` ahora tienen `id uuid` + `codigo` único; `suborden` y `transicion_suborden` apuntan por FK a ese id. La semilla genera UUIDv7. Los códigos (`pendiente`, `mecanico`…) siguen siendo estables y la aplicación los traduce al id. |
| 2. Texto de QHSE | Se mantiene por ser otro contenedor (D1). Quedó escrito en `COMMENT` de `qhse_referencia_id` y `novedad_qhse`, aquí y en el contrato 4.2/D1: es el **único** texto copiado de otro módulo, se actualiza por evento; el de Pumping no se copia (se lee por JOIN). |
| 3. Acoplamiento con Pumping | FK conservada (mismo contenedor). Prueba de «camino completo» (reporte de Pumping → evento → reporte recibido → orden, verificado con un solo JOIN de las cuatro tablas). Anotado en el contrato 4.2 y en el registro: Pumping no cambia `reporte_unidad` sin avisar. |
| 4. Repuestos | Tabla `suborden_repuesto` (parte, cantidad > 0, descripción, `articulo_id` FK a `inventario.articulo`, única por parte y sub-orden, con auditoría). La usa M2. |
| 5. FCR y Vehículos | Pendiente con su migración propia cuando existan `fcr` y la inspección de Flota (F3); el CHECK de origen ya está previsto y se extiende entonces. |
| 6. Textos largos | Revisados: `diagnostico`, `actividades_correctivas`, `trabajos_adicionales`, `nota_*` son redacción libre; no esconden conjuntos conocidos. |
| 7. Contador | Prueba con 25 reportes simultáneos sin números repetidos (bloqueo de fila). |
| 8. M2, M3, M4 | Siguen pendientes (sección 13); se construyen con este estándar. |
| 9. Auditoría | `reporte_recibido` ahora tiene `created_by/updated_by` (FK a `identidad.usuario`), llenados al recibir y al descartar. Catálogos del sistema sin auditoría de edición (están en `COMMENT`: se siembran). |

Verificación del estándar de calidad: (1) sin datos duplicados, salvo la excepción 2; (2) sin id sin FK en el mismo contenedor; (3) catálogos con id y códigos estables, sin comparar nombres; (4) CHECK de origen, de descarte, de retorno, de asignación y de cierre, índices únicos (un reporte de Pumping se recibe una vez, un tipo por orden, una parte por sub-orden); (5) sin historia propia todavía: el historial de M3 nacerá sin UPDATE/DELETE para `app_operaciones` (hoy la aplicación ya **no puede borrar** reportes ni órdenes, probado); (6) auditoría uniforme; (7) lectura de maestros solo por columnas (`identidad.usuario`: id, nombre, correo, activo, rol; ningún dato personal sensible); (8) una migración por cambio; (9)-(10) pruebas que intentan violar CHECK, FK y permisos y esperan el rechazo.

Pendiente de revisión por el usuario: ver decisiones en el mensaje final (colas de RabbitMQ, numeración, git).

## Repuestos desde Inventario (17/10/2026, decisión del usuario)

La demo pide el repuesto usado como **texto libre**. Con el reporte de AS2 ya están cargados en Inventario **653 repuestos y suministros** (categoría
MANTENIMIENTO, marca `es_repuesto`). En M2 (ejecución de la sub-orden) el operador de mantenimiento **elige el repuesto del catálogo**:
`GET /api/operaciones/inventario/articulos?repuestos=true&q=<texto>` (permiso `inventario.articulos.ver`), y se guarda en
`suborden_repuesto.articulo_id` (FK real: mismo contenedor) con la cantidad. Si el repuesto no existe en el catálogo se permite el texto
(`numero_parte` + descripción) como respaldo, y Bodega puede darlo de alta después. Pendiente de decidir: si usar un repuesto genera una **salida
de bodega** del kardex (hoy el catálogo viene sin saldos).
