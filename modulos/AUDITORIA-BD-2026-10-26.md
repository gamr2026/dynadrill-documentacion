# Auditoría de la base de datos (26/10/2026)

Se revisó la base `dynadrill` (20 esquemas, unas 400 tablas) con consultas sobre el catálogo de PostgreSQL. Las consultas no cambian datos.

## Lo que está bien

- Todas las tablas tienen clave primaria.
- No hay `timestamp` sin zona horaria, `float` ni `money`; todo `numeric` tiene precisión.
- No hay índices duplicados ni enums sin uso.
- Cada rol de aplicación escribe solo en los esquemas de su contenedor.
- Las tablas de mensajes (`outbox`) tienen índices parciales para lo pendiente.

## Hallazgos y qué se hizo

| # | Hallazgo | Acción |
|---|---|---|
| 1 | Borrar un padre arrastraba en cascada historia que la aplicación no puede borrar directamente: `ticket_persona` → `aceptacion_terminos`, `ticket_unidad` → `reporte_unidad` (ambos de Pumping) y `prefactura_item` → `prefactura_rechazo_item` | FK a `RESTRICT`; reasignar un ticket con términos aceptados o reportes firmados responde 409 `ASIGNACION_CON_REGISTROS` |
| 2 | 166 FK relacionales sin índice (de 544 sin índice; 378 son de auditoría `created_by`, `updated_by`… y no se indexan) | 41 índices en 10 contenedores (`…_indices_de_fk_relacionales`) |
| 3 | Nombres de catálogo sin unicidad | Casi todo era falso positivo: el `codigo` ya es único o clave primaria. Solo se agregó la unicidad del criterio de inspección por tipo |
| 5 | `pumping.ticket_historial` permitía UPDATE a la aplicación (el de FCR no) | `REVOKE UPDATE, DELETE` |

## Segunda tanda (misma fecha)

| Hallazgo | Acción |
|---|---|
| Cuatro columnas `uuid` del mismo contenedor sin FK: `guia_remision.emision_id`, `orden_trabajo.emision_id`, `orden_trabajo.prefactura_id`, `pedido.ticket_emision_id` | FK (y su índice). No había filas huérfanas |
| Unas 250 columnas de texto aceptaban cadenas vacías | 138 `CHECK (length(btrim(col)) > 0)` en nombres, códigos, títulos, descripciones y motivos obligatorios, en los 15 esquemas. Se excluyó `inventario.articulo_parte.codigo` porque tiene 5 códigos vacíos que vienen de AS2 |
| `uuid` sin FK ni comentario | Comentadas las que son referencia a otro contenedor, polimórfica o a un sistema externo (D1). La única FK que falta a propósito dentro de operaciones es `inventario.salida_mantenimiento.suborden_repuesto_id`: la dependencia va de Mantenimiento hacia Inventario |
| Unidad como texto en `prefactura_item`, `guia_remision_item`, `orden_trabajo_item` | Se conserva: es copia del documento emitido, que no debe cambiar si se renombra la unidad. Quedó documentado con comentarios en la base |

Verificación: suite de integración completa (25 proyectos) en verde. Las pruebas de Comercial ahora crean emisiones reales y limpian en el orden de las FK.

## Tercera tanda (27/10/2026)

- **Códigos de relleno en `inventario.articulo_parte`:** no venían de AS2 sino del Excel del cliente con el registro de inspección y reparación de herramientas (48 herramientas, 914 partes), cargado desde `prisma/data/herramientas.seed-data.ts`. Los valores «---------», vacío, «Not Required», «N/A» y «No#--» (113 filas) significan «la parte no tiene código»: la columna pasó a admitir `NULL`, esas filas quedaron en `NULL` y el archivo de carga también se corrigió. Los 22 códigos que se repiten dentro de una herramienta son piezas iguales en varias posiciones (por ejemplo, o-rings), no errores: no se exige unicidad y la posición de la parte es (`articulo_id`, `orden`). El CHECK de texto no vacío ahora cubre también esta columna (`NULL` permitido).
- **`pedido_as2`:** se decidió mantener las columnas `as2_` en `pedido` por ahora.

## Pendiente (decisión o trabajo posterior)

- **`comercial.pedido` tiene 52 columnas, 16 con prefijo `as2_`.** Decisión del 27/10/2026: mantenerlas así por ahora; si se separan, sería una tabla 1:1 `pedido_as2`.
- **Pumping y FCR duplican 15 tablas del motor de flujo** (`paso`, `transicion`, `requisito`…). Es consecuencia de la independencia entre contenedores; se deja hasta que aparezca un tercer flujo.
- **Unas 125 tablas sin comentario.**
- **Extensiones:** solo `plpgsql`. Valen `pg_trgm` para las búsquedas con `ILIKE '%q%'` y `pg_stat_statements` para medir.

## Regresión que apareció durante la auditoría

Mantenimiento seguía leyendo `origen` y `destino` de texto del reporte de unidad de Pumping, columnas que OP-4 reemplazó por FK a bodega o pozo. Se corrigió el espejo de Prisma y el servicio, y quedó en 48 de 48 pruebas.

## Verificación

Suite de integración completa (25 proyectos) en verde, con Flota en 77 de 77 tras hacer que sus pruebas creen sus propias unidades en vez de depender de las de la demo.
