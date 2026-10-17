# Plan: Inventario

**Schema:** `inventario` · **Contenedor:** operaciones (3103) · **Librería:** `libs/operaciones/inventario` (`@dyn/inventario`) · **Prefijo HTTP:** `/api/operaciones/inventario`
**Estado (16/10/2026): I1 construido, falta verificar (lint, build, `ng test`, `ng build`) y reiniciar el contenedor; I2–I4 por hacer. Ver «Estado de la sesión» al final.** · **Ola:** 1 (es el más pequeño; Pumping y FCR lo necesitan)
**Lea antes:** `00`, `01`, `02` (contratos 4.1), `03` (D2, D3), `04-REVISION-CONTRA-DEMO-MAIN.md` y `integracion-as2/CONSULTAS-PARA-ASINFO.md`. **Revisado contra el `main` de la demo (08/10/2026): el dominio de inventario no cambió desde el 24/09.** La rama `feature/inventario-columnas-y-precios-reales` **ya está fusionada en `main`**: trae datos reales para la carga inicial en `dynadrill-backend/prisma/data/` (`inventario.json` con 641 artículos, `descuentos.json`, `listas-precios/` con 6 listas, stock del kardex) y el script `import-datos-reales.ts` (upsert idempotente por código).

## 1. Objetivo

Llevar **artículos, existencias (kardex), partes de artículos y despachos de bodega** de lo que físicamente se guarda y se consume: herramientas, químicos e insumos de trabajo. Las líneas de "Servicio" del catálogo de AS2 (día de renta, movilización, *Lump Sum*) **no** son inventario: son conceptos de facturación y quedan fuera.

## 2. Qué hay en la demo

| Parte | Dónde |
|---|---|
| Backend `articulos`, `articulo-partes`, `movimientos-inventario` | `dynadrill-backend/libs/domains/inventario/src` (≈ 420 líneas; payload JSON) |
| Modelos del frontend | `features/inventario/models/{articulo,articulo-parte}.model.ts` |
| Pantallas (≈ 1.570 líneas) | `features/inventario/`: catálogo, kardex, partes, alta de artículo y de unidad |
| Contexto AS2 | `documentacion/integracion-as2/instrucciones-word-solicitud-apis-as2.md` (§3.2: Producto, Unidad, Bodega, Kardex/Stock, Orden de Salida de Material, Consumo de Bodega, Salida de Material, Vehículo) |

Reglas ya vistas:

- **Artículo**: código (y alterno, comercial, de barras), nombre y nombre comercial, **categoría y subcategoría** (texto libre en la demo: **aquí deben ser catálogos**), unidad de stock, nota, activo, información adicional, **costo unitario interno** (no es precio de venta), **descuento sugerido** (de la lista de descuentos de Dynadrill). El **stock actual se calcula** del kardex; nunca se edita.
- **Kardex**: un renglón por movimiento (entrada/salida, cantidad, fecha, motivo, responsable) con el **saldo resultante**. Es trazabilidad histórica: inmutable.
- **Partes de artículos**: componentes o partes de un artículo (herramientas con partes).
- **Salida de bodega real de químicos al asignar un ticket de Pumping** (demo: `movimientosInventarioService.registrar`) y **documento de mezcla** obligatorio si hay químicos.
- **Despacho a bodega** (ciclo comercial): `comercial` solo guarda dos marcas (`despacho_solicitado`, `despacho_realizado`) y publica `comercial.despacho.solicitado|resuelto`; Inventario debe **consumir** esos eventos y registrar la salida real. En la demo `main`, **Bodega adjunta el documento de respaldo (obligatorio) y, si despacha químicos, la hoja MSDS (opcional)**: Inventario recibe esos archivos con el evento (cambio C8 de `plan-comercial-ajustes.md`).
- En la demo, la **unidad** (vehículo) también tiene datos patrimoniales en "Inventario": **no los duplique**, son de Flota (D2).

