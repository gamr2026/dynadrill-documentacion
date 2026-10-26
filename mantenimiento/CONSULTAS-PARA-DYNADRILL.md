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


_(18/10/2026, sesión Flota; en todos los casos se avanzó con la opción conservadora indicada)_

| # | Consulta | Opción conservadora aplicada |
|---|---|---|
| F-1 | **Inspección de llegada:** ¿es la misma inspección DYN-SGI-RE-068 con el kilometraje final, o una inspección nueva? | Es un registro aparte (`momento = llegada`) con su propio odómetro; no vuelve a cumplir la condición de salida del ticket. |
| F-2 | **Punto de partida y destino** de la inspección: ¿hay un catálogo de rutas o lugares, o se escriben a mano en la hoja? | Texto escrito por quien inspecciona (como en el formato impreso). Si hay catálogo, se cambia por FK. |
| F-3 | ¿Quién registra los **documentos de los conductores** (licencia, manejo defensivo, exámenes, vacunas): Mantenimiento, QHSE o Talento Humano? | Los registra quien tenga el permiso `flota.conductores.gestionar` (hoy el Jefe de Mantenimiento); cada renovación es un registro nuevo y el anterior queda en la historia. |
| F-4 | ¿Se acepta que **«documentos de clientes»** no tenga fecha de vencimiento (solo se tiene o no)? | Sí, igual que la demo. Los demás cinco documentos exigen fecha. |
| F-5 | ¿Una inspección **aprobada** puede anularse? | No: el Supervisor la rechaza primero (queda su firma y el motivo) y se repite. |
| F-6 | ¿Qué hacer con una inspección cuyo **kilometraje es menor** que la última lectura (odómetro cambiado o mal leído)? | Se rechaza (409) y se pide corregir la lectura anterior con el permiso de anular lecturas. |
| F-7 | Umbral de «por vencer» de los documentos del conductor. | 30 días (el de la demo). |
| F-8 | (Pendientes de la sesión anterior) Umbrales del gerenciamiento de viaje, quién mantiene el catálogo de proveedores, matrícula de CAM-04 y CAM-08 en `catalogos.vehiculo`, responsable patrimonial de la carga inicial. | Sin cambios. |
| F-9 | **Gerenciamiento de viaje:** una respuesta «Deténgase / no conduce» (más de 16 h trabajadas, menos de 4 h de sueño, sin inspección pre-viaje): ¿la solicitud debe poder enviarse para dejar constancia, o se bloquea? | Se bloquea (422); el formato dice «deténgase». |
| F-10 | Las opciones rotuladas «no viaja» con **75 puntos** (seguridad de la ruta) y **50 puntos** (materiales peligrosos sin documentación): ¿bloquean o solo suman? | Solo suman, como la demo (75 queda en MEDIO). Si deben bloquear, se marcan `impide_conducir` en el catálogo, sin código. |
| F-11 | ¿Quién autoriza cada nivel: BAJO el Supervisor; MEDIO y ALTO el Jefe de Base o el Gerente HSE; el ALTO además el Director General (Quito, fuera del sistema)? | Así está en `umbral_riesgo_viaje`; el visto bueno externo se registra como «visto bueno por teléfono» (quién y hora). |
| F-12 | **Origen del viaje:** Pumping no lo guarda. Se eligió entre las bodegas del catálogo (la base). ¿Hay un catálogo de bases propio de Dynadrill (Matriz, Coca, etc.)? | Se usa `catalogos.bodega`; si hay otro catálogo, se cambia la FK. |
| F-11 (resuelta) | **Quién autoriza cada nivel del viaje.** | El usuario indicó (18/10/2026): MEDIO lo autoriza el Supervisor y ALTO un gerente. La demo y el formato impreso decían Jefe de Base para MEDIO y ALTO; ya se aplicó lo indicado por el usuario. **Confirmar con Dynadrill** y, si es así, corregir el texto fijo de la hoja DYN-SGI-RE-049. |
| F-12 (resuelta) | **Origen del viaje:** ¿hay un catálogo de bases propio? | El usuario indicó que por ahora no hay base: se usa `catalogos.bodega` hasta que exista. |
