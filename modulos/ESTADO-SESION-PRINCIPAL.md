# Estado de la sesión principal (Pumping + Comercial + coordinación)

**Corte:** 16/10/2026. Quien retome esta sesión lea este archivo primero; después `README.md`, `01-REGLAS-DE-COORDINACION.md` y `REGISTRO-DE-CAMBIOS-COMPARTIDOS.md`.

## 1. Qué se quería hacer

1. Repartir el desarrollo de los módulos en otras sesiones y dejar a la principal con lo que toca código ya construido: **Pumping restante** (`plan-pumping-restante.md`), **ajustes de Comercial** (`plan-comercial-ajustes.md`, incluye D15 b y c) y la coordinación (registro, contratos, retiro de puentes temporales).
2. Respaldar el trabajo en GitHub sin tocar el demo de producción.

## 2. Lo que se hizo

### Coordinación y respaldo
- Cuatro sesiones abiertas por el usuario: **Flota, Inventario, QHSE y Mantenimiento** (ya hay `apps/qhse`, `libs/operaciones/{flota,inventario,mantenimiento}`). Prompts en `NOTAS-DE-ARRANQUE.md` (regla nueva: commits locales por rama `modulo/<nombre>`, nunca `push` ni `main`).
- Repos privados en la cuenta `gamr2026`, ya con respaldo:
  - `dynadrill-platform` → rama `desarrollo` (4 commits; `main` local sin tocar; remoto `origin`).
  - `dynadrill-frontend-platform` → rama `feat/integracion-backend-platform`, remoto **`respaldo`** (el `origin` del frontend es el repo del demo: **no empujar allí**).
  - `dynadrill-documentacion` → rama `main` (carpeta `documentacion`, repo propio).
- **Nada de lo hecho después de esos commits está confirmado ni subido** (ver sección 4, punto 1).

### D15 y la rama de inventario
- D15(a) aplicada: `catalogosWrite` incluye a Ingeniería de Ventas; permisos `catalogos.ubicacion.*` asignados en la base (con historial).
- Corregido: la rama `feature/inventario-columnas-y-precios-reales` **ya está fusionada en `main`** (docs D5, 04 y plan-inventario corregidos).

### Comercial (backend, con pruebas de integración en verde)
| Cambio | Estado | Detalle |
|---|---|---|
| C1 tipo de línea | **Hecho (backend)** | enum `tipo_linea`, columna en `pedido_item`, deducción (Material/Servicio/«moviliz»), evento `comercial.pedido.abierto` ahora lleva `fechaFinServicio` y `lineas` (migración `20261019110000`) |
| C2 alta de ubicación para Ventas | **Hecho** | ver arriba |
| C3 corrección por Facturación | **Hecho (backend)** | `PUT /api/comercial/pedidos/:id/documentos-operativos/dia`, permiso `comercial.documentos_operativos.corregir`, reenvío del ticket → 409, evento `comercial.documento_operativo.corregido` |
| C4 tablas en actividades | **Hecho (backend)** | 4 tablas hijas sin JSON (migración `20261019090000`) |
| C5 «ver prefactura» | **Hecho (backend)** | `GET /api/comercial/pedidos/:id/prefactura-vista`, permiso `comercial.prefacturas.vista_ticket` |
| C6 firma del Company Man | **Hecho (backend)** | `POST .../prefactura/firma-company-man`, permiso `comercial.prefacturas.firma_company_man`, módulo de archivos `prefactura_company_man`; genera o recalcula y deja `ticket_firmado` |
| C8 despacho con respaldo y MSDS | **Hecho (backend y frontend)** | columnas en `pedido`, módulo de archivos `despacho_documento`, eventos `comercial.despacho.solicitado|resuelto` ahora SÍ se publican (migración `20261019100000`); diálogo nuevo `despacho-realizar-dialog` |
- Matriz nueva `prefacturaTicket` (Supervisor y Supervisor Pumping) en `module-roles.ts`. Permisos nuevos de este tramo: `documentos_operativos.corregir`, `prefacturas.vista_ticket`, `prefacturas.firma_company_man`.
- Se sembraron en la base los módulos de archivos nuevos (`npm run db:seed:archivos`).