## 3. Qué hacen los otros módulos

- **Pumping** (esta sesión) pedirá salidas de químicos al asignar y registrará consumo y devolución (contrato 4.1). **FCR** usará herramientas (preparación e inspección).
- **Comercial** ya publica los eventos de despacho.
- **Flota** es dueña de la unidad (patrimonio).
- **AS2** puede ser la fuente de productos y existencias (D3, consulta a Asinfo).

## 4. Modelo de datos propuesto

Catálogos: `categoria_articulo`, `subcategoria_articulo` (FK a la categoría), `unidad_stock` (¿se puede reutilizar `catalogos`? si es dato maestro compartido, proponga moverlo a `catalogos` con una migración de esa sesión; si no, déjelo en `inventario`), `motivo_movimiento`.
Enums: `tipo_movimiento` (entrada, salida), `origen_movimiento` (compra, ajuste, despacho_bodega, salida_ticket, consumo_ticket, devolucion_ticket, ...).

- `articulo` (`codigo` único, códigos alternos en tabla `articulo_codigo` (tipo: alterno, comercial, barras), `nombre`, `nombre_comercial`, `subcategoria_id`, `unidad_stock_id`, `costo_unitario`, `descuento_sugerido`, `as2_codigo` para conciliar, `activo`).
- `articulo_parte` (artículo padre, parte, cantidad).
- `bodega`: **ya existe `catalogos.bodega`**: use FK, no cree otra.
- `movimiento` (kardex): `articulo_id`, `bodega_id`, `tipo`, `origen`, `cantidad` > 0 (CHECK), `fecha`, `motivo_id`, `responsable_id` (FK usuario), `referencia` tipada (`ticket_id` y/o `pedido_id` con FK si son del mismo contenedor o uuid sin FK si no, D1), `saldo_resultante`. **Inmutable**: sin UPDATE ni DELETE para `app_operaciones` (patrón de `secuencia_emision` en comercial). El saldo se calcula en la misma transacción con bloqueo de fila del artículo (evite saldos negativos con un CHECK o con validación).
- `salida_ticket` / `consumo_ticket` si desea distinguir lo asignado de lo consumido (asignado, usado, devuelto por químico, como en la demo `quantityAssigned / quantityUsed / quantityReturned`): una tabla `ticket_articulo` (`ticket_id`, `articulo_id`, `asignada`, `usada`, `devuelta`) más los movimientos que la respaldan.

## 5. Eventos y servicios exportados

**Servicio exportado por `index.ts`** (mismo contenedor): `registrarSalida`, `registrarEntrada`, `registrarConsumo`, `registrarDevolucion`, `stockDe(articuloId, bodegaId)`. Pumping los llamará dentro de **su** transacción cuando sea posible (una sola `tx`) o por HTTP interno.
**Publica:** `inventario.salida.registrada`, `inventario.consumo.registrado`, `inventario.devolucion.registrada`, `inventario.stock.bajo_minimo` (si define mínimos).
**Consume:** `comercial.despacho.solicitado` y `comercial.despacho.resuelto`.

## 6. API y permisos

`/api/operaciones/inventario/{articulos,categorias,movimientos,partes,stock}`. Permisos en el bloque `inventario` de `permissions.ts` (ya existe `inventario.movimientos.consumir`). Rol `bodeguero` (registra entradas y salidas); lectura para Pumping, FCR y Facturación.

## 7. Pantallas

`features/inventario`: catálogo de artículos (alta con categorías de catálogo), kardex con saldo, partes, y la pantalla de **despachos de bodega** (solicitudes que llegan de Facturación). Importación inicial del catálogo desde el export de AS2.

## 8. Tramos

