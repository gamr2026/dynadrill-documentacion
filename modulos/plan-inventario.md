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
