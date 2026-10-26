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

## Pendiente (decisión o trabajo posterior)

- **Texto que no admite vacío:** unas 250 columnas de texto obligatorias aceptan cadenas vacías. Propuesta: un `DOMAIN texto_no_vacio` para nombres y códigos.
- **`comercial.pedido` tiene 52 columnas, 16 con prefijo `as2_`.** Propuesta: sacarlas a una tabla 1:1 `pedido_as2`.
- **Unidad como texto en tres tablas de ítems:** `guia_remision_item`, `orden_trabajo_item` y `prefactura_item` quedaron fuera de CM-4. O son copia del documento emitido (entonces se documenta con un comentario) o pasan a FK.
- **Pumping y FCR duplican 15 tablas del motor de flujo** (`paso`, `transicion`, `requisito`…). Es consecuencia de la independencia entre contenedores; se deja hasta que aparezca un tercer flujo.
- **Datos de AS2 en `inventario.articulo_parte`:** hay códigos de relleno («---------», vacío, «Not Required») y 30 pares repetidos dentro del mismo artículo. Se necesita el criterio de Dynadrill antes de limpiarlos.
- **Unas 125 tablas sin comentario** y 15 columnas `uuid` terminadas en `_id` sin FK ni comentario.
- **Extensiones:** solo `plpgsql`. Valen `pg_trgm` para las búsquedas con `ILIKE '%q%'` y `pg_stat_statements` para medir.

## Regresión que apareció durante la auditoría

Mantenimiento seguía leyendo `origen` y `destino` de texto del reporte de unidad de Pumping, columnas que OP-4 reemplazó por FK a bodega o pozo. Se corrigió el espejo de Prisma y el servicio, y quedó en 48 de 48 pruebas.

## Verificación

Suite de integración completa (25 proyectos) en verde, con Flota en 77 de 77 tras hacer que sus pruebas creen sus propias unidades en vez de depender de las de la demo.