1. **I1 — Catálogo y kardex** (artículos, categorías, movimientos inmutables, stock calculado) + carga inicial desde el export de AS2.
2. **I2 — Servicio exportado** y contrato 4.1 con Pumping (químicos) acordado y probado.
3. **I3 — Despachos de bodega** (consumo de los eventos de comercial).
4. **I4 — Herramientas para FCR** (con la sesión de FCR) y, si AS2 lo permite, conciliación de existencias.

## 9. Pruebas

Integración: saldo correcto y sin negativos con movimientos simultáneos (como la prueba de "25 emisiones simultáneas" de secuenciales), kardex inmutable (la base rechaza UPDATE/DELETE), stock = suma de movimientos, consumidores idempotentes, permisos por rol.

## 10. Consultas

- A Asinfo (`integracion-as2/CONSULTAS-PARA-ASINFO.md`): ¿el API de AS2 expondrá productos, unidades de medida, existencias y órdenes de salida de material? ¿Cuándo? (D3)
- A Dynadrill (`documentacion/facturacion/CONSULTAS-PARA-DYNADRILL.md`, sección `## Inventario`): ¿mínimos de stock por artículo? ¿Quién autoriza ajustes? ¿Los químicos se manejan por lote o fecha de caducidad?

## 11. Puntos de choque

`permissions.ts` (bloque `inventario`), `apps/operaciones/src/app/app.module.ts`, `package.json`, `tsconfig.base.json`, `plantillas/inventario.ts`. **No** toque `libs/operaciones/pumping` ni `fcr`.

## 12. Preguntas abiertas entre módulos

_(Pumping: ¿llamará a `registrarSalida` dentro de su transacción de asignación o por evento? Propuesta: dentro de la misma transacción, porque ambos son del contenedor operaciones.)_

---

## Estado de la sesión (16/10/2026) — tramo I1

### Lo que se hizo (todo en `dynadrill-platform/libs/operaciones/inventario`, sin commits todavía)
- **Librería nueva** `@dyn/inventario` (alias en `tsconfig.base.json`, scripts `db:migrate:inventario`, `db:seed:inventario`, `db:cargar:inventario` en `package.json`, `InventarioModule` importado en `apps/operaciones/src/app/app.module.ts`).
- **3 migraciones aplicadas** en la base de desarrollo: `20261018120000_init` (catálogos `categoria_articulo`, `subcategoria_articulo`, `unidad_stock`, `motivo_movimiento`; `articulo`, `articulo_codigo`, `articulo_parte`; kardex `movimiento` con `secuencia` identity, saldo por bodega, CHECK de cantidad/saldo/origen-tipo/referencias, FK a `catalogos.bodega` e `identidad.usuario`, `REVOKE UPDATE, DELETE` a `app_operaciones` = **kardex inmutable**), `20261018121000_categoria_quimica` (`es_quimica`) y `20261018122000_categoria_lleva_partes` (`lleva_partes`).
- **Semilla** (`db:seed:inventario`): 13 unidades y 9 motivos (cada motivo fija tipo y origen; `manual` = lo que Bodega puede elegir).
- **Carga inicial** (`db:cargar:inventario`, idempotente) desde `prisma/data/inventario.json` y `descuentos.json` del `main` de la demo: 4 categorías, 28 subcategorías, **641 artículos**, **303 saldos iniciales** en Bodega Matriz, 534 descuentos sugeridos. Las listas de precios NO son de Inventario (ya las cargó Pedidos).
- **Backend**: `/api/operaciones/inventario/{articulos, articulos/:id, articulos/:id/movimientos, articulos/:id/partes, partes/:id, movimientos, stock, categorias, subcategorias, unidades, motivos, bodegas}` con los permisos ya existentes (`articulos.ver` / `articulos.gestionar`; no se agregaron permisos). Núcleo `registrarEnKardex` (bloqueo de fila del artículo, saldo por bodega, rechaza stock negativo, fecha futura, motivo/bodega inválidos). Servicio exportado `MovimientosService.registrar(tx, entrada, actor)` listo para Pumping (I2).
- **Evento publicado**: `operaciones.inventario.movimiento_registrado` (el sobre exige que el nombre empiece por el contenedor `operaciones.`; por eso **no** se usan los nombres `inventario.*` del contrato 4.1). Datos: `movimientoId, articuloId, articuloCodigo, bodegaId, tipo, origen, cantidad, saldoResultante, pedidoId, ticketId`.
- **Pruebas de integración** (`RUN_INTEGRATION=1 npx jest` en la carpeta del módulo): **18 de 18 en verde** — incluye 25 salidas simultáneas sobre 20 (salen 20, saldo 0), 30 entradas simultáneas, inmutabilidad (permission denied), CHECK de la base, altas simultáneas de partes, permisos y carga idempotente.
- **Frontend** (`dynadrill-frontend-platform/src/app/features/inventario`): modelo y servicio nuevos (`inventario-plataforma.model.ts`, `inventario-plataforma.service.ts`, con specs); reescritos lista de artículos, detalle con kardex por bodega y stock por bodega, formulario de artículo (selects de categoría/subcategoría/unidad, costo, descuento), diálogo de movimiento (bodega + motivo + cantidad, sin tipo ni responsable a mano) y diálogo de partes. **Los servicios y modelos de la demo (`ArticulosService`, `MovimientosInventarioService`, `articulo.model.ts`, partes) NO se tocaron**: los usan Pumping, FCR, Dashboard y Nuevo pedido, que siguen contra la demo hasta que migren.
- Documentación: sección `## Inventario` (IN1–IN9) en `facturacion/CONSULTAS-PARA-DYNADRILL.md`.

