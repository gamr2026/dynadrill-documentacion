# Plan: QHSE (Calidad, Salud, Seguridad y Ambiente)

**Schema:** `qhse` · **Contenedor:** **qhse (nuevo, puerto 3104)** · **Librería:** **una sola, `libs/qhse/seguridad`** (`@dyn/qhse`, proyecto Nx `qhse-seguridad`), con una carpeta por subdominio dentro de `src/` (decidido en Q1: un schema `qhse` implica una sola tabla de historial de Prisma y un solo `schema.prisma`; varias librerías se pisarían) · **Prefijo HTTP:** `/api/v2/qhse` (reescrito a `/api/qhse` por el gateway; el `/api/qhse` de la demo **sigue en la demo** hasta el corte)
**Estado:** **Q1 construido** (16/10/2026; ver la sección «Estado de avance» al final) · **Ola:** 1, empezando por el tramo que Pumping necesita (Q1) · **Tamaño:** el más grande de todos (≈ 3.300 líneas de backend y ≈ 10.300 de frontend en la demo)
**Lea antes:** `00`, `01`, `02` (contratos 3, 4.5, 4.6, 4.11), `03` (D1, D6, D7, D10) y `04-REVISION-CONTRA-DEMO-MAIN.md` (hallazgos 4, 9, 12, 13), `documentacion/PLAN-QHSE-PUMPING-NOTIFICACIONES.md` y `documentacion/qhse/QHSE-CAMBIOS-PENDIENTES.md`. **Revisado contra el `main` de la demo (08/10/2026).**

## 1. Objetivo

Construir el módulo QHSE completo del portal nuevo y, **primero**, lo que Pumping necesita para que el Traslado de salida funcione sin el puente temporal: la **entrega de EPI** y la consulta de las **aceptaciones de términos**.

## 2. Qué hay en la demo

| Parte | Dónde |
|---|---|
| Backend (subdominios, todos con `payload` JSON) | `dynadrill-backend/libs/domains/qhse/src/`: `iperc`, `iperc-cobertura`, `ptw`, `stop`, `swa`, `inspecciones`, `desechos`, `derrames`, `emergencias`, `investigaciones`, `epi`, `checklist-equipos` (**reemplazado**, ver abajo), `documentos` (573 líneas: documentos por pedido), `legal`, `aspectos-ambientales`, `objetivos-ambientales`, `dashboard-metas`, `avisos`. En el `main` ya **no** está `checklist-equipos` |
| Frontend (≈ 10.300 líneas) | `features/qhse/`: `iperc`, `ptw`, `stop`, `swa`, `inspecciones`, `desechos`, `derrames`, `emergencias`, `investigaciones`, `epi`, `documentos`, `legal`, `aspectos-ambientales`, `objetivos-ambientales`, `dashboard`, `hubs`, `eventos`, `shared` |
| Formatos y avance | `documentacion/qhse/`: DYN-SGI-RE-008 (tarjeta de observación), **DYN-SGI-RE-032 (registro de entrega de EPI y ropa de trabajo)**, DYN-SGI-RE-034 (investigación de incidentes), DYN-SGI-RE-087 (IPERC); `QHSE-CAMBIOS-PENDIENTES.md` (fases 1–4 y cierre) |
| Plan de integración con Pumping | `documentacion/PLAN-QHSE-PUMPING-NOTIFICACIONES.md` (v2) |
| Spec | `dynadrill-frontend-platform/specs/pumping-terminos-condiciones/SPEC.md` |

## 3. Qué hacen los otros módulos

- **Pumping** (esta sesión) ya espera de QHSE los eventos `qhse.epi.despachada` / `qhse.epi.revertida` (contrato 3) y publica `operaciones.pumping.asignacion_realizada` y `.ticket_creado`, que QHSE consume (contrato 4.6). Las aceptaciones de términos **las guarda Pumping** (`pumping.aceptacion_terminos`); QHSE solo las **consulta**.
- **Flota** es dueña de la inspección de vehículos (la demo mezclaba esto con el "checklist de equipos de QHSE", que ya no existe en el flujo; no lo reconstruya).
- **Firmas y Auditoría** (plataforma) dará el mecanismo de firma-evidencia; hasta entonces use `una línea` (usuario + hora del servidor) guardada en su propia tabla (D6).
- **Reportería** consumirá sus eventos para los KPI de HSE.

