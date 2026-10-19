# Plan de integración final (lo trabaja la sesión principal)

> Creado el 19/10/2026. **Es el plan de trabajo de la sesión principal**: unir lo que hicieron las sesiones de Flota, QHSE y FCR con lo ya construido (Comercial, Pumping, Inventario, Mantenimiento), cerrar las conexiones entre módulos que faltan y preparar el Corte de la demo. Está escrito para retomarlo sin contexto previo: lea primero la sección 0 y siga el orden de las fases. Marque cada tarea con `[x]` al terminarla y anote la fecha y el commit.

## 0. Contexto mínimo (lea esto primero)

- **Idioma y trato:** español neutro, siempre "usted", nunca voseo. Nada de nombres de personas en catálogos ni eventos.
- **Repos:** backend `C:\Users\Digitec\Documents\proyectos\dynadrill-platform` (rama integradora `desarrollo`, remoto `origin`); frontend `C:\Users\Digitec\Documents\proyectos\dynadrill\dynadrill-frontend-platform` (rama `feat/integracion-backend-platform`, remoto de respaldo **`respaldo`**; su `origin` es el DEMO: **nunca empujar allí**); documentación `C:\Users\Digitec\Documents\proyectos\documentacion` (rama `main`, la confirma esta sesión). Nada va a `main` de la demo (`dynadrill-backend`/`dynadrill-frontend` de DIGITEC-IT-PROJECTS; sus carpetas locales son de solo lectura).
- **Ramas de las otras sesiones (backend y frontend):** `modulo/fcr`, `modulo/flota`, `modulo/qhse` (más `modulo/inventario`, `modulo/mantenimiento`, `modulo/integracion-operaciones`, ya al día con `desarrollo`). Ellas commitean con `scripts/commit-modulo.ps1` (índice temporal, sin tocar el árbol compartido). **Esta sesión** commitea con `scripts/commit-modulo.ps1 -Modulo principal -EnRamaActual -Mensaje "..." -Rutas @('ruta1','ruta2')` desde la herramienta **PowerShell** (desde bash el arreglo `-Rutas a,b` llega como una sola cadena y no commitea). En el frontend agregue `-Remoto respaldo`. Mensajes de commit: asunto en minúscula, cuerpo ≤100 caracteres por línea.
- **Prohibido:** `git add -A`, commit directo, `checkout`, `stash`, `reset`, `prettier --write`/`eslint --fix` fuera de las rutas propias, `infra:reset`, borrar datos reales, imprimir secretos/`.env`. Correos de prueba solo a `gustavo_morales@digitec.com.ec`. Cuentas de empleados desde AS2: clave iniciales+123*, inactivas hasta entregar.
- **Reglas de arquitectura que no se rompen:** BD normalizada (FK reales, catálogos con id, sin JSON ni texto suelto, auditoría, historia inmutable); **sin FK entre contenedores** (ids con COMMENT; solo se copia el texto imprescindible y se justifica); sin transacciones compartidas entre módulos (el dueño ofrece métodos con transacción propia e idempotentes y el llamador compensa); eventos con prefijo del contenedor productor; cola `<consumidor>.<origen>[.<grupo>]` (dos consumidores del mismo origen en un contenedor necesitan `group` distinto); tras crear un consumidor hay que reiniciar el contenedor; migraciones aplicadas no se editan (`ALTER TYPE ADD VALUE` va en migración aparte); no abrir permisos de un módulo ajeno (endpoint estrecho).
- **Windows:** heredocs bash con comillas fallan → herramienta Write + scripts Node; PS 5.1 exige BOM en `.ps1` y `$ErrorActionPreference='Continue'`; sed con `\n` rompe → Node.
- **Ejecución:** contenedores/puertos: gateway 3100, plataforma 3101, comercial 3102, operaciones 3103, qhse 3104, frontend 4200. Reinicio: `npx nx build <app>` y `Start-Process node dist/apps/<app>/main.js` (parar el proceso viejo con `Get-CimInstance Win32_Process`). Docker: `docker start dynadrill-rabbitmq-1 dynadrill-mailpit-1 dynadrill-azurite-1 dynadrill-jaeger-1`. Pruebas de integración: `RUN_INTEGRATION=1 npx nx test <lib> --skip-nx-cache` (sin esa variable se saltan). Seeds: `npm run db:seed:identidad` (permisos), `db:seed:avisos`, `db:seed:<modulo>`, y el de archivos (`sembrar-modulos.ts`) cuando se agregan módulos de archivo.
- **Documentos de referencia:** `02-CONTRATOS-ENTRE-MODULOS.md` (qué evento/endpoint une cada par de módulos), `03-DECISIONES-PENDIENTES.md`, `REGISTRO-DE-CAMBIOS-COMPARTIDOS.md`, `01-REGLAS-DE-COORDINACION.md`, `PROMPTS-DE-SESIONES.md`, un `plan-<modulo>.md` por módulo (sección «Avance de la sesión»), `plan-corte-de-la-demo.md`, `ESTADO-SESION-PRINCIPAL.md` (historia de esta sesión). Transcripción completa de la sesión anterior: `C:\Users\Digitec\.claude\projects\C--Users-Digitec-Documents-proyectos\9dcfd063-5a28-4797-8322-21a4126fe2b0.jsonl`.

