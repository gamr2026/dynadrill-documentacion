# Plan de cierre del frontend (migración de pantallas y paridad con la demo)

Fecha: 27/10/2026. Estado al escribirlo: el backend nuevo cubre todo lo que la demo hacía, salvo lo marcado en la sección 6; el frontend nuevo **ya
tiene todas las rutas de la demo**, pero **20 páginas con ruta siguen hablando con la API vieja** (la de la demo) y varias pantallas nuevas del
backend aún no tienen su interfaz. Este documento dice qué falta, en qué orden y cómo trabajarlo sin perder la fidelidad con la demo. Se escribió
para que otra sesión lo continúe sin haber vivido esta.

## 0. Qué leer antes de empezar (en este orden)

1. `modulos/README.md` y `modulos/00-CONTEXTO-COMPARTIDO.md`: cómo está construido todo y las reglas que no se negocian.
2. `modulos/01-REGLAS-DE-COORDINACION.md` y `modulos/REGISTRO-DE-CAMBIOS-COMPARTIDOS.md`: qué archivos son compartidos y qué cambió en los últimos días (las
   entradas del 27/10/2026 son las más recientes).
3. `modulos/02-CONTRATOS-ENTRE-MODULOS.md`: eventos y rutas entre módulos (§4.14 es el de Firmas).
4. `modulos/PARIDAD-MODELO-DEMO.md`: cada campo y cada regla de la demo y dónde vive en la base nueva.
5. `modulos/PLAN-CIERRE-MODELADO.md`: lo hecho en el backend y la base (lista marcada con `[x]`); es la fuente de cuándo y con qué commit.
6. `modulos/FRONTEND-PARIDAD-VISUAL.md`: inventario de rutas, resultado de la comparación contra la demo y el método (esta sesión lo afinó; ver §2).
7. `modulos/plan-corte-de-la-demo.md`: cómo se retira cada prefijo viejo del gateway (la **Fase D** de abajo).
8. `modulos/AUDITORIA-BD-2026-10-26.md`: lo que se revisó y corrigió en la base y lo que quedó pendiente.
9. `herramientas-frontend/LEEME.md`: los scripts de comparación y de inventario.
10. Memoria de la sesión (si la tiene): registro en español neutro con «usted» y sin voseo; modelado de base normalizado (catálogos con id y FK);
    el script `commit-modulo` solo se pasa con rutas propias; la base local está limpia (sin datos de prueba) y las pruebas de integración corren
    contra `dynadrill_test`, no contra la de desarrollo.

## 1. Dónde está el trabajo

| Qué | Dónde | Rama |
|---|---|---|
| Backend (Nx, Nest, Prisma) | `proyectos/dynadrill-platform-int` (worktree) → remoto `origin` = `gamr2026/dynadrill-platform` | `modelado/auditoria`; `desarrollo` se mantiene igual (avance rápido) |
| Frontend nuevo (Angular 21) | `proyectos/dynadrill/dynadrill-frontend-int` (worktree) → remoto `respaldo` = `gamr2026/dynadrill-frontend-platform` | `diseno/facturacion-demo` |
| Demo (solo lectura) | remoto `origin` del frontend = `DIGITEC-IT-PROJECTS/dynadrill-frontend`, rama `main` | — |
| Documentación | `proyectos/documentacion` → `gamr2026/dynadrill-documentacion` | `main` |
| Base y servicios locales | `infra/docker-compose.yml` (Postgres 5433, PgBouncer 6432, RabbitMQ), servicios `dist/apps/<app>/main.js`: plataforma 3101, comercial 3102, operaciones 3103, qhse 3104, gateway 3100; frontend `ng serve` en 4200 (proxy al gateway) |

Rutas del gateway: `/api/v2/qhse` → contenedor `qhse` (el prefijo se reescribe); `/api/v2/catalogos` → plataforma; `/api/comercial`, `/api/operaciones`
→ sus contenedores; **`/api/qhse`, `/api/operations`, `/api/facturacion`, `/api/unidades`, `/api/articulos`... sin dueño nuevo caen en la demo (puerto
3300, apagada)**: toda pantalla que los llame falla con 502 en el entorno actual, y es justo lo que este plan migra.