## 4. Decisiones de arquitectura que usted debe cerrar al empezar

1. **Cree el contenedor** `apps/qhse` copiando `apps/operaciones` (puerto 3104, usuario `app_qhse`, schemas `qhse` y `msg_qhse`, que ya existen en `infra/db/init`). Agregue `QHSE_URL` al gateway (la variable ya existe), a `scripts/levantar-local.ps1` y al script de reinicio. Anótelo en el registro (D7).
2. **Gateway:** `qhse` hoy apunta a `/api/qhse`, que es **todo** el QHSE de la demo. Cámbielo a `['/api/v2/qhse']` con reescritura a `/api/qhse` (como `v2/catalogos`) y corrija `routes.spec.ts`. Así el QHSE de la demo sigue funcionando hasta el corte.
3. **Roles:** `tecnico_hse` y `gerente_hse` (el rol `coordinador_hse` fue retirado a propósito: D4; el Gerente HSE conserva sus permisos). `withAdmins(...)` incluye Superadmin y Jefe de Base. La demo `main` incluye a `coordinador_hse` en `qhse`, `ipercApprove` y otras matrices: en la plataforma esos permisos son del Gerente HSE. **El Supervisor NO entra a los controllers de QHSE** (pedido del cliente); lo que sube o descarga el Supervisor cuelga de los endpoints del ticket.
4. **Archivos** (documentos QHSE, fotos, certificados): módulo `archivos`, un `modulo_archivo` por tipo. **FK** `archivo_id` a `archivos.archivo`.
5. **Acceso a datos de otro contenedor** (ticket, pedido): `uuid` **sin FK** + validación por evento (D1). A las maestras (`catalogos`, `identidad`, `archivos`) sí con FK, con `GRANT SELECT` mínimo para `app_qhse` (ver la migración `20261017120000_normalizar_con_fk` de comercial como modelo).

## 5. Tramos (haga uno a la vez y publique su estado)

### Q1 — Contenedor + EPI + consulta de términos (lo que Pumping necesita)
- Contenedor `qhse`, módulo base, salud, gateway `v2`.
- **EPI (DYN-SGI-RE-032)**: solicitud (la genera el equipo operativo para **cada operador** del ticket, o QHSE la abre al consumir la asignación), aprobación o rechazo (con motivo), despacho. Estados: `solicitado`, `aprobado`, `despachado`, `rechazado`. Una cabecera por entrega (lugar, **trabajador = FK a `identidad.usuario`** —no por nombre como la demo—, ticket, estado, quién y cuándo aprobó/rechazó/despachó) y **renglones** (elemento EPI, cantidad, talla, código o cédula, si recibió capacitación, observaciones, fecha de entrega) con un **catálogo `epi_elemento`**; dos firmas ("una línea"): la del trabajador y la de Talento Humano.
- **Publica** `qhse.epi.despachada` / `qhse.epi.revertida` (contrato 3); **consume** `operaciones.pumping.asignacion_realizada`. Retire el puente temporal para ese requisito **avisándole a la sesión de Pumping** por el registro.
- **Consulta de aceptaciones de términos** (historial por operador): lee `pumping.aceptacion_terminos` por HTTP o evento (hoy Pumping es del contenedor `operaciones`: acuerde con la sesión de Pumping si expone un endpoint de consulta). Verlo es del Técnico y el Gerente HSE y de los Supervisores de Pumping (permiso `pumpingTerminosHistorial` en la demo). La **cédula** sale del perfil de la cuenta del operador (JOIN), no se captura.
- Hoja imprimible de la entrega de EPI y de la constancia de términos (`window.print()`).

### Q2 — Control operativo diario (HSE-SEGUIMIENTO-001/002/003)
- **SWA (Stop Work Authority)**: activación, cadena de notificación (Supervisor, Coordinador HSE, Gerente HSE), evaluación riesgo real / falsa alarma (bloqueada hasta notificar a los tres roles), checklist de reinicio. **Publica** `qhse.swa.activado|cerrado` con `ticketId` (contrato 4.5, bloquea reportes en Pumping/FCR, D10).
- **STOP** (tarjeta de observación DYN-SGI-RE-008): acto o condición insegura, 8 categorías, observador obligatorio y observado opcional ("Anónimo"), foto, tendencias (Pareto).
- **Inspecciones de campo** (eslinga de cable, detector de gas, vehículo-grúa): checklist de criterios de rechazo por tipo, *bump test*, vigencia trimestral, cuarentena. Una inspección de vehículo-grúa rechazada puede originar un reporte de unidad para Mantenimiento (evento).
- **"Reportar"**: acceso rápido (STOP, SWA, inspección, desecho, derrame) para cualquier usuario autenticado, fuera del guard de QHSE.

