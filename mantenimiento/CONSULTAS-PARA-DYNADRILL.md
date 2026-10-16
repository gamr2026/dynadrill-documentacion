# Consultas para Dynadrill — Flota y Mantenimiento

## Mantenimiento

Consultas de la sesión de Mantenimiento (16/10/2026). Mientras no haya respuesta se avanza con la opción conservadora indicada.

| # | Consulta | Opción conservadora vigente |
|---|---|---|
| M-1 | **Fórmulas exactas de los KPI** de MAN-MASTER-001 (tiempo de respuesta, tiempo de ejecución, disponibilidad, cantidad por tipo) y cómo separan unidades Pesadas y Livianas. | Se calculan con las marcas de tiempo que ya guarda la sub-orden (recibido, ejecución iniciada/terminada, cierre aprobado) y el retorno a operación de la orden; las fórmulas quedan en un solo lugar para cambiarlas. |
| M-2 | ¿El **checklist de fábrica** del mantenimiento preventivo es obligatorio? ¿Quién lo carga (el operador o el Jefe)? | Opcional, lo carga quien registra el preventivo (solo si lo ejecuta personal interno). |
| M-3 | ¿Los **repuestos** de una sub-orden deben salir de Inventario (salida real contra el kardex) o siguen siendo texto con número de parte? | Texto con número de parte, cantidad y descripción; se enlazan a `inventario.articulo` cuando Inventario lo permita. |
| M-4 | **Numeración de los reportes de unidad**: el formulario físico (DYN-MNT-RE-012) ya tiene números (la demo arrancaba en 3200). ¿El portal continúa esa numeración o empieza en 1? | Empieza en `R0001` (contador propio). Se cambia con una sola fila (`mantenimiento.contador`). |
| M-5 | Un reporte de unidad de Pumping cuyo vehículo **no tiene unidad en Flota**: ¿qué se hace? | Se ignora con una advertencia en el log (no se pierde el reporte de Pumping); Flota debe enlazar cada vehículo con su unidad. |
| M-6 | ¿Quién puede **reasignar** una sub-orden ya asignada a otro operador de mantenimiento? | El Jefe de Mantenimiento (permiso `mantenimiento.ordenes.gestionar`). |

## Flota

_(16/10/2026, sesión Flota; se avanzó con la opción conservadora indicada)_

1. ¿Los umbrales del gerenciamiento de viaje (BAJO, MEDIO, ALTO) están fijos por el formato DYN-SGI-RE-049 o los define el negocio? (Aplica en F4.)
2. ¿Quién mantiene el catálogo de proveedores de mantenimiento? (Hoy lo administra el Jefe de Mantenimiento; se sembró «Lubricentro Norte S.A.».)
3. Las camionetas CAM-04 y CAM-08 de la demo traen placa (PBA-1234, PCB-5678), marca y modelo, pero esos vehículos no existen en el catálogo de transporte; quedaron sin vínculo. ¿Se cargan al catálogo con sus datos reales?
4. ¿Quién es el responsable patrimonial de cada unidad? La demo lo guarda como texto («Jorge Hidalgo») y no se copió: debe elegirse una cuenta.
5. Un vehículo de transporte sin ningún mantenimiento previo registrado no genera alerta de kilometraje (no hay punto de partida). ¿Se prefiere partir del kilometraje de arranque?
6. Una lectura de horómetro o kilometraje menor que la anterior se rechaza. Si se cambia el medidor, ¿cómo desea que se registre el reinicio?