Comandos útiles (desde la raíz del backend): `npx nx build <app>` y reiniciar el servicio (`node dist/apps/<app>/main.js`); `npm run db:test:preparar`
(copia la base de desarrollo a `dynadrill_test`, repetir tras cada migración); pruebas con `RUN_INTEGRATION=1 npx jest --testPathPatterns=<patrón>` dentro de la
librería (solo corren contra `dynadrill_test`); migraciones con `DATABASE_URL_MIGRATOR=postgresql://dyn_migrator:dev_dyn_migrator@localhost:5433/dynadrill?schema=<schema> npx prisma migrate deploy`
dentro de la librería; semillas `npm run db:seed:<modulo>` (tras cambiar el catálogo de permisos corra `db:seed:identidad`; tras el de Firmas, `db:seed:firmas`).
En el frontend: `npx ng build --configuration development` y `npx ng test --watch=false`.

La clave del superadmin de desarrollo no está en los archivos de configuración (la define `SEED_ADMIN_PASSWORD` al sembrar). Para probar en el navegador
hay que iniciar sesión; si la sesión vence, Playwright vuelve al login.

## 2. Método para que cada pantalla quede fiel a la demo

Es el método que dio resultado (de 314 plantillas y hojas de estilo, solo 46 difieren de verdad de la demo). **No se rediseña: se toma el código de la
demo y se cambia solo cómo se obtienen y se muestran los datos.**

1. **Sacar la demo** a una carpeta aparte (`git archive origin/main`, ver `herramientas-frontend/LEEME.md`).
2. **Comparar** la pantalla: `difsem.py` lista los archivos que difieren y `difver.py <ruta>` muestra el diff legible. Los archivos idénticos tras
   normalizar no se tocan.
3. **Partir de la plantilla y los estilos de la demo.** Si la página nueva difiere por razones propias (otro modelo de datos), copie el `.html` y el
   `.scss` de la demo y adapte únicamente los **campos** (ids numéricos → UUID, nombres anidados, estados nuevos, permisos). No se inventan clases,
   textos ni espaciados: se copian de la demo.
4. **Adaptar el servicio y el modelo** al backend nuevo (rutas `/api/v2/qhse/...`, `/api/comercial/...`, `/api/operaciones/...`; ids `string`).
   Lo que el backend nuevo no trae (campos que la demo tenía y se normalizaron o se descartaron) se anota en la sección 6 o en `PARIDAD-MODELO-DEMO.md`;
   no se inventan datos en el cliente.
5. **Compilar y probar:** `npx ng build --configuration development` y `npx ng test --watch=false` (hoy 519 pruebas). Si cambia lógica pura (validaciones,
   mapeos), agregue pruebas unitarias en el `.spec.ts` de su modelo.
6. **Verificar en el navegador con Playwright**, siempre en **dos tamaños** y **con datos reales de la base de desarrollo** (sección 5):
   - Escritorio 1440 × 900 y móvil 390 × 844 (`browser_resize`).
   - Llamadas **una por una** (navegar → esperar → capturar): en paralelo la captura sale en blanco.
   - La captura se guarda sola en `.playwright-mcp/`; la que sirve de evidencia se copia a `documentacion/capturas-frontend/<modulo>/<pantalla>-<escritorio|movil>.png`
     (crear la carpeta si no existe). Anotar en el plan qué captura corresponde a qué pantalla.
   - Revisar: sin scroll horizontal de página en móvil (las tablas se desplazan dentro de su contenedor), encabezado móvil con menú «⋮», acciones principales
     visibles, diálogos a pantalla completa o en hoja inferior como en la demo, y la consola sin errores 4xx/5xx propios de la pantalla (ignorar el 401 de
     `/api/avisos` si la sesión es corta).
   - Para la comparación **lado a lado** con la demo: levantar la demo (frontend de `origin/main` más su backend `dynadrill-backend`, puerto 3300) o abrir la
     desplegada en `dynadrill.digitec.com.ec`. En esta sesión no se levantó; el diff de código hizo de comparación. Si se levanta, capturar la misma pantalla
     en ambos y guardar las dos.
7. **Commit** pequeño por pantalla (mensaje en español: qué pantalla y contra qué backend), empujar a `respaldo diseno/facturacion-demo` y actualizar la
   fila de la pantalla en `FRONTEND-PARIDAD-VISUAL.md` y la tabla de la sección 3 de este plan.