### Q3 — IPERC y PTW (HSE-PLAN-001, HSE-SITIO-001)
- **IPERC** (DYN-SGI-RE-087): 4 fases, matriz de riesgo 5×5, cobertura por línea de servicio (qué actividades de la matriz maestra exige cada línea: `iperc-cobertura`). Un PTW solo se abre desde un IPERC **aprobado**.
- **PTW**: fases Gabinete → Ingreso → Verificaciones → Formalización → Ejecución → Gestión documental; un PTW por día de operación y pedido; el "PT" del día. **El PTW ya no pide el Acta de Entrega** (el ticket sí la pide al cerrar) y el último paso pasó de «Cierre del PTW» a **«Aprobación del PTW»** (es una aprobación de QHSE); el certificado se ve en vista de impresión. **El checklist de ingreso y verificaciones (gases, LOTO) no es del PTW**: lo llena el equipo operativo en Pumping **al inicio de la ejecución** (ya construido). La "formalización de ejecución" (el Company Man aprobó) la confirma el Supervisor en el ticket, también al inicio de la ejecución.
- **Publica** `qhse.ptw.abierto|firmado|cerrado`.
- **Documentos por pedido**: formato de recepción, **ART** (vigencia legal de **15 días**, aviso 3 días antes; puede haber varios por pedido), **PT**, **SFI** (formato de seguridad de ingreso) y el **Acta de Entrega de Locación (DYN-PMP-RE-027)**, que **sube el Supervisor al finalizar el ticket** (una por pedido; **el ticket no se cierra sin ella**, contrato 4.11). El **Carnet de Vacunas ya no se carga ni se exige** (el cliente lo retiró). QHSE ve y sube **ART y PT también de los tickets FCR**. Una tabla `documento_pedido` con tipo (enum: `formato_recepcion`, `art`, `pt`, `sfi`, `formato_entrega`), referencia, `archivo_id` (FK), `vigente_hasta`. Avisos "calculados": pedido sin formato de recepción, personal asignado sin SFI, PTW sin PT hoy, ART por vencer/vencido.

### Q4 — Ambiental (HSE-AMBIENTAL-001/002)
- **Desechos**: peligroso/no peligroso con características CRETIB, contenedor por color, **límite de almacenamiento de 12 meses** (AM 142), manifiesto y tres firmas, certificado.
- **Derrames**: alerta por volumen y ubicación (los umbrales de las bandas son un supuesto de la demo: **consulta**), checklist de contención de 5 minutos, notificación obligatoria al MAE, **derrame en suelo genera un desecho**, derrame mayor escala a emergencia.

### Q5 — Emergencias e investigación (HSE-TRIAGE-001/002)
- **Plan de emergencias / MEDEVAC**: activación con cronómetro, nivel 1–3, conteo de personal (locación, evacuados, faltantes), triage médico por color, signos vitales, notificación a hospital.
- **Investigación de incidentes** (DYN-SGI-RE-034): clasificación *Near Miss* / Leve / Grave / Fatal (plazo de 30 días para *Near Miss*), 5 Porqués, Ishikawa, acciones correctivas y preventivas.

### Q6 — Cierre: legal, objetivos, aspectos, dashboard
- **Legal** (requisitos legales), **objetivos ambientales**, **aspectos ambientales**, **metas del dashboard** y el **dashboard HSE-MASTER-001** (TRIR, LTIR, días sin LTI, ratio *Near Miss*:incidente, % PTW a tiempo, desechos kg/mes). Los KPI salen de `reporting` (plan de Reportería); aquí solo las metas configurables.

## 6. Modelo de datos: principios para todos los subdominios

