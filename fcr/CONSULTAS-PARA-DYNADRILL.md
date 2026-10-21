# Consultas para Dynadrill

Dudas de negocio que salieron al construir cada módulo. Cada sesión escribe en su propia sección (`## <módulo>`). Mientras no haya respuesta, el módulo sigue con la **opción conservadora** que se indica y la deja aislada para cambiarla con poco esfuerzo. Las respuestas se anotan debajo de cada pregunta, con fecha.

## FCR

Origen: `specs/ot-fcr`, `specs/fcr-precarga-herramientas` y `specs/fcr-bitacora-envio-diario` de la demo, y la lectura del código de FCR de la demo (`fcr-tickets`). Varias son las «Open Questions» de esas especificaciones que el `main` de la demo dejó sin resolver en el código.

### Flujo y roles

**F-1. ¿Dónde se captura el tipo de completación / tipo de trabajo y el tipo de *picker*?**
La especificación dudaba entre la asignación y la ejecución. En el código de la demo se captura **por herramienta y por día**, junto al uso diario (`toolUsageLog`).
*Se hace:* por herramienta y por día en la ejecución (como la demo). La venta pide el tipo de completación; el servicio, el tipo de trabajo (los dos son catálogos en tablas).

**F-2. ¿Qué rol repara e inspecciona en la entrada SERVICIOS?**
La demo usa el Operador FCR (`operador_fcr`) y guarda `tipoOperador` (mecánico o soldador) como un dato, no como un rol distinto.
*Se hace:* igual que la demo: rol `operador_fcr`; el tipo de operador es un catálogo.

**F-3. ¿Quién es el «Supervisor FCR»?**
En la demo el paso de la entrada VENTA y la mayoría del tronco los hace el rol `supervisor`, que también existe en Pumping (con `supervisor_pumping` aparte). La plataforma tiene el rol `supervisor_operaciones_fcr` solo para aprobar la inspección de SERVICIOS.
*Se hace:* `supervisor` en los pasos de VENTA y del tronco; `supervisor_operaciones_fcr` solo en la aprobación de SERVICIOS. Confirmar que no hace falta un rol «Supervisor FCR» distinto del Supervisor de Pumping (D4 ya retiró dos roles por esa razón).

**F-4. ¿Quién hace la asignación en FCR: el Supervisor (como en la demo) o el Jefe de Base (como en Pumping)?**
Pumping la pasó al Jefe de Base; la demo dejó expresamente la de FCR en el Supervisor (nota D2 de `workflow-role.maps.ts`).
*Se hace:* el Supervisor asigna al operador.

**F-5. ¿La asignación de FCR incluye unidades (vehículos)?**
En la demo FCR solo asigna un operador; no hay unidades ni reporte de unidad de salida ni de llegada, y tampoco aparecen en las especificaciones (`specs/ot-fcr`) ni en los pasos del proceso. Un primer diseño había agregado unidades y el reporte de llegada (DYN-MNT-RE-012) «igual que Pumping».
*Se hace (decisión del 21/10/2026):* **FCR no lleva unidades ni reporte de unidad de llegada.** Se retiraron el requisito del control de retorno, el reporte, el evento `operaciones.fcr.reporte_unidad_llegada` y las unidades de la asignación (migración `20261023120000_fcr_sin_unidades`).

**F-6. ¿Cuál es el paso que sigue a la aprobación del Supervisor de Operaciones FCR en SERVICIOS, y qué pasa con la rama VENTA?**
La especificación dice que ambas entradas confluyen en `preparacion_herramientas`. La rama VENTA entra por `revision_inicial` (validación del programa).
*Se hace:* `revision_inicial → preparacion_herramientas` (venta) y `aprobacion_supervisor_operaciones → preparacion_herramientas` (servicios), con el rechazo de la aprobación de vuelta a `inspeccion`.

**F-7. En SERVICIOS, el diagrama menciona el paso «Reparación» entre «tipo de operador» e «inspección». El código de la demo no lo tiene como fase (la reparación es un dato de la inspección: «reparado por»).**
*Se hace:* no hay fase «reparación»; «inspeccionado por» y «reparado por» son datos de la inspección.

### Documentos de las dos ramas

**F-8. ¿Los dos documentos de la rama VENTA (registro de dureza y registro firmado de QAQC) son adjuntos obligatorios del ticket?** El diagrama los pide en «Se adjuntan documentos de…» y no figuran como obligatorios en la demo.
*Se hace:* son adjuntos del ticket (tabla de documentos, uno por tipo) y **no bloquean** el paso; se puede volver a obligarlos con una fila del catálogo de requisitos.

**F-9. Los tres documentos de SERVICIOS (formulario de inspección externo, formato de dimensionamiento, formato de dureza) y el «documento de inspección» del tronco: ¿son obligatorios para avanzar?**
En la demo cada uno es un indicador «subido».
*Se hace:* el formulario de inspección externo es obligatorio para salir de `inspeccion` (como en la demo); los demás son adjuntos sin bloqueo.

### Herramientas y kits

**F-10. ¿Mover una herramienta (Bodega → Recepción → devuelta) debe generar movimientos en el kardex de Inventario?**
En la demo no mueve el kardex (solo marcas). Una herramienta es un activo que vuelve, no un consumible. El plan pide «solicitar a Bodega con Inventario».
*Se hace:* **no** se mueve el kardex; Inventario ofrece el artículo y sus partes, y la existencia se consulta (`stock`). Si Dynadrill quiere que cada salida y retorno de herramienta quede en el kardex, hay que definir el motivo del movimiento y qué pasa cuando la herramienta vuelve dañada o faltante.

