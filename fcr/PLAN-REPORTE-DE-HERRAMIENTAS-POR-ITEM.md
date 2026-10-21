# Plan: el Reporte de Herramientas de FCR se arma por ítem de la lista de precios

> Creado el 21/10/2026 a pedido del usuario. Cambia cómo FCR arma el Reporte de Herramientas (DYN-FCR-RE-008) y cómo ese reporte
> gobierna la guía de remisión, la prefactura y la orden de trabajo (OT).

## 1. Lo que se verificó en los soportes

Se revisaron los seis libros de Excel de ejemplo (`COMP. 4130`, `CTU 3870`, `FISHING 3833`, `4368_ARMB-003`, `4412 SHSD-104`, `4426 SCHG-275`) y los PDF de los cuatro servicios en `SOPORTES EJEMPLO`:

1. **Cada fila del reporte es un código de la lista de precios (LP) del cliente.** El código, la descripción y la unidad salen de la LP; la columna «SERIE #» lleva las series o el equipo que la prestó.
2. **La cantidad de cada fila sale del reporte, no de la cotización.** En la pestaña TICKET (la prefactura) la columna `CANTIDAD` es `='Reporte de Htas.'!AM<fila>` (el total de la fila); código, descripción, unidad y precio salen de la LP por `VLOOKUP`. El precio total es `ROUND(cantidad × precio, 2)`.
3. **La OT sale de la prefactura.** La hoja `OTQ` (Orden de trabajo / Resumen de costos) toma el código y la cantidad de las mismas filas del TICKET; el valor de la OT es la suma. Si el reporte baja, la prefactura y la OT bajan igual.
4. **Dos formas del reporte.** (a) Formato anterior: una marca por día (`O` operación, `D` daily charge, `V` venta); el total es `O + D + V` (`=SUM(AJ:AL)`). (b) «Resumen por ítem» (ticket 4412, 4368, CTU 3870): una cantidad por actividad o día, con columnas `TOTAL` y `TICKET`; sirve para km, pies, galones, horas y unidades fraccionadas (0,625 + 0,375 = 1 unidad).
5. **El stand-by (`S`) no se usa.** Existe en la leyenda del formato, pero no aparece ni una sola vez en las marcas de los seis libros y nunca entra en la suma. El backend nuevo hoy lo cobra como renta: **cambia** (no se cobra).
6. **Lo cotizado puede diferir.** `PASOS DEL PROCESO.txt` (paso 5) describe el caso de «solo trabajaron 3 días y se cobró 4»: el valor real manda y el pedido se actualiza después de verificar con el cliente. Si se pasa del presupuesto «no pasa nada»: el cliente autoriza la prefactura con los soportes.

## 2. Decisiones del usuario (21/10/2026)

- Las filas del reporte **salen de la LP del cliente**, no de lo cotizado. El pedido (la cotización) se actualiza con lo real: cantidades distintas y también ítems agregados o quitados, **con la autorización del Supervisor** (como la demo, donde el Operador propone).
- La selección de herramientas **se mantiene**, pero deja de ser la fuente del reporte: sirve para los demás documentos (inspección de herramientas, registro de completación/picker, retorno) y para proponer la serie de cada fila.
- La guía de remisión, la prefactura y la OT usan los códigos y descripciones de la LP; sus cantidades siguen al reporte.
- Cada fila lleva su **campo cantidad** (real). Las filas por día usan marcas; las demás, la cantidad escrita.

## 3. Modelo

**FCR** (nuevas tablas, sin JSON):
- `fcr.reporte_item` — una fila del reporte: `ticket_id`, `orden`, `codigo`, `descripcion`, `unidad` (copias imprescindibles de la LP: FCR no lee la base de Comercial), `por_dia` (la unidad es de tiempo), `cantidad` (solo si no es por día), `serie`.
- `fcr.reporte_item_dia` — marca de un día de una fila por día: `fecha` y `estado` (`operacion`, `daily_charge`, `venta`; sin stand-by).
- Cantidad total de la fila: por día = número de marcas; si no, `cantidad`.
- `UsoHerramientaDia` y `TicketHerramienta` no cambian (siguen para inspección, picker, retorno).

**Evento** `operaciones.fcr.reporte_herramientas_completado`: cada ítem lleva `codigo`, `nombre` (descripción), `unidad`, `serie`, `cantidad` total y, si es por día, `usos`.

**Comercial**: `documento_operativo_herramienta` suma `unidad` y `cantidad`. La prefactura arma **una línea por fila** con esa cantidad real (precio y tipo de la LP). La guía sugiere sus ítems desde el reporte. La OT ya sale de la prefactura.

## 4. Fases