- Enums de PostgreSQL para estados y valores fijos de formatos regulados (niveles de emergencia 1–3, clasificación de incidente, color de contenedor CRETIB, fases del PTW, categoría STOP, tipo de inspección).
- Catálogos como tablas (elementos de EPI, categorías STOP, tipos de inspección y sus criterios de rechazo, residuos y características CRETIB, preguntas y niveles de la matriz de riesgo).
- Listas anidadas (ítems de una entrega de EPI, controles de un IPERC, lecturas de gas, acciones correctivas) en **tablas hijas**, nunca JSON.
- Personas: FK a `identidad.usuario`. Observador "anónimo": columna booleana, sin guardar un texto "Anónimo".
- Referencias a pedido y ticket: `uuid` sin FK (otro contenedor, D1) + validación por evento al crear.

## 7. API y permisos

`/api/v2/qhse/{epi,swa,stop,inspecciones,iperc,ptw,documentos,desechos,derrames,emergencias,investigaciones,legal,...}`. Permisos en un bloque `qhse` de `permissions.ts` (hoy solo hay `qhse.general.gestionar`, `qhse.iperc.aprobar`, `qhse.eventos.reportar`): defina ver/crear/aprobar por subdominio. **Los endpoints de "reportar" usan `@AnyAuthenticated()`** (cualquier usuario autenticado).

## 8. Pantallas

Las de `features/qhse/*`, con los servicios apuntando a `/api/v2/qhse`. El frontend ya trae `qhse-avisos-feeder.service.ts` (campanita): migre su fuente a los avisos de la plataforma y retire los cálculos por consulta cuando sea posible. Hojas imprimibles: EPI, constancia de términos, PTW, IPERC, manifiesto de desechos, informe de investigación.

## 9. Pruebas

Por tramo: integración con base real (estados y transiciones, permisos por rol, que el Supervisor **no** entre, eventos del contrato, idempotencia del consumidor, vigencia del ART a 15 días, límite de 12 meses de desechos, bloqueo "notificar a los tres roles" de la SWA).

## 10. Consultas para Dynadrill (`documentacion/qhse/CONSULTAS-PARA-DYNADRILL.md`, sección `## QHSE`)

- Valores oficiales de las bandas de volumen de derrame (la demo supone < 1 / 1–10 / > 10 barriles).
- ¿Quién valida el texto de Términos y condiciones? (D9)
- ¿Se mantiene el bloqueo por SWA? (D10; en la demo `main` solo bloquea el frontend) ¿El PTW bloquea la ejecución o solo avisa (el ART vencido hoy solo avisa)?
- ¿Se conservan los datos de QHSE de la demo? (D11)

## 11. Puntos de choque

`permissions.ts` (bloque `qhse`), `routes.ts` del gateway (su prefijo), `apps/qhse/**` (suyo), `levantar-local.ps1`, `package.json`, `tsconfig.base.json`, plantillas de avisos (`plantillas/qhse.ts`). **No** toque `libs/operaciones/**`.

## 12. Preguntas abiertas entre módulos

_(Pumping: ¿expone un endpoint de consulta de aceptaciones de términos o lo consume QHSE por evento? · Flota: ¿quién abre el caso de inspección de vehículos cuando una inspección QHSE de vehículo-grúa se rechaza?)_

## 13. Estado de avance

### Q1 — Contenedor + EPI + consulta de términos · **construido el 16/10/2026**