## 3. Verificación

- Pasan (con `RUN_INTEGRATION=1`, base real): documentos operativos (11), guías y despacho (9), pedidos (34), prefacturas (25), `pedidos:test` completo.
- **Pendiente de cerrar:** la corrida conjunta `nx run-many -t lint test build -p pedidos authz archivos` dio `archivos:lint` y `archivos:test` en rojo.
  - `archivos:lint`: error `no-control-regex` en `libs/plataforma/archivos/src/archivos.service.ts:85`. **No es de este tramo** (no toqué ese archivo): probablemente lo cambió otra sesión; avisar a quien corresponda o corregirlo.
  - `archivos:test`: 3 pruebas fallaron en la corrida conjunta (carga alta de la máquina); repetidas aisladas con `npx jest` dentro de la librería no mostraron fallos. Repetir con `nx` cuando no haya otro `nx.lock`.
  - `authz` y `pedidos` (lint, test, build): en verde.
- **Frontend sin verificar:** se creó `despacho-realizar-dialog` y se cambió `guias-seccion`, el servicio y el modelo de despacho; **falta correr `ng build` y las pruebas** (la prueba de `guias-seccion`, si existe, debe enviar el cuerpo nuevo).

## 4. Lo que falta (en este orden)

1. **Confirmar y respaldar:** commit en `dynadrill-platform` (rama `desarrollo`) y en el frontend (rama `feat/integracion-backend-platform`), luego `git push` a `gamr2026` (en el frontend: `git push respaldo`, nunca a `origin`). Subir también los cambios de `documentacion`. Hay además 6 archivos de `apps/` que quedaron sin confirmar de otra sesión: no los pise.
2. **Reiniciar servicios** (plataforma y comercial, con el script `reiniciar_back.ps1` del scratchpad de la sesión anterior o a mano; avisar con `db.lock`) para que `sync-permisos` asigne a los roles los permisos nuevos (`corregir`, `vista_ticket`, `firma_company_man`) y el filtro de rutas del gateway los conozca. Verificar en la base que Facturación tenga `corregir` y Supervisor/Supervisor Pumping los dos de prefactura.
3. **Frontend de Comercial:** C3 (pantalla de corrección por día para Facturación, con editor de tablas), C4 (mostrar tablas en actividades del Reporte Job), C9 (descargar PDF de todos los documentos del pedido), C10 (plantillas de ejemplo Pumping y FCR en «Nuevo pedido»), y mostrar `tipoLinea` en las líneas del pedido.
4. **C7:** consumidor en comercial de `operaciones.pumping.cerrado` y `operaciones.fcr.cerrado` que genere la prefactura sola si la documentación está completa (si no, omitir sin fallar). Depende de que exista el cierre en Pumping (P6).
5. **Pumping restante** (`plan-pumping-restante.md`), no iniciado: P1 químicos (necesita Inventario), P2 revisión de reportes de salida, **P3 ejecución y Reporte Diario** (usar el contrato de corrección: un 409 al reenviar un día corregido significa «ya corregido», no es error), P4 control de retorno, P5 traslado de llegada, P6 revisión final y cierre (incluye «Ver prefactura» y firma del Company Man desde el ticket con los endpoints de C5/C6), P7 solicitudes de cambio de ítems, P8 tarjeta Mantenimientos, P9 gerenciamiento de viaje.
6. **Contratos y docs:** actualizar `02-CONTRATOS-ENTRE-MODULOS.md` (4.4, 4.10, 4.11 y los eventos `comercial.despacho.*` con su carga, `comercial.documento_operativo.corregido`, `lineas` y `fechaFinServicio` en `pedido.abierto`); marcar C1, C3, C4, C5, C6 y C8 en `plan-comercial-ajustes.md` (la tabla de la sección 1 de ese plan aún dice «Por hacer»); anotar en `REGISTRO-DE-CAMBIOS-COMPARTIDOS.md` los permisos de C5/C6, los módulos de archivos nuevos (`prefactura_company_man`, `despacho_documento`) y la columna `tipo_linea`.
7. **Avisar a Inventario** (por el registro): el despacho ya publica `comercial.despacho.solicitado|resuelto` con `archivoRespaldoId` y `archivoMsdsId`. **Avisar a FCR** (cuando se abra su sesión): `lineas` con `tipoLinea` en `pedido.abierto`.
8. **Decisiones abiertas** (`03-DECISIONES-PENDIENTES.md`): D1, D2, D3, D6, D7, D9–D14; D15(b) y (c) quedan implementados en backend, falta el frontend. Consultas a Dynadrill: ¿Ventas puede inactivar pozos/taladros o solo agregar?, ¿quién gestiona la firma del Company Man en FCR?, ¿el Acta de Entrega se exige para generar la prefactura o solo para cerrar?
9. **Probar en pantalla** (usuario): Traslado de salida de Pumping y el diálogo de despacho.