Reglas que se aprendieron: no reconstruir la pantalla «a ojo»; si algo del diseño depende de un componente compartido (`app-page-header`, `dynadrill-*`,
`useDetailChrome` para la barra móvil), reutilícelo y no lo copie; no cambiar textos de la demo salvo para cumplir el registro «usted» (sin voseo); los
botones se muestran según permiso del token (`permissionGuard` y `auth.can(...)`), no según el nombre del rol; los permisos nuevos viven en
`libs/shared/authz`.

## 3. Inventario de lo que falta migrar (páginas con ruta que aún llaman a la API vieja)

Se obtuvo con `herramientas-frontend/paginas.py` el 27/10/2026. Cada fila: la ruta, qué servicio viejo usa, cuál es la pantalla o endpoint nuevo equivalente
y qué hacer. **Vuelva a correr los scripts al empezar y al terminar** para confirmar que la lista baja.

### 3.1 Facturación (ya tiene pantallas nuevas; lo viejo se retira)

| Ruta | Servicio viejo | Equivalente nuevo | Qué hacer |
|---|---|---|---|
| `/dashboard/facturacion/pedidos-demo` y `/:id` | `pedido.service`, `articulos.service`, `operativo-docs-bridge`, `entrega-epi`, `fcr*`, `movimientos-inventario` | `pedidos` y `pedidos/:id` (comercial) | Verificar que ninguna pantalla nueva enlace a `pedidos-demo` (hoy lo hacen `aot-detail-page`, `prefactura-detail-page` y `pedidos-list-page`, todas de la demo). Retirar las rutas y las páginas de la demo. |
| `/dashboard/facturacion/aots/:id` | `pedido.service` | `pedidos/:id/orden-trabajo` | La AOT de la demo se reemplazó por la orden de trabajo. Retirar la ruta y la página tras confirmar el reemplazo. |

### 3.2 Pumping y FCR (tickets)

| Ruta | Servicio viejo | Equivalente nuevo | Qué hacer |
|---|---|---|---|
| `/modulos/operativo/pumping` (raíz, bandeja demo) | `pumping.service` | `pumping/pedidos` | Hacer que la raíz redirija a `pedidos` (la bandeja nueva) y comprobar el menú (`navigation.service.ts` aún enlaza «Pumping» a la raíz). Mover al Conductor a su portal nuevo (`mis-viajes` del backend). |
| `/modulos/operativo/pumping/:id` | `pumping.service`, `solicitud-cambio-items`, `terminos-pumping`, `entrega-epi`, `movimientos-inventario`… | `pumping/pedidos/:id` | El detalle nuevo ya existe. Retirar el viejo; Mantenimiento entra al detalle nuevo para leer la tarjeta «Mantenimientos» (ver §6 de roles). |
| `/modulos/operativo/pumping/aprobaciones` | `solicitud-cambio-items` | `pumping/pedidos/aprobaciones` | Retirar. |
| `/modulos/operativo/fcr` y `/:id` | `fcr.service`, `fcr-tool-inspecciones`, `ticket-prefactura`, `pedido.service` | `fcr/pedidos` y `fcr/pedidos/:id` | Igual que Pumping. |
| `/modulos/operativo/fcr/configuracion-codigos` | `fcr-configuracion-codigos` | `GET/PUT /api/operaciones/fcr/configuracion-codigos` (ya existe en el backend) | **Migrar de verdad**: es una pantalla que solo existe en versión demo. Plantilla de la demo + servicio nuevo. |
| Tarjeta de Pumping/FCR en el detalle de pedido demo | `operativo-docs-bridge`, `ticket-prefactura` | Documentos operativos y prefactura de comercial | Se retira junto con `pedidos-demo`. |

### 3.3 Mantenimiento, Flota y Conductor