**Qué quedó**
- **Contenedor `qhse`** (`apps/qhse`, puerto 3104, usuario `app_qhse`, `msg_qhse`): creado, con salud, `levantar-local.ps1` y el gateway con el prefijo `/api/v2/qhse` (reescrito a `/api/qhse`). `/api/qhse` sigue en la demo.
- **Migración `20261016190000_epi_y_referencia_de_tickets`** aplicada y semilla (`npm run db:seed:qhse`: 12 elementos de EPI). Tablas: `ticket_ref` (el ticket se conoce por evento, sin FK al schema ajeno: D1), `epi_elemento` (catálogo), `epi_entrega` (cabecera; trabajador, quién aprobó, rechazó, despachó y firmó = FK a `identidad.usuario`; enum `estado_epi`; restricción que obliga a que las fechas coincidan con el estado), `epi_entrega_item` (renglones con FK al catálogo) y `epi_entrega_historial` (rastro que solo se agrega). Cero JSON, cero copias de nombre; la cédula y el cargo salen de `identidad.usuario_perfil` por JOIN (`GRANT SELECT` solo de `cedula` y `cargo`).
- **API** `/api/v2/qhse/epi`: listar, detalle, catálogo de elementos, crear a mano, guardar renglones y lugar, aprobar, rechazar (motivo), despachar, revertir (motivo), firma del trabajador y recibe conforme de Talento Humano. Permisos nuevos: `qhse.epi.ver|crear|aprobar|despachar` (Técnico HSE, Gerente HSE y administradores; el Supervisor no entra). Para despachar hacen falta: aprobada, al menos un elemento, lugar y declaración del trabajador.
- **Eventos**: consume `operaciones.pumping.asignacion_realizada` (abre una solicitud por operador asignado, idempotente, y un solo aviso a QHSE por asignación: `qhse.epi.solicitudes_abiertas`) y `ticket_creado` (referencia del ticket). Publica `qhse.epi.despachada` / `qhse.epi.revertida` (contrato 3, ya **vigentes**) y `qhse.epi.solicitada|aprobada|rechazada`. Plantillas de aviso en `libs/plataforma/avisos/.../plantillas/qhse.ts` (Técnico y Gerente HSE).
- **Pantallas** (`dynadrill-frontend-platform`, `features/qhse/entrega-epi/`): bandeja con KPI, filtros y búsqueda; detalle con edición de renglones, acciones del ciclo según permiso e historial; registro manual; hoja imprimible DYN-SGI-RE-032 (`window.print()`); pestaña «Términos y condiciones (Pumping)» con constancia imprimible. La ruta `/dashboard/qhse/epi` se autoriza por permiso. Las carpetas del demo (`features/qhse/epi`) siguen para el ticket antiguo de Pumping.
- **Pruebas** de integración con base real (`RUN_INTEGRATION=1 npx jest` en la librería): consumidor, idempotencia, ciclo completo, contrato 3, rechazo, registro manual, permisos (el Supervisor no entra), reglas de la base y rastro inmutable.

**Lo que falta de Q1 / pendiente de otros**
- **Términos**: depende de que Pumping publique `GET /api/operaciones/pumping/terminos/aceptaciones` (pedido en el registro y contrato 4.12). Mientras tanto la pestaña muestra un aviso. La constancia aún no incluye el texto aceptado (hace falta que Pumping lo entregue por versión).
- **Pumping** puede retirar el puente temporal de `epi_despachado` cuando QHSE esté levantado.
- Consultas para Dynadrill: `documentacion/qhse/CONSULTAS-PARA-DYNADRILL.md` (sección QHSE).

### Próximo tramo: Q2 (SWA, STOP, inspecciones de campo y «Reportar»)

## Hallazgos de la revisión de base de datos (17/10/2026): pulir antes de seguir

Revisado sobre `20261016190000_epi_y_referencia_de_tickets`. Los CHECK que atan el estado de la entrega a sus fechas, el índice único parcial por ticket y trabajador y la bitácora sin UPDATE están bien: manténgalos.