## 1. Estado al 19/10/2026 (foto)

**`desarrollo`** (commit `bd39501`) tiene: Plataforma/Comercial/Archivos/Avisos/Identidad, Inventario (con carga de AS2), Pumping (flujo completo; requisitos de otros módulos con puente temporal), Mantenimiento (M1–M3 y avisos; faltan KPI/hojas), y `GET pumping/tickets/mis-viajes` (permiso `pumping.tickets.contexto_conductor`, **constante y definición en `permissions.ts` del árbol de trabajo, aún sin commitear**: viene en el trabajo de las otras sesiones; si al fusionar falta, agréguelo: `nuevo('pumping.tickets.contexto_conductor', ..., [SUPERADMIN, JEFE_BASE, OPERADOR, CONDUCTOR])` y `PUMPING_CONTEXTO_CONDUCTOR`).

**Ramas por fusionar (backend)**, ya con muchos commits:
- `modulo/fcr`: F1–F5 (ticket, pasos con dos entradas, configuración por cliente y código, herramientas, inspección, documentos, aprobación, reunión operativa, bitácora, retorno de herramientas, reporte de unidad de llegada y cierre). Publica `operaciones.fcr.*` (ver contratos y registro). Incluye `plantillas/fcr.ts`.
- `modulo/flota`: conductores y documentos, inspección de vehículos (caso por ticket, consume `asignacion_realizada`), gerenciamiento de viaje (cuestionario de riesgo, autorización por nivel, medio autorizado por el supervisor, unidades de transporte para el conductor), avisos de viaje e inspección rechazada.
- `modulo/qhse`: acta de entrega y documentos por pedido, PTW por día y pedido con suplencia, matriz IPERC maestra (el PTW la exige), Stop Work Authority con bloqueo del ticket, tarjeta STOP, inspecciones de campo y `qhse.reporte_unidad.generado`.
- **Prueba de fusión en seco (git merge-tree, 19/10):** hay conflictos solo en archivos «de lista» (aditivos): `libs/plataforma/avisos/src/consumers/eventos-con-aviso.consumer.ts` (en las tres), `libs/plataforma/avisos/src/catalog/plantillas/index.ts` (flota), `libs/plataforma/archivos/src/catalog/sembrar-modulos.ts` (qhse), `libs/qhse/seguridad/prisma/seed.ts` y `qhse.module.ts` (qhse), y `libs/shared/authz/src/lib/permissions.ts` (entre ramas). Se resuelven conservando ambos lados. Revise además `package.json`, `tsconfig.base.json` y `apps/operaciones/src/app/app.module.ts` (módulos nuevos).

**Frontend:** `modulo/fcr` (pantallas de tickets FCR), `modulo/flota` (inspección de vehículos, conductores, portal del conductor, bandeja de autorización, hojas imprimibles 068 y 049, pestañas de mantenimiento sobre Flota), `modulo/qhse` (documentos por pedido, acta, PTW, SWA, IPERC maestra, STOP e inspecciones). El árbol del frontend tiene además cambios sin commitear en `features/maintenance` (otra sesión) y `features/flota`.