## 5. Advertencias

- El firmado por el Company Man deja la prefactura como enviada (medio `portal`) y firmada en el mismo acto, porque la base exige `enviada_at` para el estado `firmada`. Si Dynadrill prefiere otro modelo, cambiar esa regla y la restricción de la base.
- Las migraciones de este tramo llevan marca de tiempo 20261019…: las migraciones de otras sesiones con marca anterior ya aplicadas no chocan, pero evite crear migraciones de comercial con marca menor a `20261019110000`.
- Mantener los permisos del frontend alineados: el frontend no conoce aún `vista_ticket`, `firma_company_man` ni `corregir`.

## 6. Respaldos hechos al cierre

- Backend `desarrollo` (commit `ef20cb5`), documentación `main` (`93e0d4e` más este archivo) y frontend `respaldo` (commit `ee378b1`) ya están en GitHub.
- El commit del frontend `ee378b1` incluye también el trabajo en curso de las sesiones de Flota, Inventario, QHSE y Mantenimiento (se usó `git add -A`); no hay que deshacerlo, solo tener presente que ese commit mezcla módulos.

## 7. Avance del 17/10/2026 (segunda parte)

**Hecho y probado (base real):**
- **C7 (Comercial):** `TicketCerradoConsumer` genera la prefactura sola al recibir `operaciones.pumping.cerrado` o `operaciones.fcr.cerrado`; si no se puede, se omite sin fallar; idempotente por el inbox. Las pruebas de comercial suman 105 y pasan; los specs usan el helper `testing/sin-suscripciones.ts` para no suscribirse a RabbitMQ.
- **Pumping, flujo completo hasta el cierre (P2, P4, P5 y P6 en esqueleto):** transiciones nuevas `revision_reportes_salida` a `ejecucion_operativa`, `ejecucion_operativa` a `control_retorno`, `control_retorno` a `traslado_llegada`, `traslado_llegada` a `revision_reportes_llegada`, `revision_reportes_llegada` a `revision_final`, `revision_final` a `cierre` y el rechazo `revision_final` a `revision_reportes_llegada` (con motivo y sin exigir requisitos: columna nueva `transicion.exige_requisitos`, migración `20261019120000`).
- Requisitos nuevos: `ejecucion_formalizada`, `reporte_unidad_llegada` (por unidad) y `acta_entrega_locacion` (QHSE, por evento `qhse.acta_entrega.cargada|anulada`).
- **P3 parcial:** formalización de la ejecución por el Supervisor asignado (`POST /api/operaciones/pumping/tickets/:id/ejecucion/formalizar`, permiso `pumping.ejecucion.formalizar`).
- **P5:** reporte de unidad de llegada (`PUT .../reportes-unidad/:vehiculoId/llegada`) que publica `operaciones.pumping.reporte_unidad_llegada` con la forma que ya consume Mantenimiento.
- **Cierre:** al pasar a `cierre` se publica `operaciones.pumping.cerrado`.
- Prueba de integración que recorre todo el ticket de punta a punta (14 pruebas de Pumping pasan).

**Falta de Pumping** (ver `plan-pumping-restante.md`): P1 químicos y salida de bodega (Inventario ya tiene el kardex), el **Reporte Diario** de P3 con su empuje a Comercial y la corrección de Facturación, P4 cuadre de químicos y herramientas, la inspección de llegada (esperar el contrato de Flota), P6 «Ver prefactura» y firma del Company Man desde el ticket en pantalla, P7, P8 y P9, y **todo el frontend** de los pasos nuevos.