1. **`ticket_ref` copia datos de otro contenedor** (`ticket_numero`, `pedido_codigo`). Reduzca a los ids; si necesita mostrar el número o el código, justifique la copia en COMMENT y en el plan, y manténgala por evento (con prueba de que un cambio posterior se actualiza).
2. **Texto libre donde hay conjuntos conocidos:** `epi_entrega.lugar`, `epi_entrega_item.talla` y `epi_entrega_item.codigo`. Modele `lugar` con FK a un catálogo de `catalogos` (campo, base o bodega, según el formato), `talla` como catálogo o enum por tipo de elemento, y decida si `codigo` es el código de un artículo de Inventario (entonces FK a `inventario.articulo`).
3. **EPI versus Inventario:** `epi_elemento` es un catálogo propio, pero la entrega de EPI es una salida de bodega. Defina con la sesión de Inventario si cada elemento es un `inventario.articulo` (y la entrega genera la salida de kardex) o si QHSE lleva su propio control; anote la decisión en `03-DECISIONES-PENDIENTES.md`.
4. **Historia incompleta:** `epi_entrega_historial` prohíbe UPDATE pero permite DELETE; revoque también DELETE. `epi_entrega_item` tiene `GRANT DELETE` aunque la entrega ya esté despachada: la base debe impedir cambiar los renglones de una entrega despachada (trigger de validación o un diseño que lo garantice), no solo el servicio.
5. **Auditoría:** `epi_entrega_item` y `epi_elemento` no tienen `created_*/updated_*`; agréguelos o justifique.
6. **Datos personales:** `GRANT SELECT (cedula, cargo)` sobre `identidad.usuario_perfil`: justifique en un comentario por qué QHSE necesita la cédula (el formato de entrega la imprime) y no lea más columnas.
7. **`epi_entrega.numero` autonumérico:** confirme que el número es el consecutivo del formato DYN-SGI-RE-032 y que no debe pasar por el motor de secuenciales de plataforma; anótelo.
8. **Falta construir** con el mismo estándar: los demás subdominios de QHSE (permisos de trabajo, SWA, inspecciones, eventos, IPERC, Acta de Entrega de Locación, contrato 4.11), el consumo de `operaciones.pumping.*` que ya existe, y publicar `qhse.epi.despachada|revertida` (contrato 3).
9. **Pruebas:** intentos de violar los CHECK de estado, el índice único por ticket y el REVOKE del historial, y de cambiar renglones de una entrega despachada.

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

### Correcciones de la revisión de base de datos (17/10/2026) — migración `20261017100000_epi_catalogos_integridad_y_auditoria`

| # | Hallazgo | Resolución |
|---|---|---|
| 1 | `ticket_ref` copia datos de otro contenedor | **Se conserva solo lo justificado**: `ticket_id` y `pedido_id` son ids sin FK (otro contenedor, D1; COMMENT lo dice). `ticket_numero` y `pedido_codigo` son copias justificadas (bandeja, hoja imprimible y avisos de QHSE los muestran y no se pueden obtener con JOIN), con COMMENT, mantenidas por evento: la prueba «guarda la referencia del ticket cuando Pumping lo crea y la actualiza sin duplicarla» ejercita el cambio posterior (111 → 222). |
| 2 | Texto libre en `lugar`, `talla`, `codigo` | `lugar` → `lugar_bodega_id` con FK a `catalogos.bodega` (GRANT SELECT de id, nombre y habilitado). `talla` → `talla_id` con FK a la tabla nueva `epi_talla` (enum `tipo_talla`: ropa, calzado, guante); `epi_elemento.requiere_talla` → `tipo_talla` (enum, `null` = no lleva talla) y código estable `codigo` (el comportamiento nunca depende del nombre). `codigo` del renglón **se elimina**: era un texto libre sin dueño (ver 3); la cédula sale del perfil. |
| 3 | EPI versus Inventario | Decisión **D16** en `03-DECISIONES-PENDIENTES.md`: QHSE no puede tener FK a `inventario.articulo` (otro contenedor). Avanza con su propio catálogo; el descuento de existencias, si se quiere, será por evento. Pendiente de Dynadrill. |
| 4 | Historia incompleta | `REVOKE UPDATE, DELETE` sobre `epi_entrega_historial` (explícito). Trigger `epi_entrega_item_validar`: los renglones solo se agregan, cambian o quitan mientras la entrega está solicitada o aprobada (despachada y rechazada no), y la talla debe ser del tipo del elemento. Trigger `epi_entrega_congelar`: una entrega despachada no cambia trabajador, ticket, lugar, firmas ni fechas (solo se completa el «recibe conforme» de Talento Humano; para corregir se revierte con motivo). |
| 5 | Auditoría | `epi_elemento`, `epi_talla` y `epi_entrega_item` ahora tienen `created_at/by` y `updated_at/by` (FK a `identidad.usuario`). El servicio registra el actor en cada renglón. |
| 6 | Datos personales | `GRANT SELECT (cedula, cargo)` se mantiene y se justifica en el COMMENT de `epi_entrega.trabajador_id`: el formato DYN-SGI-RE-032 imprime la cédula y el cargo del trabajador; no se lee ninguna otra columna ni se copia el dato. |
| 7 | `epi_entrega.numero` | Es el consecutivo interno visible (EPI-000001). El formato DYN-SGI-RE-032 no tiene numeración propia y no es un documento comercial, por eso **no** pasa por el motor de secuenciales de plataforma (COMMENT en la columna). |
| 8 | Falta construir | Es el resto del plan (Q2 a Q6). Lo de Q1 que decía el hallazgo (consumo de `operaciones.pumping.*` y `qhse.epi.despachada|revertida`) ya está construido y probado. |
| 9 | Pruebas | 24 pruebas de integración: CHECK de estado, índice único por ticket y trabajador, REVOKE del historial (UPDATE y DELETE), renglones de una entrega despachada o rechazada (agregar, cambiar, quitar), cabecera congelada, talla de otro tipo, elemento sin talla con talla, FK de lugar y de talla, y auditoría de renglones. |