**Conexiones entre módulos que YA existen en código** (verificadas por búsqueda en las ramas): Comercial→Pumping/FCR (`pedido.abierto`); Pumping→Comercial (reporte diario, cambio de ítems, prefactura al cerrar con `ticket-cerrado.consumer`); FCR→Comercial (bitácora y reporte de herramientas); Pumping/FCR→Mantenimiento (`reporte_unidad_llegada` de Pumping); QHSE→Pumping/FCR (EPI, acta de entrega); Flota→Pumping (eventos de inspección y gerenciamiento, consumidor `REGLAS_EXTERNAS`); Pumping/FCR→QHSE/Flota (`asignacion_realizada`); Inventario ↔ Pumping/Mantenimiento (químicos y repuestos); Mantenimiento→Flota (lecturas, preventivos).

## 2. Hoja de ruta (en este orden)

### Fase A — Fusionar el backend (una rama a la vez)

Antes de empezar: pida a cada sesión que **commitee todo** (el árbol compartido tenía ~109 archivos sin commit el 19/10) y no toque el árbol mientras se fusiona. Haga la fusión en el árbol principal **solo si `git status` está limpio**; si no, use un worktree aparte (`git worktree add ..\dynadrill-platform-merge desarrollo`, enlazando `node_modules`) para la verificación y fusione de verdad cuando el árbol quede limpio.

Orden: **1) `modulo/fcr` → 2) `modulo/qhse` → 3) `modulo/flota`** (FCR es la más cerrada y trae `plantillas/fcr.ts`, que `desarrollo` ya importa; Flota al final porque consume eventos de los otros dos).

Por cada rama:
- [ ] `git merge --no-ff modulo/<x>` en `desarrollo` y resolver los conflictos de archivos de lista conservando ambos lados (consumer de avisos, `plantillas/index.ts`, `sembrar-modulos.ts`, `seed.ts`, `permissions.ts`, módulos de Nest).
- [ ] Verificar: `npx nx run-many -t lint,build` sobre los proyectos afectados y `RUN_INTEGRATION=1 npx nx test` de: la librería de la rama, `pumping`, `pedidos`, `mantenimiento`, `inventario`, `avisos`, `authz`, `identidad`. Bloqueo de verificación pesada: `documentacion\modulos\.bloqueos\nx.lock`.
- [ ] Aplicar migraciones (`prisma migrate deploy` por módulo, con el migrador directo 5433) y correr los seeds: `db:seed:identidad`, `db:seed:avisos`, `db:seed:<modulo>`, archivos.
- [ ] Reconstruir y reiniciar los contenedores afectados (plataforma, operaciones, qhse, comercial, gateway) y comprobar que levantan sin errores en el registro.
- [ ] Commit de la fusión y `git push origin desarrollo`. Anotar en `REGISTRO-DE-CAMBIOS-COMPARTIDOS.md`.

### Fase B — Conexiones de backend que faltan (cada una con prueba de integración)