| Ruta | Servicio viejo | Backend nuevo | Qué hacer |
|---|---|---|---|
| `/dashboard/mantenimiento` (bandeja `maintenance-list-page`) | `unit-reports`, `historial-mantenimiento` | `operaciones/mantenimiento` (`reportes`, `ordenes`, `subordenes`, `historial`), Flota (`unidades/:id/preventivos`) | La bandeja se reconstruye sobre el backend nuevo (las pantallas de `maintenance/reportes-nuevos` ya existen: úselas como base y alinee su diseño con la demo). Aquí van también los botones de las **hojas imprimibles** (§4.2). |
| `/dashboard/mantenimiento/mis-tareas` y `/operativo` | `unit-reports` | `subordenes` asignadas al operador (`GET subordenes/:id`, avance, enviar a revisión) | Migrar. |
| `/dashboard/mantenimiento/kpis` | `unidades`, `unit-reports` | **No hay endpoint de indicadores de Mantenimiento** (C3 del plan de modelado) | Primero el backend (`resumen` del módulo), luego la pantalla. |
| `/dashboard/mantenimiento/gerenciamiento-viaje` | — (ya usa Flota nuevo) | `flota/viajes` | Solo comparar con la demo. |
| `/dashboard/mantenimiento/mis-viajes` (Conductor) | `gerenciamiento-viaje.service` | `flota/viajes` + `pumping/mis-viajes` (contexto del conductor) | Migrar. Si se retira `gerenciamiento-viaje.service`, comprobar la barra móvil del conductor. |
| `/dashboard/inventario/vehiculos` | `unidades.service`, `historial-mantenimiento` | Flota (`unidades`, `preventivos`, `lecturas`) | Migrar; es la ficha de vehículo con su historial preventivo. |
| Catálogo viejo de unidades y vehículos (`/api/unidades`, `/api/vehicle-inspections`, `/api/conductores-permisos`) | `unidades`, `vehicle-inspections` | Flota nueva | Retirar cuando no quede página que los use. |

### 3.4 QHSE

| Ruta | Servicio viejo | Equivalente nuevo | Qué hacer |
|---|---|---|---|
| `/dashboard/qhse/eventos` (Incidentes y Emergencias) | `investigacion.service`, `swa.service` | `investigaciones-plataforma`, `swa-plataforma`, `emergencias-plataforma`, `derrames-plataforma` (`/api/v2/qhse/...`) | Reconstruir la bandeja con los servicios nuevos (lo que hace la demo: mezcla los cuatro tipos en una lista). |
| `/dashboard/qhse/swa/:id` | `swa.service`, `emergencia.service`, `pumping.service`, `fcr.service` | `swa-plataforma` | Detalle de SWA sobre el backend nuevo; la «escalación a emergencia» debe usar `emergencias-plataforma`. |
| Todas las pantallas QHSE de la demo sin ruta (`ptw`, `iperc`, `stop`, `desechos`, `derrames`, `inspecciones`, `epi`, `documentos`, `qhse-documentos`) | `ptw.service`, `iperc*`, `stop-card`, `desecho`, `derrame`, `inspeccion-equipo`, `qhse-documentos`, `articulo-partes` | ya reemplazadas | **Código muerto**: borrar carpetas y servicios cuando ninguna página enrutada los alcance (el script lo confirma). |
| Banner del shell (`layout/shell`) | `qhse-avisos-feeder.service` (`/api/qhse/avisos`) | Avisos de plataforma (`GET /api/avisos`) y avisos programados de QHSE | Retirar el alimentador; los avisos «pedido sin formato de recepción», «personal asignado sin SFI» y «PTW sin PT hoy» **aún no existen en el backend nuevo** (ver §6). |

### 3.5 Inventario

| Ruta | Estado | Qué hacer |
|---|---|---|
| `/dashboard/inventario/articulos` y `/:id`, `despachos` | **Ya usan el backend nuevo** (el script no las lista; `articulos.service` y `movimientos-inventario.service` solo se alcanzan desde las pantallas demo de Facturación, Pumping y FCR) | Solo falta la comparación visual y el móvil. Los servicios viejos se borran al retirar esas pantallas. |
| `/dashboard/inventario/vehiculos` | Usa `unidades.service` e `historial-mantenimiento` (viejos) | Migrar (ver §3.3). |

### 3.6 Otros

- Dashboard (`/dashboard`) y tablero HSE: ya leen del backend nuevo desde el 27/10/2026.
- `core/services` y `shared/services`: `operativo-docs-bridge.service`, `ticket-prefactura.service`: se retiran con las pantallas de la demo que los usan.