### Lo que falta del tramo I1 (en este orden)
1. Tomar `.bloqueos/nx.lock` y correr `npx nx run-many -t lint test build -p inventario operaciones --parallel=1`; corregir lo que salga (el módulo compila con `tsc`, pero no se ha corrido `lint` ni `build` de nx).
2. Frontend: `ng test` y `ng build` (con el bloqueo) — **no se han corrido**; los componentes nuevos no se han compilado con Angular, puede haber errores de plantilla o de tipos.
3. Reiniciar el contenedor `operaciones` (3103) y probar la pantalla a mano con un Bodeguero (lista, detalle, nuevo artículo, movimiento, partes de una categoría «FISHING & TOOLS»).
4. Confirmar que mis líneas siguen en `package.json`, `tsconfig.base.json` y `app.module.ts` (otras sesiones editan esos archivos).
5. Commit local en la rama `modulo/inventario` **sin cambiar de rama el árbol compartido** (otras sesiones trabajan en el mismo): usar un índice temporal (`GIT_INDEX_FILE`, `git read-tree`, `git add` solo de `libs/operaciones/inventario`, `git write-tree`, `git commit-tree`, `git update-ref refs/heads/modulo/inventario`). Los archivos compartidos mezclan cambios de otras sesiones: no confirmarlos enteros. Frontend: igual, solo `src/app/features/inventario`. Nada de push, ni main, ni `dynadrill-backend` / `dynadrill-frontend`.
6. Actualizar `02-CONTRATOS-ENTRE-MODULOS.md` (4.1) con los nombres `operaciones.inventario.*`.

### Lo que falta del módulo
- **I2** — contrato 4.1 con Pumping: salida de químicos al ticket (`salida_ticket`), consumo y devolución (`devolucion_ticket`), tabla `ticket_articulo` (asignada / usada / devuelta); eventos `operaciones.inventario.salida_registrada` y `.devolucion_registrada`; acordar con Pumping que llame a `MovimientosService.registrar` dentro de su transacción (propuesta). Pruebas.
- **I3** — consumir `comercial.despacho.solicitado|resuelto` (origen `despacho_bodega`), pantalla de despachos con documento de respaldo obligatorio y hoja MSDS opcional (usar `categoria.es_quimica`); hoy las pantallas `despachos` y `vehiculos` siguen contra la demo (vehículos es de Flota).
- **I4** — herramientas para FCR; conciliación con AS2 (`articulo.as2_id`) cuando Asinfo exponga productos y existencias.
- Mínimos de stock y evento `stock.bajo_minimo` (IN4), plantillas de avisos si se confirman; unidad como catálogo compartido (IN9).