| # | Conexión | Qué falta | Dónde / cómo |
|---|---|---|---|
| B1 | **SWA bloquea el ticket** (D10, contrato 4.5) | Pumping y FCR no consumen `qhse.swa.*`. Hay que modelar un requisito del ticket `swa_sin_activar` que se **reabre** con `qhse.swa.activado` y se **cumple** con `qhse.swa.cerrado` solo si `sinSwaActivas = true`; define cuál paso bloquea (la demo solo bloquea el frontend al firmar reportes). Confirmar el paso con la regla de la demo antes de fijarlo. | `libs/operaciones/pumping/src/consumers/requisitos-externos.consumer.ts` (mapa `REGLAS_EXTERNAS` + catálogo `sembrar-traslado-salida.ts`) y el equivalente de FCR. |
| B2 | **PTW → ejecución** (contrato 4.5) | Pumping/FCR no consumen `qhse.ptw.abierto|firmado|cerrado|anulado`. Decidir qué paso exige PTW cerrado del día (hoy solo existe el checklist de ingreso a locación) y modelarlo como requisito por día (el PTW es uno por pedido y día; `anulado` vuelve a exigirlo). **Leer antes** `documentacion/PLAN-QHSE-PUMPING-NOTIFICACIONES.md` y la respuesta de Dynadrill (`03-DECISIONES-PENDIENTES.md`, respuestas del 18/10). Si queda duda, consultar al usuario antes de construir. | Igual que B1. Aviso al supervisor con `asignados` (ya lo trae `qhse.ptw.cerrado`). |
| B3 | **QHSE → Mantenimiento** (contrato 4.6-bis) | Falta el consumidor de `qhse.reporte_unidad.generado`: suscripción única a `source: 'qhse'` (cola `mantenimiento.qhse`, ojo con `group`), idempotente por `casoId`, que crea `reporte_recibido` con origen `qhse` (`qhse_referencia_id` = `casoId`, `novedad_qhse` = `novedad`); si el `unidadId` no existe, registrar y omitir. | `libs/operaciones/mantenimiento/src/consumers/` + `ReportesService`; el enum `OrigenReporte` ya tiene `qhse`. Prueba: evento con y sin unidad, y repetido. |
| B4 | **FCR → Mantenimiento** (contrato 4.2) | Mantenimiento solo consume `operaciones.pumping.reporte_unidad_llegada` (FK a `pumping.reporte_unidad`). FCR publica `operaciones.fcr.reporte_unidad_llegada` con su propia tabla `fcr.reporte_unidad_llegada`. Hay que agregar a `reporte_recibido` una columna `fcr_reporte_unidad_llegada_id` (único, FK real porque es el mismo contenedor), el espejo de solo lectura en el schema de Mantenimiento, el consumidor del evento de FCR y el CHECK de que cada reporte tiene exactamente un origen. Origen `fcr` ya existe en el enum. | Migración nueva en `libs/operaciones/mantenimiento/prisma/migrations` + `reportes.service.ts` (`recibirDeFcr`). Verificar la forma exacta del evento de FCR en `modulo/fcr`. |
| B5 | **Pumping ↔ Flota (extremo a extremo)** | Probar con los eventos reales de Flota: `asignacion_realizada` abre el caso de inspección por unidad → `inspeccion_vehiculo.realizada/aprobada/rechazada` cumple/reabre requisitos → `gerenciamiento_viaje.aprobado/rechazado` (`tipo` salida/retorno) cumple/reabre. Flota publica además `decidido`, `por_autorizar_*` (solo avisos). Confirmar nombres y campos (`ticketId`, `vehiculoId`, `tipo`). Quitar el puente temporal de esos requisitos del flujo normal (el puente queda de emergencia). | Prueba de integración transversal en `libs/operaciones/flota` o `pumping` que levante ambos módulos (ver cómo lo hace `mantenimiento.integration.spec.ts`). |
| B6 | **Flota consume `mis-viajes`** | El portal del Conductor debe autocompletar con `GET /api/operaciones/pumping/tickets/mis-viajes` (contrato escrito en `plan-pumping-restante.md`; el origen del viaje es catálogo de Flota/Catálogos, no viene de Pumping). Verificar que el frontend de Flota lo llame y que los roles tengan el permiso (seed de identidad). | Solo verificación y ajuste; construye Flota. |
| B7 | **Inventario ↔ FCR** | Las herramientas de FCR (cantidades, uso, retorno) deben enlazarse a Inventario: migración de Inventario con `movimiento.ticket_fcr_id` y `consumo_ticket.ticket_fcr_id` (FK a `fcr.ticket`) y métodos con transacción propia como en el contrato 4.1. **Verificar** si FCR ya mueve stock o solo registra; hoy solo se encontró `DespachosConsumer` en pruebas. Si FCR no mueve stock todavía, definir con el usuario si la herramienta sale del kardex (probablemente sí, con `registrarSalidasDeTicket`-equivalente). | `libs/operaciones/inventario` + `libs/operaciones/fcr/src/services/herramientas.service.ts`. |
| B8 | **QHSE ↔ FCR/Pumping: EPI y términos** | Confirmar que QHSE abre las solicitudes de EPI también con `operaciones.fcr.asignacion_realizada` (la rama lo consume) y que `qhse.epi.despachada` cumple el requisito en FCR (el consumidor de FCR de EPI: verificar que exista). **Contrato 4.12 (propuesto):** Pumping expone `GET /api/operaciones/pumping/terminos/aceptaciones?cedula=&nombre=` (permiso `pumping.terminos.historial`) para la pantalla de QHSE; hacerlo. | Pumping (nuevo endpoint) + QHSE (pantalla, la tiene su sesión). |
| B9 | **Avisos y permisos tras las fusiones** | Quedan suscripciones y plantillas de Mantenimiento, FCR, QHSE y Flota en el mismo consumer/`index.ts`: revisar que no haya duplicados, correr `db:seed:avisos` y la suite de avisos (debe seguir en verde con las plantillas de los cuatro módulos). Revisar la matriz de permisos/roles de `permissions.ts` (sin duplicados, `pumping.tickets.contexto_conductor` presente) y que el catálogo de identidad cuente los permisos esperados. | `libs/plataforma/avisos`, `libs/shared/authz`. |
| B10 | **Comercial: ajustes D15 y cierre** | Confirmar con las ramas fusionadas: prefactura al cerrar desde Pumping **y** FCR (`ticket-cerrado.consumer`), firma del Company Man desde el ticket, corrección de Facturación que bloquea el día en Pumping y FCR (`comercial.documento_operativo.corregido`), cambio de ítems. Revisar `plan-comercial-ajustes.md` y lo que siga pendiente. | `libs/comercial/pedidos`. |
| B11 | **Gateway y rutas** | Verificar que `/api/operaciones/{pumping,fcr,flota,mantenimiento,inventario}`, `/api/v2/qhse` y `/api/comercial` pasan por el gateway (3100) y que lo no migrado sigue cayendo en demo-legacy. No se encontró configuración de FCR/Flota en `apps/gateway` por búsqueda de texto: **comprobarlo con un `curl` autenticado** (podría resolverse por prefijo genérico). | `apps/gateway`, `apps/api-gateway`. |
| B12 | **Pendientes propios de Mantenimiento (M4)** | KPI y hojas imprimibles (informe DYN-MNT-RE-008, orden general y operativa) leyendo datos del backend nuevo; las lecturas desde el reporte de llegada y las fórmulas de MAN-MASTER-001 están **sin confirmar con Dynadrill** (consultar, no inventar: `documentacion/mantenimiento/CONSULTAS-PARA-DYNADRILL.md`). | `libs/operaciones/mantenimiento`, frontend `features/maintenance`. |