**Cuando la tabla llegue a cero** y `paginas.py` no liste ninguna página, se pasa a la Fase D (sección 7).

## 4. Pantallas nuevas del backend que aún no existen o no están completas

### 4.1 Hechas el 27/10/2026 pero sin comprobar con datos en el navegador
(Compilan y pasan las pruebas; falta la verificación visual de la sección 2 con datos.)

- Pumping: **Reporte de herramientas** (tarjeta y diálogo en `tickets-nuevos`): `ticket-reporte-herramientas-dialog`. Precarga con lo cotizado, marcas O/D/V, tope, completar.
- Prefactura: **rechazo con ítems observados y seguimiento** (`prefactura-accion-dialog`, `prefactura-seccion`).
- Tablero HSE (`/dashboard/qhse/dashboard`) y tablero general (`/dashboard`).
- Lista de precios: «Nueva lista» (botón y diálogo).

### 4.2 Por construir

| Pantalla | Backend listo | Dónde ponerla |
|---|---|---|
| **Hojas imprimibles de Mantenimiento** (Orden General, Orden Operativa, Informe DYN-MNT-RE-008) | `GET /api/operaciones/mantenimiento/ordenes/:id/hoja` | Botones en la bandeja nueva de órdenes. Reutilizar los componentes de `shared/documentos/formatos/orden-mantenimiento-*` e `informe-mantenimiento-hoja`; cambiar su entrada a la forma de la respuesta (`orden`, `unidad`, `lecturas`, `salida`, `novedades`, `subordenes`, `retorno`). El horómetro u odómetro es **uno solo** (según el tipo de unidad). |
| **Reporte diario de Pumping: adjuntos y firmas** | `POST .../reportes-diarios/:fecha/adjuntos` y `.../firmas` (`supervisor`, `representante_cliente` con archivo) | En `ticket-reporte-diario-dialog`: botón de adjuntar (zona de carga) y de firmar; el estado de las firmas sale de `GET /api/firmas?documentoTipo=pumping_reporte_diario&documentoId=<id del reporte>`. |
| **Rechazo de prefactura: persona a quien se devuelve** | `devueltoAUsuarioId` en `POST prefacturas/:id/rechazar` | Selector de usuarios en `prefactura-accion-dialog` (de dónde sale la lista: la misma que usa `asignar-analista-dialog`, o pedir un endpoint de usuarios por rol). |
| **Firmas en pantalla del viaje y del reporte** | eventos `flota.gerenciamiento_viaje.firmado`, `operaciones.pumping.reporte_diario.firmado` | Mostrar «Firmado por X el…» leyendo `GET /api/firmas`. |
| **PTW**: enlace del tablero HSE al detalle | el PTW del backend nuevo se abre en diálogo | Que «Ver todo» abra la lista y, si se puede, el diálogo del PTW elegido. |
| **Tablero de Reportería de Mantenimiento** (`/dashboard/mantenimiento/kpis`) | falta el `resumen` de Mantenimiento | ver §3.3. |
| **Tablero general de Reportería** (Facturación `reporteria`, Comercial, Pumping, FCR…) | el tablero general ya usa listas de cada módulo; falta el módulo de reportería de la sección C3 | ver `PLAN-CIERRE-MODELADO.md` C3. |
| **Conductor**: portal propio (`mis-tareas`, `mis-viajes`, gerenciamiento) | existe `GET pumping/mis-viajes` y Flota | ver §3.2 y 3.3. |
| **Selector de «persona devuelta»**, selector de **responsables** y cualquier lista de usuarios por rol | — | Si no hay endpoint de usuarios asignables por rol para ese contexto, pedirlo al módulo dueño. |

### 4.3 Pantallas de la demo sin equivalente claro
`FRONTEND-PARIDAD-VISUAL.md` lista las rutas que existen solo en el frontend nuevo (Flota, Auditoría, Encuestas, Roles y permisos, Derrames, Emergencias,
Inspecciones de Flota, etc.). Para cada una: revisar contra el diseño general (encabezado, tarjetas, tablas) y, en móvil, la barra superior y la navegación
inferior. No hay demo con qué compararlas: la referencia es el resto de las pantallas ya alineadas.

## 5. Datos de prueba para verificar en el navegador