**Pendiente de coordinación:** el reinicio de servicios con el código nuevo (los servicios 3100 a 3103 se levantaron al inicio de la sesión; hay que recompilar y reiniciar para probar lo de Pumping), y los respaldos en GitHub de lo hecho después del commit `ef20cb5`.

## 8. Ramas por módulo (17/10/2026) y orden de fusión

Las cuatro sesiones terminaron su tramo. Sus cambios quedaron en ramas y respaldados en GitHub (`gamr2026`). Ninguna rama está fusionada en `desarrollo`; `main` de cada repo no se toca.

**Backend (`dynadrill-platform`, remoto `origin`)**, todas parten de `desarrollo` (commit `23d5dd8`), salvo `modulo/qhse`, que parte de `ef20cb5`:

| Rama | Contenido |
|---|---|
| `modulo/qhse` | contenedor QHSE, EPI, consumidor de Pumping, avisos (hecha por la sesión de QHSE) |
| `modulo/flota` | `libs/operaciones/flota` (F1) |
| `modulo/inventario` | `libs/operaciones/inventario` (I1) con los datos reales |
| `modulo/mantenimiento` | `libs/operaciones/mantenimiento` (M1) |
| `modulo/integracion-operaciones` | cableado compartido: `apps/operaciones`, `apps/plataforma`, `apps/gateway`, `package.json`, `tsconfig.base.json`, `scripts`, plantillas de avisos |

**Orden sugerido:** `modulo/qhse`, `modulo/flota`, `modulo/inventario`, `modulo/mantenimiento` y al final `modulo/integracion-operaciones`. Se esperan conflictos pequeños en `package.json`, `tsconfig.base.json` y `apps/gateway/src/app/routes*.ts` porque varias sesiones tocaron las mismas líneas: en ellos manda la versión de `modulo/integracion-operaciones`, que refleja el árbol de trabajo final. Después de fusionar, ejecute `npm install`, `npx prisma generate` por librería y `nx run-many -t lint test build`.

**Frontend (`dynadrill-frontend-platform`, remoto `respaldo`)**: parten de `feat/integracion-backend-platform`. `modulo/qhse` (entrega de EPI) y `modulo/inventario` (modelo). El trabajo de pantallas de Flota y Mantenimiento quedó dentro del commit `ee378b1` de esa misma rama (se mezcló en un `git add -A`).

Los commits de estas ramas se crearon sin ejecutar los ganchos de commit (lint-staged y commitlint); corra `nx run-many -t lint` antes de fusionar.

## 9. Revisión y fusión (17/10/2026)

**Revisión por módulo (migraciones aplicadas y leídas contra los hallazgos):** Flota, Inventario, Mantenimiento y QHSE corrigieron sus hallazgos con migraciones nuevas (`pulir_f1_integridad`, `pulir_revision_bd` y `ver_id_de_archivos`, `catalogos_con_id_auditoria_y_repuestos`, `epi_catalogos_integridad_y_auditoria`). Las cuatro bases quedaron al día (`prisma migrate status`). Puntos destacables: lecturas y consumos inmutables, FK compuestas, triggers que impiden cambiar una entrega de EPI despachada, ids sin FK reemplazados por columnas con FK dentro del contenedor.
**Sobre «QHSE no puede tener FK a artículo»:** es la regla D1 (sin FK entre contenedores; QHSE es otro contenedor con su propio rol de base de datos), no una imposibilidad técnica. QHSE dejó su propio catálogo de elementos y lo anotó como **D16**, que sigue **pendiente** de decisión del usuario.

**Lint y commitlint:** commitlint sin errores en todas las ramas. El gancho de commit solo ejecuta prettier: se formateó cada rama con un commit `style:` (Flota, Mantenimiento, QHSE e integración tenían archivos sin formatear; Inventario no). El frontend no tiene gancho ni commitlint (su base tampoco está formateada con prettier: no se tocó).

**Fusión en `desarrollo` (backend), en orden:** `modulo/qhse`, `modulo/flota`, `modulo/inventario`, `modulo/mantenimiento`, `modulo/integracion-operaciones`, sin conflictos. Frontend: `modulo/qhse` y `modulo/inventario` en `feat/integracion-backend-platform`.