### Fase C — Fusionar y conectar el frontend

- [ ] Fusionar en la rama `feat/integracion-backend-platform` del frontend: `modulo/fcr`, `modulo/qhse`, `modulo/flota` (mismo orden). Conflictos esperados: `layout/navigation/*` (menú) y rutas. **Respaldo solo a `respaldo`.** Antes: que cada sesión commitee; el árbol tiene cambios sin commit en `features/maintenance`, `features/flota`, `features/operations/fcr` y `features/qhse/swa-plataforma`.
- [ ] Verificar por rama fusionada: `npx ng build` (o `nx build`), `ng test` (base: 384 pruebas pasaban), lint.
- [ ] **Incrustar `app-acta-entrega-carga`** (QHSE, `features/qhse/documentos-pedido/components/acta-entrega-carga.ts`, entrada `ticketId`, salida `cambio`) en el detalle del ticket nuevo de Pumping (`features/operations/pumping/tickets-nuevos`) y en el de FCR; retirar el puente temporal para ese requisito.
- [ ] Mostrar en el ticket de Pumping/FCR los requisitos nuevos de B1/B2 (SWA activa, PTW del día, ART vencido) con el motivo del bloqueo.
- [ ] Mantenimiento: `historial-dialog` debe usar `GET mantenimiento/unidades/:unidadId/historial` (lo hace la sesión de Flota; verificarlo tras fusionar); la tarjeta de mantenimiento del ticket y las pestañas sobre Flota deben coexistir sin duplicar servicios.
- [ ] El portal del Conductor (Flota) usa `mis-viajes`; revisar el origen del viaje (catálogo).
- [ ] Un solo `mensajeDeError`, un solo patrón de adaptador (servicio nuevo + mapper puro + spec), ids UUID string; retirar del frontend los servicios de la demo que ya no se usen.

### Fase D — Probar de punta a punta en el navegador