La base de desarrollo está **limpia a propósito** (sin pedidos, tickets ni prefacturas). Para ver las pantallas con datos:

1. Haga un respaldo antes: `docker compose -f infra/docker-compose.yml exec -T postgres pg_dump -U "$POSTGRES_USER" -Fc dynadrill > respaldo-bd-dynadrill-<fecha>-antes-de-<tarea>.dump`
   (hay respaldos en `proyectos/`; el de esta sesión es `respaldo-bd-dynadrill-20261027-antes-de-diseno.dump`).
2. Cree los datos desde el portal (pedido → abrir → ticket) o con los scripts de siembra de cada módulo.
3. Al terminar el trabajo visual, **restaure el respaldo** (`pg_restore --clean`), reaplique `migrate deploy` por cada librería y corra `npm run db:test:preparar`. Los datos
   de prueba de esta sesión que ya están en la base de desarrollo y se van con la restauración: una lista de precios de Andes Petroleum (PRUEBA-LISTA-01),
   una meta HSE de prueba (`dias_sin_lti` = 60), el pedido PEC-004709 con su prefactura y el usuario `tecnico_hse` reactivado.
4. Las pruebas de integración **no** ensucian la base de desarrollo (usan `dynadrill_test`), pero no las corra con RabbitMQ activo sin saber qué hacen.

## 6. Pendientes del backend y de la base de datos

### 6.1 Backend que bloquea o completa pantallas

- **Avisos del backend nuevo que aún no existen** (los daba el alimentador de la demo): «pedido sin formato de recepción», «personal asignado sin SFI» y «PTW sin PT hoy».
- **Indicadores de Mantenimiento** (KPI) y su `resumen`.
- **Hoja de Mantenimiento**: el diálogo «Volver a operación» de la demo pedía «Responsable de entrega»; el backend no lo guarda. Decidir si se agrega una columna
  (`retorno_entregado_a`, FK a usuario) o se descarta.
- **Comercial exige o no el reporte de herramientas de Pumping** para dar por completos los documentos de un pedido (hoy no; es una regla de negocio de Dynadrill).
- **Listas con datos de AS2 sin cliente**: la lista de precios «REFERENCIA» tiene `cliente_id` vacío y se muestra con «—»; decidir si se le asigna cliente o se oculta.
- **Cargo y `perfil` de quien recibe EPI** se leen de `identidad.usuario_perfil`; si falta, el tablero muestra solo el nombre.
- Cualquier endpoint que una pantalla de §3 necesite y no exista: se pide al módulo dueño con una entrada en `REGISTRO-DE-CAMBIOS-COMPARTIDOS.md`.

### 6.2 Base de datos (anotados, ninguno es urgente)