### Decisiones que necesita del usuario
IN1 (bodega del saldo inicial), IN2 (unidades reales), IN3 (datos negativos del export), IN5 (quién autoriza ajustes), IN8 (categorías con partes/químicos) y D3/IN7 (fuente de verdad con AS2). Ver `facturacion/CONSULTAS-PARA-DYNADRILL.md`, sección Inventario.

### Notas técnicas para quien continúe
- La primera `prisma migrate deploy` de un schema nuevo falla con «migration persistence is not initialized»: crear a mano `<schema>._prisma_migrations` (mismo DDL que `pumping._prisma_migrations`) y repetir.
- En Bash, los *heredocs* largos fallan: usar la herramienta de escritura. Los `.ts`/`.html` del frontend tienen CRLF: al editar por script, normalizar y restaurar.
- Las rutas en las pruebas llevan el prefijo global `/api`.

## Hallazgos de la revisión de base de datos (17/10/2026): pulir antes de seguir

Revisado sobre las migraciones `20261018120000_init`, `20261018121000_categoria_quimica` y `20261018122000_categoria_lleva_partes`. El kardex inmutable, la FK compuesta de subcategoría y los CHECK de origen y tipo están bien: manténgalos.

1. **`movimiento.tipo` y `movimiento.origen` repiten lo que ya determina `motivo_id`.** Elija una sola fuente: (a) quitar `tipo` y `origen` de `movimiento` y obtenerlos del motivo con JOIN, o (b) mantenerlos pero garantizar la coherencia con una FK compuesta `(motivo_id, tipo, origen)` hacia un índice único de `motivo_movimiento`, en lugar de un CHECK duplicado. Justifique la elección en el plan.
2. **`pedido_id` y `ticket_id` sin FK** (decisión D1). Está permitido por ser de otro contenedor, pero la decisión D1 debe cerrarse; mientras tanto, pruebe que un movimiento de salida de ticket sin `ticket_id` es rechazado (ya hay CHECK) y que el consumidor del evento no duplica.
3. **La migración `20261018122000` decide por el texto del nombre de la categoría** (la que se llama FISHING & TOOLS). Es lo que la regla 3 prohíbe: mueva esa asignación a la semilla (idempotente) y, en el código, use siempre `lleva_partes` y `es_quimica`, nunca el nombre.
4. **Cargas pendientes:** `articulo_parte` y `articulo_codigo` están vacíos. Cargue las partes de las herramientas y los códigos alternos desde los datos reales de `prisma/data/` de la demo; si esos datos no los traen, documente la consulta a Dynadrill.
5. **`unidad_stock`:** decida si es dato maestro compartido (entonces debe vivir en `catalogos`, con una migración coordinada por el registro) o propio de Inventario; anote la decisión.
6. **`as2_id`** (conciliación con AS2): índice único hoy sin uso; documente cuándo se llena o retírelo.
7. **Auditoría:** `articulo_codigo` no tiene auditoría; agréguela o justifique.
8. **Stock:** confirme con una prueba que el stock calculado por bodega es la suma de movimientos y que 25 salidas simultáneas no dejan saldo negativo (bloqueo de fila).
9. **Servicio y eventos:** exporte `registrarSalida`, `registrarEntrada`, `registrarConsumo`, `registrarDevolucion` y `stockDe`, y consuma `comercial.despacho.solicitado|resuelto` (el segundo ya trae `archivoRespaldoId` y `archivoMsdsId` desde el 17/10); consumidores idempotentes.

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


---

## Respuesta a la revisión de base de datos (17/10/2026)