Con los contenedores arriba (`levantar-local`) y el frontend en 4200. Cuentas de prueba (no las reales: siguen inactivas). Recorrer **un servicio completo** y anotar cada tropiezo en un archivo `documentacion/modulos/PRUEBA-DE-PUNTA-A-PUNTA.md`:
1. Comercial abre un pedido → se crea el ticket de Pumping (y otro de FCR) y se avisa al Jefe de Base.
2. Jefe de Base asigna supervisor, operadores, unidades y químicos → QHSE abre EPI; Flota abre el caso de inspección; el Conductor solicita gerenciamiento de viaje (`mis-viajes`) y se autoriza.
3. EPI despachado, inspección aprobada, términos aceptados, reporte de salida → revisión de salida del Supervisor.
4. PTW (IPERC aprobada → ART → PTW) y SWA (activar/cerrar) bloquean y liberan.
5. Ejecución, reporte diario → Comercial recibe el documento; cambio de ítems; monitoreo.
6. Retorno, reporte de llegada con novedades → Mantenimiento recibe, clasifica, ejecuta con repuestos (salida de bodega), retorna la unidad.
7. Acta de entrega → cierre → prefactura y firma del Company Man.
8. Repetir lo esencial en FCR (herramientas, inspección, bitácora, retorno, cierre).

### Fase E — Corte de la demo

Siga `plan-corte-de-la-demo.md`: módulo por módulo, el gateway deja de caer en demo-legacy; decisión D11 (¿se migran datos reales o se arranca vacío?) pendiente del usuario; sin tocar `main` de la demo. Antes: auditoría de lo no cubierto contra `04-REVISION-CONTRA-DEMO-MAIN.md`.

### Fase F — Lo que no tiene dueño

- **Auditoría y Firmas** (`plan-firmas-y-auditoria.md`) y **Reportería y Dashboard** (`plan-reporting-dashboard.md`) no tienen sesión. Si el usuario no lanza sesiones nuevas (prompts listos en `PROMPTS-DE-SESIONES.md`), se hacen aquí **después** de las fases A–D, empezando por Auditoría (proyecta los eventos ya publicados) y Firmas.

### Fase G — Cierre documental

- [ ] Actualizar `02-CONTRATOS` (estado de 4.2, 4.5, 4.6-bis, 4.10, 4.12 y los eventos de la sección 3), `REGISTRO-DE-CAMBIOS-COMPARTIDOS.md`, `ESTADO-SESION-PRINCIPAL.md`, `plan-mantenimiento.md`, `plan-pumping-restante.md`, `01-REGLAS` (mencionar `-EnRamaActual`), `README`.
- [ ] Commit de documentación (repo `documentacion`, `main`, `origin`) y subir.

## 3. Criterios de «terminado» de cada fase

- **A:** `desarrollo` contiene las tres ramas; build y lint verdes; todas las pruebas de integración verdes; migraciones y seeds aplicados; contenedores reiniciados y sanos; empujado a `origin`.
- **B:** cada fila con su prueba de integración que intenta romper la regla (no solo el camino feliz) y su entrada en el registro de cambios.
- **C:** frontend con build/pruebas verdes y empujado a `respaldo`; sin servicios de la demo huérfanos.
- **D:** el servicio completo corre en el navegador sin puente temporal (salvo los requisitos explícitamente pendientes) y el archivo de prueba lista lo que falló y lo corregido.

## 4. Riesgos y decisiones abiertas

- Árbol de trabajo compartido con cambios sin commit de varias sesiones: no fusionar hasta que estén commiteados (o usar worktree).
- `permissions.ts` lo tocan las tres ramas: conflictos de lista; revisar duplicados de claves y la cuenta total de permisos tras fusionar.
- B1/B2 (SWA y PTW): confirmar el paso que bloquea antes de construir; D6/D9/D11/D13 siguen pendientes del usuario (ver `03-DECISIONES-PENDIENTES.md`).
- B7 (FCR e Inventario): puede requerir decisión del usuario sobre si la herramienta mueve el kardex.
- Fórmulas de KPI y lecturas de Mantenimiento: sin confirmar con Dynadrill.

## 5. Bitácora de esta fase

_(agregar una línea por tarea terminada: fecha · tarea · commit · pruebas)_
