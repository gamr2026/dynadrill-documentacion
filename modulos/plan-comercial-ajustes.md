# Plan: Ajustes al módulo de Pedidos (comercial) según el `main` de la demo

**Schema:** `comercial` · **Contenedor:** comercial (3102) · **Librería:** `libs/comercial/pedidos` (ya existe) · **Dueño:** la sesión principal (Pumping/Comercial)
**Estado:** EN CURSO (ver `ESTADO-SESION-PRINCIPAL.md`: C1–C8 hechos en backend; faltan el frontend, C9 y C10) · **Ola:** 2 (Pumping restante y FCR dependen de partes de esto)
**Origen:** `04-REVISION-CONTRA-DEMO-MAIN.md` (hallazgos 5, 6, 11). Fuentes en la demo `main`: `dynadrill-backend/libs/domains/facturacion/*` (en especial `facturacion-domain.service.ts`, `pedidos/solicitudes-despacho-bodega.controller.ts`, `precarga-fcr/`) y `operaciones/src/ticket-prefactura.controller.base.ts`; frontend: `features/facturacion/*` y los commits del 02 al 07/10/2026.

El módulo de Pedidos ya está construido en el portal nuevo (pedido, documentos operativos, prefactura, guía, orden de trabajo, cierre). La demo `main` agregó comportamientos que **cambian el contrato con Pumping y FCR**. Este plan los lista.

## 1. Cambios (con su estado)

| # | Cambio | Detalle en la demo `main` | Qué hay que hacer en el portal nuevo | Estado |
|---|---|---|---|---|
| C1 | **Tipo de línea del pedido** | Las líneas estimadas son `servicio`, `material` («Químico» de Inventario se muestra y clasifica como Material), `herramienta` (FCR) o **`movilización`**. La movilización se carga con su propio tipo, con código y precio de la lista de precios (precio fijo solo si es el pactado con el cliente); se reconoce en la lista por la descripción («moviliz»). Se quitó la «cantidad fija» | Agregar a `pedido_item` una columna `tipo_linea` (enum `servicio`, `material`, `herramienta`, `movilizacion`) y exponerla; el evento `comercial.pedido.abierto` debe poder llevar las líneas (o un servicio HTTP de consulta) para que FCR arme su precarga | Por hacer |
| C2 | **Alta rápida y baja de pozo, taladro y personas desde el pedido** | `catalogosWrite` incluye a Ingeniería de Ventas; los botones del select solo aparecen con permiso de catálogos | Dar a `ingenieria_ventas` los permisos `catalogos.ubicacion.crear/editar/inactivar` y `catalogos.personas.*` (hoy `catalogosWrite` es solo de administradores). **Decisión D15**: cambia permisos de otro módulo | Pendiente de decisión |
| C3 | **Documentos operativos: corrección por Facturación** | Facturación corrige el **Reporte Job de Pumping** (actividades y tablas) y el de **FCR** por día; solo **mientras el pedido no haya salido al cliente para firmas** (`rechazado_por_cliente` sí permite); el push de cada día es **idempotente**; tras la corrección el ticket **no puede reenviar** ese día | Endpoint `PUT /api/comercial/pedidos/:id/documentos-operativos/dia` (reemplaza actividades y tablas de un día; una lista vacía quita el día); regla de estado del pedido; columna `corregido_por_facturacion_at` + `corregido_por` (FK) en el documento; ya existe el reemplazo por clave (pedido, tipo, origen, fecha). Permiso nuevo `comercial.documentos_operativos.corregir` (hoy: Facturación y administradores) | Por hacer |
| C4 | **Documentos operativos con tablas** | El Reporte Job de Pumping trae **tablas** dentro de cada actividad (encabezados y filas) | `documento_operativo_actividad_tabla` (+ columnas y filas en tablas hijas, sin JSON); revisar si el modelo actual de actividades ya las tiene | Por verificar |
| C5 | **«Ver prefactura» desde el ticket** | El Supervisor ve la prefactura vigente o, si no existe o fue rechazada, una **preliminar calculada al vuelo** con lo cotizado y los documentos generados hasta el momento (sin guardarla ni cambiar el estado), con los documentos de respaldo | `GET /api/comercial/pedidos/:id/prefactura-vista` (permiso `prefacturaTicket`: Supervisor y Supervisor Pumping) | Por hacer |
| C6 | **Firma del Company Man desde el ticket, antes de finalizar** | El Supervisor sube el documento firmado por el Company Man en la etapa final del ticket; solo cuando la documentación está completa. La prefactura queda **firmada** (el pedido pasa a `ticket_firmado`, ya se puede generar la orden de trabajo); si no existía se genera en ese momento; si ya estaba generada se recalcula con los datos actuales | `POST /api/comercial/pedidos/:id/prefactura/firma-company-man` (archivo FK a `archivos.archivo`, módulo `prefactura_documento`). Reutiliza el registro de firmas que ya existe | Por hacer |
| C7 | **Prefactura al cerrar el ticket** | Al cerrarse el ticket (Pumping aprobado / FCR cerrado) la prefactura se genera sola si la documentación de respaldo está completa y aún no existe; si no se puede, se omite sin fallar el cierre | Consumidor de `operaciones.pumping.cerrado` y `operaciones.fcr.cerrado` (contrato 4.10) que llama a la generación existente | Por hacer (depende de Pumping/FCR restante) |
| C8 | **Despacho a Bodega con documento de respaldo y MSDS** | Bodega adjunta el **documento de respaldo** (obligatorio) y, si despacha químicos, la **hoja MSDS** (opcional) | En el despacho, `archivo_respaldo_id` (obligatorio) y `archivo_msds_id` (opcional), FK a `archivos.archivo`; el evento `comercial.despacho.resuelto` los lleva | Por hacer |
| C9 | **Descargar PDF de todos los documentos del pedido** | Botón en el frontend | Frontend (hojas imprimibles con `window.print()`) | Por hacer |
| C10 | **Plantillas de ejemplo (Pumping y FCR) en «Nuevo pedido»** | Excel de ejemplo con química/herramientas | Frontend y plantilla | Por hacer |
| C11 | **Fechas del servicio para FCR** | La bitácora de FCR no se sale de las fechas de inicio y fin del servicio del pedido | Ya existen `fecha_inicio_servicio` y `fecha_fin_servicio`; FCR las recibe en el evento de apertura | Hecho (confirmar el evento) |

## 2. Contratos que cambian (ver `02-CONTRATOS-ENTRE-MODULOS.md`)

4.4 (documentos operativos y su corrección), 4.10 (prefactura desde el ticket) y 4.11 (Acta de Entrega de Locación y cierre).

## 3. Pruebas

Integración: la corrección de Facturación respeta el estado del pedido; el push idempotente por día no duplica y no sobrescribe una corrección; la vista preliminar no cambia el estado; la firma del Company Man con documentación completa deja `ticket_firmado`; despacho sin respaldo se rechaza.

## 4. Consultas para Dynadrill (`documentacion/facturacion/CONSULTAS-PARA-DYNADRILL.md`)

- ¿Ingeniería de Ventas puede dar de baja (inactivar) pozos, taladros y personas, o solo agregarlos? (la demo permite ambos).
- ¿Quién gestiona la firma del Company Man cuando el ticket es de FCR?
- ¿El Acta de Entrega de Locación debe estar para generar la prefactura o solo para cerrar el ticket? (la demo la exige solo para cerrar).

## 5. Puntos de choque

Es de la sesión principal. Si otra sesión necesita algo de aquí (FCR: líneas por tipo; QHSE: el Acta), lo pide por el registro.

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