Migraciones nuevas (sin editar las aplicadas): `20261019120000_pulir_revision_bd` y `20261019121000_ver_id_de_archivos`. Pruebas de integración: **31 de 31 en verde**; `eslint` del módulo sin hallazgos (`nx lint`/`build` pendientes por el bloqueo).

| # | Hallazgo | Qué se hizo |
|---|---|---|
| 1 | `tipo`/`origen` repetidos en `movimiento` | **Opción (b).** Se conservan en el movimiento porque las reglas del kardex (saldo, referencias) dependen de ellos y no deben cambiar nunca, pero la base garantiza la coherencia con una **FK compuesta** `(motivo_id, tipo, origen)` → `UNIQUE (id, tipo, origen)` de `motivo_movimiento` (`ON UPDATE RESTRICT`: un motivo con movimientos no puede cambiar de tipo ni de origen). Se retiró el CHECK duplicado `movimiento_origen_tipo_check` y la FK simple del motivo. Probado. La opción (a) obligaba a un subselect dentro del CHECK de referencias, que PostgreSQL no permite. |
| 2 | `pedido_id`/`ticket_id` sin FK | El ticket es del **mismo servidor**, así que ya no es un uuid suelto: `movimiento.ticket_pumping_id` (FK a `pumping.ticket`) y `consumo_ticket.ticket_pumping_id` (FK). FCR agregará su columna `ticket_fcr_id` (cuando exista su schema) y cambiará el CHECK a `num_nonnulls(...) = 1`. El **pedido** ya no se guarda en el movimiento: el despacho (`inventario.despacho`) lo guarda una sola vez, y es el único uuid sin FK (otro contenedor, comercial; D1) con COMMENT que lo dice. CHECK de referencias en ambos sentidos (salida/devolución de ticket ⇔ ticket; despacho a bodega ⇔ despacho; el resto, sin referencia). Pruebas: salida de ticket sin ticket, ticket o despacho inexistentes, referencia donde no corresponde, y el consumidor de despachos **no duplica** con el evento repetido. |
| 3 | La migración `…122000` decide por el nombre de la categoría | Esa migración ya está aplicada y no se edita. El criterio quedó así: el **código** usa siempre `es_quimica` y `lleva_partes` (nunca el nombre; hay una prueba con una categoría que no se llama «QUIMICA»), y la asignación a las categorías base se hace en la **semilla** (`marcarCategoriasBase`, idempotente: solo enciende lo apagado) y en la carga inicial. El nombre aparece solo ahí, que es dato, no comportamiento. |
| 4 | `articulo_parte` y `articulo_codigo` vacíos | **Partes cargadas: 914 partes de 48 herramientas** (registro de inspección y reparación de Dynadrill, `prisma/data/herramientas.seed-data.ts` del `main` de la demo). Esas 48 herramientas **no están** en el export de AS2 (ni por código ni por nombre): se cargaron como artículos de la categoría `HERRAMIENTAS` con su propio código, sin existencias (consulta **IN10**). **Códigos alternos/comerciales/de barras: ningún dato real los trae** (ni `inventario.json` ni las listas); se documenta como consulta **IN11** y la pantalla ya permite capturarlos. |
| 5 | `unidad_stock` ¿catálogo compartido? | **Propia de Inventario por ahora** (COMMENT en la tabla). Razón: las listas de precios y AS2 traen unidades como texto sin equivalencia confirmada (consulta C11 a Asinfo / IN9); moverla a `catalogos` exige una migración coordinada con plataforma y con comercial y sin esa equivalencia sería prematuro. Si se confirma, se migra con una sola migración. |
| 6 | `as2_id` sin uso | **Se conserva**, con COMMENT: se llena cuando Asinfo exponga productos (B6, IN7); mientras tanto se concilia por `codigo`, que ya es el código de producto de AS2. |
| 7 | `articulo_codigo` sin auditoría | Agregados `created_at/by`, `updated_at/by` (FK a `identidad.usuario`); el servicio los llena. Probado. |
| 8 | Stock por bodega = suma; 25 salidas simultáneas | Probado (ya estaba y se ampliaron): suma por bodega = saldo de cada bodega; 25 salidas sobre 20 → salen 20 y el saldo queda en 0; 30 entradas simultáneas; 10 salidas simultáneas del mismo ticket sobre 6. |
| 9 | Servicio exportado y consumo de eventos | `MovimientosService` exporta `registrarEntrada`, `registrarSalidaManual`, `registrarSalida`, `registrarConsumo`, `registrarDevolucion`, `registrarSalidaDespacho`, `balanceDeTicket`, `stockDe` (todos reciben la `tx` de quien llama). **Consumo** = tabla `consumo_ticket`, inmutable, que no mueve stock; asignado/devuelto no se guardan: se calculan del kardex. Se consumen `comercial.despacho.solicitado|resuelto` (`DespachosConsumer`, inbox idempotente, ignora sin error lo inválido) hacia `inventario.despacho` (con `archivo_respaldo_id` y `archivo_msds_id` con FK a `archivos.archivo`, CHECK de estado). Contrato 4.1 reescrito y vigente. |