**Verificación del árbol fusionado:** `nx run-many -t lint test build` sobre los 21 proyectos con `RUN_INTEGRATION=1` y base real: todo en verde; frontend `ng build` y 352 pruebas en verde.

**Hallazgos corregidos durante la revisión (no eran de la sesión que los dejó):**
- Frontend de Flota: la ficha de unidad (`unidad-detail-page`) no tenía plantilla ni estilos (el build fallaba). Se escribieron `unidad-detail-page.html` y `.scss` a partir del componente. **Conviene que Flota la revise** (diseño y textos).
- `archivos.service.ts`: el comentario de `eslint-disable` quedó mal ubicado tras el formato; se movió.
- `apps/comercial/src/assets` y `apps/operaciones/src/assets` no estaban versionadas y los builds fallaban en una copia limpia: se agregaron con `.gitkeep`.
- Datos de prueba residuales (2 clientes y 2 pozos `IT`) de una corrida fallida de mis pruebas: eliminados.

**Copias de seguridad:** quedan dos stash (`dynadrill-platform` y el frontend, «respaldo ... antes de fusionar») con el árbol de trabajo anterior; todo su contenido ya está en las ramas. Pueden borrarse cuando el usuario lo confirme.

## 10. EPP de AS2, D16 y comparación del catálogo de AS2 (17/10/2026)

**Hecho (en `desarrollo`, commit `e6e5f02`):**
- El reporte de AS2 «INVENTARIO PRODUCTO ATRIBUTO AS2.xlsx» (3.770 productos) trae la categoría **EPP** con 74 productos. Se depuró (5 con nombre de empleado excluidos, 11 fusionados por talla, duplicado o digitación) y se cargó en Inventario: **58 artículos**, **37 de entrega personal** (`npm run db:cargar:epp`; detalle en `libs/operaciones/inventario/prisma/data/README.md`).
- **D16 resuelta:** los elementos de EPI son artículos de Inventario; QHSE guarda una réplica (`qhse.epi_elemento`) mantenida por el evento `operaciones.inventario.articulo_epi_actualizado`. Se retiró el catálogo inventado de 12 elementos. La talla sigue siendo un catálogo de QHSE (la talla no es parte del artículo). Frontend de Inventario: casilla «se entrega a una persona» y tipo de talla.
- **Error corregido en el bus de eventos:** dos consumidores del mismo origen en un contenedor compartían cola y se perdían mensajes (cola `operaciones.comercial`: creación de tickets de Pumping y despachos; cola `qhse.operaciones`). `Subscription.group` nuevo; regla en el registro de cambios.
- Verificación: lint, pruebas con base real y build de los 21 proyectos; frontend `ng build` y 352 pruebas.

**Comparación del catálogo de AS2 con Inventario (solo lectura, nada cargado):**

| Categoría de AS2 | En AS2 | Ya en Inventario | Falta | Qué es |
|---|---|---|---|---|
| QUIMICA | 497 | 155 | 342 | Inventario (químicos). 117 con espacios en el código (ej. `DYFE - 100`) |
| COMPLETION BIENES | 386 | 287 | 99 | Inventario |
| FISHING CONSUMO | 191 | 62 | 129 | Inventario |
| FISHING & TOOLS | 182 | 136 | 46 | Inventario (herramientas) |
| MANTENIMIENTO (suministros y mantenimiento) | 653 | 0 | 653 | Repuestos y suministros: Inventario o Mantenimiento |
| EPP | 74 | 58 + 11 equivalencias | 5 | Los 5 son los overoles con nombre de persona (excluidos a propósito) |
| SERVICIO FISHING, SERVICIOS PUMPING, COMPLETION SERVICIOS, COILED TUBING, SERVICIOS | 1.770 | 0 | — | Servicios de facturación (listas de precios de Comercial): **no** son inventario |
| COMPRA IVA, COMPRA 0%, GASTOS INDIRECTOS, ARTICULOS NO INVENTARIADOS | 17 | 1 | — | Conceptos contables, no inventario |