**F-11. «Un juego por unidad cotizada, salvo si la unidad es de tiempo (día, hora, mes, semana): entonces 1 juego».** ¿La lista de unidades de tiempo es fija o la mantiene alguien?
*Se hace:* una tabla de unidades de cotización con la marca «es de tiempo», sembrada con día, hora, mes y semana; la ampliación es una fila.

**F-12. Un código sin configuración (sin kit) se trata como servicio y avisa al Supervisor. ¿Quién debe recibir ese aviso y cuándo: al crear el ticket, o solo cuando el Supervisor abre la preparación?**
*Se hace:* se guarda como aviso de precarga en el ticket (visible al Supervisor al abrirlo); no se envía correo.

**F-13. Si el pedido cambia después de que el ticket se creó (se agregan o quitan líneas), ¿el Supervisor recarga a mano («Recargar desde el Pedido») o el ticket debe reaccionar solo al evento de actualización del pedido?**
*Se hace:* recarga manual del Supervisor, solo en preparación y antes de confirmar el listado (como la demo).

**F-14. «Compatibilidad»: en la demo una línea sin configurar cuyo código **es** una herramienta de Inventario se precargaba como kit de sí misma. ¿Se conserva?**
El código de la lista de precios y el código del artículo son cosas distintas, y comparar códigos de texto es frágil.
*Se hace:* **no** se conserva. Una línea sin configuración es servicio y genera un aviso.

### Inspección de herramientas

**F-15. La copia fija de las partes al iniciar la inspección: ¿qué datos deben quedar «congelados» aunque el catálogo cambie?**
*Se hace:* se congela el **código, la descripción y la cantidad esperada** de cada parte (es un documento firmado), y se guarda además la FK a la parte del catálogo cuando existe. Las partes agregadas a mano no tienen FK.

**F-16. Las tres firmas (reparado por, revisado por, liberado por QHSE) son en secuencia en la demo.** ¿«Liberado por QHSE» lo puede firmar cualquiera de los tres roles HSE? La plataforma tiene `tecnico_hse` y `gerente_hse` (el Coordinador se retiró en D4).
*Se hace:* `tecnico_hse` y `gerente_hse`.

**F-17. «Cambio de elemento» en la inspección es informativo y no mueve el kardex. ¿Debe descontar del stock de repuestos?**
*Se hace:* no mueve el stock (como la demo).

**F-18. Una inspección rechazada por el Supervisor de Operaciones: ¿la misma inspección vuelve a borrador o se crea una nueva y la anterior queda como historia?**
*Se hace:* se crea una versión nueva (la anterior queda inmutable y firmada); es lo que la regla de historia inmutable exige.

### Bitácora y reportes

**F-19. ¿Cuántos días máximos tiene el operador para corregir una bitácora ya enviada?** La demo solo lo permite mientras la ejecución no se finalice; Facturación corrige hasta que el pedido sale al cliente.
*Se hace:* sin límite de días: el operador corrige mientras el ticket esté en ejecución y el día no haya sido corregido por Facturación.

**F-20. «La bitácora y el uso de herramientas no se salen de las fechas del servicio del pedido».** Si el servicio se alarga, ¿quién amplía la fecha fin?
*Se hace:* se toma `fechaInicioServicio` y `fechaFinServicio` del pedido; si el pedido no trae fecha fin, solo se exige que el día no sea anterior al inicio ni futuro. Si el servicio se extiende, Ventas actualiza el pedido y FCR **no** recibe todavía ese cambio (ver F-13).

**F-21. El Reporte de Herramientas: ¿se envía una sola vez al cerrar la ejecución (como la demo) o también día por día?**
*Se hace:* una sola vez, al finalizar la ejecución, con las herramientas y su uso diario.

**F-22. ¿Quién firma el Reporte Job de un día enviado por el operador: el operador, el supervisor del ticket, o ambos?** La demo toma «firmado por» el operador.
*Se hace:* el operador que envía; el supervisor asignado queda como supervisor del documento.

### Cierre y retorno

**F-23. Control de retorno: ¿qué pasa con una herramienta marcada como faltante?** La demo la marca «faltante» con un motivo y deja cerrar.
*Se hace:* igual: el retorno se completa cuando cada herramienta está «devuelta» o «faltante con motivo». Pendiente: ¿se cobra o se descuenta al cliente? (no se modela).

**F-24. El cierre exige el Acta de Entrega de Locación (QHSE). Si QHSE todavía no publica el evento, ¿se permite cerrar con el puente temporal y un motivo?**
*Se hace:* sí, con el mismo puente temporal de Pumping (permiso aparte, con motivo, queda registrado como manual temporal).

**F-25. ¿El «roles de control de retorno» sigue siendo Bodega?** La demo cambió `control_herramientas` por `bodeguero`.
*Se hace:* `bodeguero` en el control de retorno.

### Frontend

**F-26. ¿Los operadores y el supervisor usan el ticket desde el celular?** Las pantallas nuevas son responsivas, pero la bitácora diaria y el reporte de llegada son largos.
*Se hace:* se publican como están; si usan celular en campo, se hace una versión compacta de esas dos pantallas.