### Estándar de calidad: verificación punto por punto

1. **Sin duplicados:** nombres por JOIN; `pedido_id` solo en `despacho`; `tipo/origen` del movimiento garantizados por FK compuesta (justificación arriba). 2. **Ids con FK:** todo id del mismo servidor tiene FK (ticket, despacho, archivos, usuarios, bodega); el único sin FK es `despacho.pedido_id` (comercial), con COMMENT. 3. **Catálogos:** categoría, subcategoría, unidad y motivo son tablas; origen/tipo/estado son enums; ningún comportamiento depende de un nombre. 4. **Integridad en la base:** CHECK de cantidad, saldo, referencias, estado del despacho; FK compuestas (subcategoría de la categoría; motivo-tipo-origen). 5. **Historia inmutable:** `movimiento` y `consumo_ticket` sin UPDATE ni DELETE para `app_operaciones` (probado). 6. **Auditoría:** todas las tablas editables. 7. **Permisos mínimos:** `SELECT` solo de `catalogos.bodega`, de `identidad.usuario (id, nombre, email, activo, rol_id)`, `identidad.rol (id, codigo, nombre)` y `archivos.archivo (id)`; no se lee ningún dato personal más. 8. **Una migración por cambio:** sin editar las aplicadas; los datos van en la semilla y la carga. 9. **Backend:** servicios pequeños, DTO validados, errores en español con código, transacción única con outbox, consumidor idempotente. 10. **Pruebas:** violan CHECK, FK y REVOKE y esperan el rechazo.

### Dependencia de migraciones (para `infra:reset` o una base nueva)
`20261019120000_pulir_revision_bd` tiene FK a `pumping.ticket` y a `archivos.archivo`: aplicar **antes** `db:migrate:pumping` y `db:migrate:archivos`. Orden: archivos → pumping → inventario.

### Pendiente (sin cambios) del módulo
`ng test`/`ng build`, `nx lint`/`build`, reinicio de `operaciones`, commit local; pantalla de despachos de Inventario (hoy sigue la de comercial/demo); FCR (I4); mínimos de stock (IN4).

### Verificación del 17/10/2026
- Backend: `nx lint build -p inventario operaciones` en verde; 31 de 31 pruebas de integración.
- Frontend: `ng test` de `features/inventario` en verde (12 pruebas). `ng build` **no pudo validar mis plantillas**: se detiene en un error de Flota (`features/flota/pages/unidad-detail-page/unidad-detail-page.html` no existe todavía); repetirlo cuando Flota lo cree.
- Siguen pendientes: reinicio del contenedor `operaciones` y prueba a mano, commit local, `nx test` completo y la pantalla de despachos de Inventario.
