# Plan: Inventario

**Schema:** `inventario` · **Contenedor:** operaciones (3103) · **Librería:** `libs/operaciones/inventario` (`@dyn/inventario`) · **Prefijo HTTP:** `/api/operaciones/inventario`
**Estado:** por construir · **Ola:** 1 (es el más pequeño; Pumping y FCR lo necesitan)
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