| # | Tema | Detalle | Cómo atenderlo |
|---|---|---|---|
| DB-1 | Comentarios de tabla | Unas 125 tablas sin `COMMENT ON TABLE` | Una migración por esquema que comente cada tabla en español; empezar por `comercial`, `pumping`, `fcr`, `qhse` |
| DB-2 | Extensiones | Solo `plpgsql` | Instalar `pg_trgm` (búsquedas `ILIKE '%q%'` con índices GIN) y `pg_stat_statements` (medir) en `infra/db/init` y en una migración; recrear `dynadrill_test` |
| DB-3 | `comercial.pedido` | 52 columnas, 16 con prefijo `as2_` | Decisión del 27/10/2026: se dejan; si se separan, tabla 1:1 `pedido_as2` |
| DB-4 | Motor de flujo duplicado | Pumping y FCR repiten 15 tablas (`paso`, `transicion`, `requisito`…) | Consecuencia de contenedores independientes; revisar cuando haya un tercer flujo |
| DB-5 | Lecturas de Flota en la hoja de Mantenimiento | La consulta de horómetro/odómetro usa SQL directo sobre `flota.unidad_lectura` | Pasar a un espejo de Prisma de solo lectura (`FlotaUnidadLectura` y su anulación) para ser consistente con el resto |
| DB-6 | `desecho_aviso.emitido_por` | Ahora admite vacío (revisión automática); ya hay `CHECK`s del resto de la tabla | Si se quiere trazabilidad del sistema, agregar una columna `origen` (`persona`/`sistema`) |
| DB-7 | Unidad del indicador de desechos | Cambió de `kg` a `galones` en el catálogo `kpi_indicador` (el código `desechos_peligrosos_kg_mes` se conserva) | Si se quiere renombrar el código, migración y cambio del frontend a la vez |
| DB-8 | Firmas «de una línea» | Las tablas de firmas de cada módulo se conservan por ser estado del flujo; IPERC, STOP y SWA no publican firma | Evaluar si deben (`02-CONTRATOS` §4.14) |
| DB-9 | Retiro de lo transitorio (Fase D) | puentes `manual_temporal`; catálogo `/api/catalogos` con ids numéricos; columnas `legacy_id` de 9 tablas; `LEGACY_JWT_SECRET` del gateway | Al cortar cada módulo (sección 7) |
| DB-10 | Rama remota `modelado/fase-c` | Quedó en `origin` porque el borrado fue denegado por el clasificador | Borrarla a mano: `git push origin --delete modelado/fase-c` |
| DB-11 | Reportería | El módulo de reportería (C3) no existe; los tableros leen de cada módulo | Decidir si se crea `worker/reporting` solo si una consulta lo exige por rendimiento (D-R) |
| DB-12 | FL-2 pasajeros del viaje | Quedan como texto abierto (decidido) | — |
| DB-13 | Eliminación en cascada vs historia | `reporte_item_dia` apunta a `ticket_linea` con `RESTRICT`; las pruebas de Pumping borran primero las celdas | Mantener; si un día se purgan tickets, hacerlo con un procedimiento |

## 7. Fase D: el corte (cuando la sección 3 esté en cero)

Siga `modulos/plan-corte-de-la-demo.md` §3 y haga, por módulo y en este orden: Facturación → Catálogos → Flota/Mantenimiento/Inventario → QHSE → Pumping y FCR → puente.

1. Borrar del frontend el código muerto (páginas, servicios, modelos y mocks de la demo) y confirmar con `paginas.py` que ya no quedan servicios viejos.
2. En el gateway (`apps/gateway/src/routes.ts` y `routes.spec.ts`): retirar los prefijos viejos o apuntarlos al contenedor nuevo.
3. Retirar los puentes `manual_temporal` de requisitos cuyo evento real ya existe (Flota, QHSE) y el catálogo viejo `/api/catalogos`.
4. Retirar las columnas `legacy_id` y `LEGACY_JWT_SECRET` (migración + registro de cambios).
5. Apagar `dynadrill-backend` (la demo).

## 8. Orden de trabajo recomendado

1. **Verificación**: iniciar sesión, crear datos de prueba (§5) y comprobar con capturas lo del §4.1 (es lo ya hecho que nunca se vio).
2. **Facturación** (§3.1): enlazar todo a `pedidos` nuevos y retirar `pedidos-demo` y `aots`. Es lo más corto y destraba el resto.
3. **Pumping y FCR** (§3.2): redirigir raíces, migrar `configuracion-codigos`, retirar las pantallas demo.
4. **Mantenimiento, Flota y Conductor** (§3.3): bandeja nueva con las hojas (§4.2), `mis-tareas`/`operativo`, `vehiculos`, `mis-viajes`; backend de indicadores y KPI.
5. **QHSE** (§3.4): bandeja de eventos, detalle de SWA, avisos y borrado del código muerto.
6. **Inventario** (§3.5).
7. **Pantallas por construir** (§4.2) y revisión de móviles de diálogos y detalles.
8. **Base** (§6.2) y **Fase D** (§7).

## 9. Definición de «terminado»

Una pantalla está terminada cuando: (1) usa solo el backend nuevo (`paginas.py` ya no la lista); (2) su HTML y SCSS son los de la demo salvo diferencias justificadas y
anotadas; (3) compila y pasan las pruebas; (4) se vio en el navegador con datos, **en escritorio (1440) y móvil (390)**, y las capturas están en
`documentacion/capturas-frontend/`; (5) su fila en `FRONTEND-PARIDAD-VISUAL.md` dice «Hecho»; (6) los cambios están empujados a `respaldo diseno/facturacion-demo`.
El frontend está terminado cuando `paginas.py` no lista nada, el código muerto se borró y la Fase D se cumplió.
