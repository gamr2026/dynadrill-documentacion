# Inventario: copias de nombre y ids sin FK entre schemas

Fecha: 16/10/2026. Estado: **aprobado y ejecutado el 16/10/2026** (migraciones `20261017120000_normalizar_con_fk` en comercial, `20261017130000_normalizar_con_fk` en pumping y `20261017140000_normalizar_con_fk` en avisos). Ver la desviación 48 de `PROPUESTA-DESARROLLO-F0-F1.md`.

## Decisión aprobada

La regla "sin FK entre schemas" se retira para las tablas maestras (`catalogos` e `identidad`), como se hace en `nuevo-portal` (una base, un schema por dominio, FK reales y JOIN a `auth.users` y demás maestras). Los módulos guardan solo el id con su FK y el nombre se obtiene con JOIN. La copia del nombre se conserva únicamente en documentos ya emitidos (prefactura, guía, orden de trabajo), que deben mostrar lo que decían al emitirse.

Requisitos técnicos:

- `SELECT` (solo lectura) de `app_comercial`, `app_operaciones` y `app_plataforma` sobre las tablas de `catalogos` e `identidad` que necesiten.
- Las FK las crea la migración con el rol `dyn_migrator`. Los datos existentes se validan antes (ids huérfanos).
- Prisma: los modelos de catálogo se declaran de solo lectura en el schema del módulo que los consulta, o se usa consulta SQL con JOIN.

## 1. Columnas que se eliminan (dato vivo: el nombre sale del JOIN)

### `comercial.pedido`

| Columna que se elimina | Id que queda (pasa a FK) | Tabla maestra |
|---|---|---|
| `cliente_nombre`, `cliente_ruc` | `cliente_id` | `catalogos.cliente` |
| `campo_nombre` | `campo_id` | `catalogos.campo` |
| `bloque_nombre` | `bloque_id` | `catalogos.bloque` |
| `pozo_nombre` | `pozo_id` | `catalogos.pozo` |
| `taladro_nombre` | `taladro_id` | `catalogos.taladro` |
| `agente_comercial_nombre` | `agente_comercial_id` | `identidad.usuario` |
| `representante_campo_nombre` | `representante_campo_id` | `identidad.usuario` |
| `representante_quito_nombre` | `representante_quito_id` | `identidad.usuario` |
| `tecnico_hse_nombre` | `tecnico_hse_id` | `identidad.usuario` |
| `analista_facturacion_nombre` | `analista_facturacion_id` | `identidad.usuario` |
| `despacho_solicitado_nombre`, `despacho_realizado_nombre` | ids de quien solicitó y realizó | `identidad.usuario` |
| `condicion_pago` (texto) | `condicion_pago_id` | `catalogos.condicion_pago` |
| `zona` (texto) | `zona_id` | `catalogos.zona` |
| `bodega` (texto) | `bodega_id` | `catalogos.bodega` |

Además, `comercial.lista_precios.cliente_nombre` y `comercial.documento_operativo.supervisor_nombre` / `operador_nombre` (con sus ids).

### `pumping.ticket`, `ticket_persona`, `ticket_historial`

| Columna que se elimina | Id que queda | Tabla maestra |
|---|---|---|
| `cliente_nombre`, `cliente_ruc` | `cliente_id` | `catalogos.cliente` |
| `campo_nombre`, `bloque_nombre`, `pozo_nombre`, `taladro_nombre` | ids respectivos | `catalogos.*` |
| `ticket_persona.usuario_nombre` | `usuario_id` | `identidad.usuario` |
| `ticket_unidad.placa`, `descripcion` | `vehiculo_id` | `catalogos.vehiculo` |
| `ticket_historial.actor_nombre`, `actor_rol` | `actor_id` | `identidad.usuario` |

### `avisos`

`correo_aviso.destinatario_nombre` y `destinatario_correo`: se reemplazan por `usuario_id` con FK a `identidad.usuario`.

## 2. Se conserva la copia (documento emitido)

| Tabla | Columnas | Motivo |
|---|---|---|
| `comercial.prefactura` y sus ítems | nombres y valores al emitir | documento firmado y enviado |
| `comercial.guia_remision` | `cliente_nombre`, `transportista_nombre`, `chofer_nombre`, `solicitado_por_nombre`, `despachado_por_nombre` | documento legal (SRI); debe verse como se emitió. Se mantienen además los ids con FK |
| `comercial.orden_trabajo` | `contratista_nombre`, `cliente_nombre` | documento firmado |
| `comercial.guia_firma_digital` | `firmante_nombre` | dato leído del certificado, no del catálogo |
| `*archivo*_nombre` | nombre del archivo | dato del archivo cargado |
| `comercial.proceso_historial.actor_rol` | rol con el que actuó | dato histórico (la persona puede cambiar de rol). El nombre sale del JOIN con `actor_id` (FK) |

## 3. Eventos

Los eventos (`comercial.pedido.abierto`, `operaciones.pumping.*`) hoy llevan nombres para armar tickets y avisos. Con FK, el evento llevaría ids y los consumidores obtienen el nombre con JOIN. Los avisos conservan los datos ya renderizados en el texto del correo y la campanita.

## 4. Orden propuesto

1. Migración de datos: verificar ids huérfanos y completar los que falten en `comercial` y `pumping` (hoy la base de pruebas está vacía de pedidos, así que no hay datos que migrar).
2. Permisos `SELECT` entre schemas.
3. Agregar las FK y quitar las columnas `*_nombre`.
4. Ajustar servicios, DTO, pantallas y eventos; actualizar las pruebas de integración.
5. Pruebas completas (pedidos, Pumping, avisos, catálogos) y revisión del front.

## 5. Riesgos

- Cambia el contrato de los eventos entre contenedores: se hace de una vez en comercial, Pumping y avisos.
- El frontend usa los nombres del pedido; las respuestas de la API seguirán trayendo el nombre (calculado con JOIN), así que las pantallas no cambian.
- Quien renombre un cliente, un campo o una persona verá el cambio reflejado en los pedidos abiertos (es el comportamiento deseado).

## 6. Resultado

- Se aplicó lo del inventario. Además, las columnas de quién hizo qué (`*_por`, `emitido_por`, `subido_por`, `actor_id`, `recibido_por`) de comercial y Pumping pasaron a FK a `identidad.usuario`.
- Las columnas `solicitado_por_id` y `despachado_por_id` de la guía no se usaban y se eliminaron (la guía conserva el nombre impreso).
- La lista de precios sin cliente (la de referencia interna) perdió su etiqueta `cliente_nombre`; la demo la conserva por si se quiere un campo `nombre` propio en la lista.
- Pendiente: FK de `created_by`/`updated_by` en todas las tablas y de `archivo_id` hacia `archivos.archivo`.