En Inventario y no en AS2: 48 herramientas del registro de inspección (esperado). El reporte no trae costo, saldo ni bodega: solo código, nombre, nombre comercial, marca y proveedor. 97 nombres se repiten en AS2.
**Decisiones pendientes del usuario:** si se cargan los ~1.269 productos faltantes de bienes (químicos, completion, fishing, mantenimiento); qué hacer con los 117 códigos de químicos con espacios (hoy el alta de artículos los rechaza: «el código no puede llevar espacios»); si MANTENIMIENTO (repuestos) va a Inventario.

## 11. Bienes de AS2 y repuestos en Inventario (17/10/2026)

Por decisión del usuario se cargaron los **1.268 productos de bienes** que faltaban (químicos 342, completion 98, fishing consumo 129, fishing & tools 46 y **653 repuestos y suministros de mantenimiento**); los servicios y conceptos contables **no** son inventario. Los códigos con espacios se **normalizaron** (103 del archivo y 78 de la carga inicial; el original queda como equivalencia; 3 colisiones resueltas con sufijo `-2`). La categoría de repuestos lleva la marca `es_repuesto` y Mantenimiento los ofrece con `GET .../articulos?repuestos=true` (hoy la demo usa texto libre). Inventario tiene ahora **2.015 artículos**. Detalle: `libs/operaciones/inventario/prisma/data/README.md`.
Pendiente: que Mantenimiento (M2) use el selector de repuestos; proveedor y marca no se cargaron; clasificar con Dynadrill los 37 EPP de entrega personal; decidir si un repuesto usado genera salida de bodega.

## 12. Stock real y costos de AS2 (17/10/2026)

Con el reporte «Stock» por bodega de AS2 (17/10/2026) el kardex de Inventario quedó con el **stock real**: 964 saldos iniciales, 11 ajustes por sobrante, 58 por faltante y 46 llevados a cero (el stock cargado de la demo estaba en una sola bodega y desactualizado), en 6 bodegas (se agregaron Suministros y Mantenimiento y EPP a `catalogos.bodega`). Se corrigieron las unidades de stock de 76 artículos. El costo unitario sale del **último costo de ingreso** del kardex de AS2 (decisión del usuario; 59 artículos sin costo lo recibieron). El historial de 48 mil movimientos del kardex de AS2 **no** se importó. Quedó fuera 1 renglón (CT-ON, ambiguo; el usuario decidió dejarlo). Los 5 overoles con nombre de persona entraron como «OVEROL BORDADO», sin el nombre (EPP: 63 artículos, 42 de entrega personal). Detalle en `libs/operaciones/inventario/prisma/data/README.md`.
Decidido por el usuario: no se importa el historial del kardex y `CT-ON` se deja fuera hasta que el cliente lo pida.

## 13. Mantenimiento: repuestos con salida de bodega (17/10/2026)

Por decisión del usuario: Mantenimiento elige el repuesto del catálogo de Inventario y **sí** genera salida de bodega.

- **Inventario:** origen `consumo_mantenimiento`, motivo «Consumo en mantenimiento», tabla inmutable `salida_mantenimiento` (idempotencia), `registrarSalidasDeMantenimiento`, y `GET articulos/repuestos?q=` (selector con existencia por bodega). Hay que correr `npm run db:seed:inventario` para crear el motivo nuevo (ya corrido en desarrollo).
- **Mantenimiento:** `suborden_repuesto` de catálogo o de texto (CHECK), con bodega y `movimiento_id`; ejecución completa de la sub-orden (avance, revisión, aprobación, corrección). La salida se registra al aprobar el cierre; si no alcanza el stock el cierre se rechaza sin cambiar nada.
- **Atomicidad:** Mantenimiento e Inventario no pueden compartir transacción (clientes Prisma distintos). Se resolvió con salida idempotente por renglón (si se interrumpe, se repite el cierre). El contrato 4.1 de Pumping dice «dentro de su transacción»: **no es realizable** tal como está escrito; queda avisado en el registro de cambios.
- **Frontend:** buscador del catálogo en el diálogo de ejecución. Falta el adaptador de todo Mantenimiento al backend nuevo.
- **Pruebas:** Mantenimiento 36 (6 nuevas de M2 más las reglas de base), Inventario 43, frontend 353; lint y build en verde.