- **A. FCR backend:** tablas, servicio y endpoints del reporte por ítem; la finalización envía el evento nuevo; el listado confirmado pasa a ser el del reporte.
- **B. Comercial:** consumir el evento nuevo; prefactura y guía con la cantidad real; sin stand-by.
- **C. Cotizado ← real (FCR):** propuesta de cambio de ítems del Operador con aprobación del Supervisor, aplicada por Comercial (como en Pumping, contrato 4.13); recalcula la prefactura generada.
- **D. Frontend:** el editor del reporte en el ticket de FCR (buscador de la LP, marcas por día, cantidad), la hoja imprimible DYN-FCR-RE-008 con ese formato y las pantallas de Facturación.

## 5. Pendientes que no decide este plan

- ¿Un ítem de la LP con cantidad mayor a la cotizada necesita autorización antes de reportarse o solo al enviar la propuesta de cambio? (Propuesta: se reporta libre; el cambio del pedido lo autoriza el Supervisor al finalizar.)
- El reporte «Resumen por ítem» reparte la cantidad por actividad: aquí se registra por día (las actividades ya están en el Reporte Job).

## 6. Avance

- **A. FCR backend — hecho** (`80b42b7`, fcr 102/102): tablas, servicio y endpoints; finalizar envía el evento nuevo.
- **B. Comercial — hecho** (`9e62ae7`): prefactura con la cantidad real, guía desde el reporte, sin stand-by; pruebas de prefacturas (36), guías (10), documentos operativos y OT en verde.
- **C. Cotizado ← real — hecho** (backend `e4d84c4` FCR y `4f29a2b` Comercial): cambio de ítems de FCR portado de Pumping, con aprobación del Supervisor.
- **D. Frontend — en curso.** Hecho: editor del reporte por ítem (`d0931d0`), cambio de ítems en el ticket con los diálogos de Pumping generalizados (`6c0b2ce`), página del ticket con el layout de la demo —avance lateral, banner de turno, secciones— (`dde0a14`), paneles con el estilo de la demo, herramientas visibles en «Tipo de operador» y el avance sin pasos de servicios en venta (`f3573be`, `e70d914`). **Falta:** la hoja imprimible DYN-FCR-RE-008 por ítem y el visor de «Documentos de respaldo» de Facturación (todavía arman el reporte con los datos antiguos), y el aspecto de los diálogos del reporte de herramientas dentro de Ejecución (no se pudo recorrer en pantalla porque el ticket de prueba quedó sin herramientas).
- **D (21/10/2026, tarde):** pantalla del ticket de FCR **acumulativa como la demo** (tarjeta resumen, fases apiladas, validación técnica con la ficha del pedido, preparación de herramientas con la caja «Actividades según el Pedido», asignación, reunión, ejecución con bitácora en línea, revisión de reportes con «Ver PDF», control de retorno y cierre); componentes compartidos `ticket-ficha-pedido` y `ticket-documentos-qhse`; hoja DYN-FCR-RE-008 con la cantidad real de los ítems que no son por día. **Falta:** disponibilidad de operadores por rango en el diálogo de asignación (requiere backend en FCR), banner de la matriz IPERC, carga masiva de actividades por plantilla, «Observaciones» del ticket y los PDF de resumen/encuesta del cierre.
- **Matriz ítem × día (21/10/2026, noche):** decisiones del usuario sobre el reporte. (1) Nace **precargado con todos los ítems cotizados del pedido, la movilización incluida** (los ejemplos reales la traen); el operador solo reparte las cantidades. (2) Cada celda ítem × día lleva su cantidad (1 en las filas por día, con marcas O/D/V; el valor aplicado ese día en las demás); el total de la fila es la suma. (3) Si el servicio dura **un solo día** la precarga ya distribuye cada ítem en ese día con su cantidad cotizada; con más de un día el operador asigna. (4) Lo reportado de un código **no puede superar lo cotizado** (vigente en el pedido/prefactura); para pasarse se propone el cambio de ítems y, aprobado y aplicado por Facturación, el tope sube. Backend: migración `20261023100000_reporte_por_dia_con_cantidad` (cantidad por día, enlace a la lista opcional, `reporte_precargado_at`), precarga perezosa en `GET reporte-herramientas`, error `CANTIDAD_SUPERA_COTIZADO`. Nota: el encabezado de esa migración dice «menos la movilización» y quedó desactualizado; vale lo escrito aquí. Pendiente: llevar a Comercial la distribución por día de las filas con cantidad (hoy solo recibe el total), para que la hoja de Facturación también muestre las celdas.
- **Observación al flujo de servicios:** `inspecciones_enviadas` exige al menos una herramienta y las herramientas solo las agrega el Supervisor en sus pasos; si se pasa de «Tipo de operador» a «Inspección» sin agregarlas no hay transición de vuelta. Conviene decidir si «Inspección» permite devolver a «Tipo de operador» o si «Tipo de operador» exige el listado antes de avanzar.