**Estándar de calidad, punto por punto (Q1):** 1 sin duplicados salvo las dos copias justificadas · 2 ids sin FK solo entre contenedores y con COMMENT · 3 catálogos con id, código único y FK (elementos, tallas, lugar) y enums para valores fijos · 4 integridad en la base (CHECK, triggers, índice único parcial, FK) · 5 historial inmutable · 6 auditoría en toda tabla editable (el historial es solo-agregar) · 7 permisos mínimos con comentario · 8 migración nueva, sin editar la anterior; los catálogos van en la semilla · 9 servicios divididos (`EpiService` ciclo y eventos, `EpiConsultaService` lectura, `EpiRenglonesService` renglones), DTO con class-validator, mensajes con «usted», transacciones y outbox en la misma transacción, consumidor idempotente · 10 pruebas que intentan violar las reglas · 11 revisado contra esta lista.

## 14. Encargo de la sesión (18/10/2026)

**Estado:** Q1 construido (contenedor, EPI y consulta de términos). **Pumping ya espera dos cosas de QHSE** y por eso van primero.

**Orden de trabajo**
1. **Acta de Entrega de Locación y documentos por pedido (contrato 4.11):** tabla `documento_pedido` con tipo (`formato_recepcion`, `art`, `pt`, `sfi`, `formato_entrega`), `archivo_id` (FK a `archivos.archivo`), vigencia; el Supervisor sube el Acta al finalizar el ticket (una por pedido). **Publique `qhse.acta_entrega.cargada` y `qhse.acta_entrega.anulada`** (con `ticketId` y `pedidoId`): son los nombres que el consumidor de Pumping ya tiene (si el contrato dice otro, corrija el contrato, no el consumidor). Cree el módulo de archivos correspondiente (`libs/plataforma/archivos/src/catalog/sembrar-modulos.ts`, una fila) y avise en el registro: la sesión principal agrega el botón de subida en el ticket nuevo de Pumping (`tickets-nuevos`), o le da permiso para un componente suyo. Hoy el Acta se confirma con el puente temporal.
2. **PTW (Q3), en lo que Pumping necesita:** `qhse.ptw.abierto|firmado|cerrado` con `ticketId`/`pedidoId` (un PTW por día de operación), y la decisión D10 sobre SWA como bloqueo.
3. **Q2 (SWA, STOP, inspecciones de campo, «Reportar»):** una inspección de vehículo-grúa rechazada origina un reporte de unidad para Mantenimiento. Mantenimiento ya recibe reportes de origen QHSE en su modelo (`novedad_qhse` y `qhse_referencia_id`, sin FK por D1) pero **falta el evento**: defínalo (`qhse.reporte_unidad.generado` con `casoId`, `unidadId` y el texto de la novedad) en el contrato 4.6 y avise; la sesión principal agrega el consumidor.
4. **Q4 a Q6** según el plan (ambiental, emergencias e investigación, legal y metas). Los KPI del dashboard HSE salen de `reporting` (otra sesión): usted publica eventos estables con ids.
5. **Frontend:** cada tramo con su pantalla en `features/qhse` contra `/api/v2/qhse`, con el patrón adaptador; verificar `ng build` y `ng test`.
6. **Firmas «de una línea»:** hasta que exista la plataforma de Firmas (otra sesión, A2) guarde las suyas en su propia tabla y migre después (D6).

**Entregables por tramo:** migración, semilla, pruebas (con reglas de la base), pantalla verificada, plan, registro y `scripts/commit-modulo.ps1 -Modulo qhse`. Regla nueva: sección 9 de `01-REGLAS-DE-COORDINACION.md`.
