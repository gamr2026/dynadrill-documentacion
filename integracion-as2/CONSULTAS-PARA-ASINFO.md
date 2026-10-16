# Consultas para Asinfo (AS2)

> Documento vivo: cada vez que aparezca una duda sobre AS2 que solo ellos puedan resolver, se agrega aquí con su evidencia. Sirve de orden del día para la sesión con Asinfo. Iniciado el 14/10/2026.
> Estado de cada punto: **Pendiente** · **En conversación** · **Resuelto** (con la respuesta y la fecha). No contiene credenciales ni datos personales.
> Contexto técnico: API REST v2 en `http://190.12.33.14:8020/AS2/rest` (OpenAPI en `/rest/openapi.json`), organización 1 (Dynadrill Ecuador C.A., sucursal COCA). El portal de Dynadrill consume AS2 mediante un registro de integraciones; los cambios de contrato se absorben editando datos, pero conviene que nos avisen de ellos.

---

## Prioridad A: bloquean funciones del portal

| # | Tema | Qué observamos (evidencia) | Qué pedimos | Por qué importa | Estado |
|---|---|---|---|---|---|
| A1 | **Crear y actualizar Pedido de Cliente por API** | No existe endpoint de escritura para pedidos de cliente (solo `pedido-proveedor/guardar`). `PUT /v2/factura-cliente/guardar` crea *facturas* y puede emitir XML ante el SRI, por lo que no sirve. El pedido de cliente expone `idEntidadOrigen` en lectura | Un endpoint análogo al de proveedor (`PUT /v2/pedido-cliente/guardar`), **idempotente por `idEntidadOrigen`**, que devuelva el `numero` (`PEC-`) y el `idPedidoCliente` asignados; y equivalentes para **actualizar estado, líneas y anular** | Hoy Ventas debe digitar el pedido dos veces (portal y AS2). Sin esto, el pedido creado en el portal queda "pendiente de crear en AS2" | Pendiente |
| A2 | **Ambiente de pruebas y usuario técnico de integración** | Todas las pruebas se han hecho en producción y en solo lectura; ninguna escritura debe probarse ahí | Un ambiente de pruebas con datos no reales y un usuario técnico de integración. Para el **API**, el inicio de sesión funciona sin segundo factor; para la **interfaz web**, pide código QR (AS2 Authenticator) y aceptar términos: indicar si hay una cuenta de servicio exenta | Sin pruebas no se puede validar ninguna escritura (A1) | Pendiente |
| A3 | **Las líneas de los pedidos `ELABORADO` no se devuelven** | `catalogors/detallePedidoCliente` devuelve **0 líneas en 27 de 27** pedidos `ELABORADO` revisados (141 de los 317 de 2026 tienen totales mayores a 100 USD); en `PROCESADO` devuelve líneas en 10 de 10; en `CERRADO`, 7 de 12. Ejemplo: `PEC-004670` (id 16651, `ELABORADO`) **sí tiene una línea en la pantalla de AS2** (`SCR5001`, 1 × 437,23, 50 % de descuento) y el API responde 200 con lista vacía. La interfaz web las entrega embebidas en su respuesta | ¿Por qué no se devuelven? ¿Se pueden leer por API (otro endpoint, entidad o parámetro)? | El portal necesita comparar los ítems que carga Ventas contra los de AS2 y precargar los del ticket | Pendiente |

## Prioridad B: importantes

| # | Tema | Qué observamos (evidencia) | Qué pedimos | Por qué importa | Estado |
|---|---|---|---|---|---|
| B1 | **Alcance del usuario de integración** | El usuario con el que se probó puede consultar datos de nómina y personales (la entidad `empleado` expone sueldo, discapacidad y cargas familiares). No se consultan, pero el acceso existe | Un rol de **solo lectura** limitado a pedidos, clientes, productos, listas de precios y los campos de perfil de empleados y usuarios, **sin nómina** | Protección de datos personales (LOPDP): el portal no debería poder leer lo que no necesita | Pendiente |
| B2 | **Transporte inseguro** | El API corre en `http://`: la clave y el token viajan en texto plano | HTTPS, o al menos restricción por IP del servidor del portal / VPN | La clave de integración queda expuesta en la red | Pendiente |
| B3 | **Filtro por fecha en la consulta genérica** | Con `catalogors/pedidoCliente`, un filtro sobre `fecha` devuelve **0 filas** en los seis formatos probados (milisegundos numéricos o en texto, `2026-01-01`, ISO con zona, y los operadores `>=` y `>`), sin error. Con `idPedidoCliente >= 14305` sí funciona | El formato y operador correctos para fechas, y la documentación completa de `Filtro` y `ConsultaJPQL` (tipos de valor, operadores, campos filtrables por entidad) | Hoy filtramos "pedidos de 2026" por id, que obliga a mantener el número de corte cada año | Pendiente |
| B4 | **Correos de empleados y relación usuario ↔ empleado** | De 98 empleados activos, solo 28 tienen correo, y solo vía su usuario de AS2 (62 de 87 usuarios tienen correo). `catalogors/empleado` rechaza los campos `correo`, `codigo`, `nombreCompleto`, `area.nombre` y `activo`; `supervisor` llega vacío (`idEmpleado` 0). `catalogors/usuario` rechaza todos los campos probados (`POST /v2/usuarios` sí funciona), y pedir `empleado` en `/v2/usuarios` da error | Cómo obtener el correo de un empleado; cómo se relaciona un usuario con su empleado; el campo correcto para saber si un empleado está activo (hoy usamos `fechaSalida`); y por qué `supervisor` llega vacío | El portal crea cuentas desde AS2 y hoy 70 empleados activos quedan sin correo | Pendiente |
| B5 | **Secuencial `PEDIDOS CLIENTES`** | En la hoja Secuencias: prefijo `PEC-`, longitud 10 (incluye el prefijo), rango 1 a 999.999, número actual 4.674, **vigencia del 9/10/2012 al 31/12/2020**. Aun así AS2 emite en 2026 (`PEC-004676` el 13/10/2026) | ¿Se hace cumplir la vigencia? ¿Hay otra secuencia en uso? ¿Pueden **reservar un rango o una segunda secuencia** para el portal? ¿Qué número devuelve el API al crear un pedido? | El portal modela su propio `codigo` y refleja el `PEC-` de AS2; necesita saber quién manda en la numeración | Pendiente |
| B6 | **Lista de precios por cliente** | Cada cliente trae `idListaPrecios` e `idListaDescuentos`. `lista-producto-por-pagina` ignora `pageSize` y devuelve los 3.608 productos (~8 MB) en cada llamada | Qué endpoint entrega la lista de precios **de un cliente** con sus descuentos, con qué parámetros, y si existe una consulta incremental o filtrada | Los ítems de un pedido salen siempre de la lista de precios del cliente | Pendiente |
| B7 | **Catálogos de apoyo del pedido** | La consulta genérica solo admite: empresa, pedidoCliente, detallePedidoCliente, dimensionContable, departamento, empleado, ordenFabricacion, productoMaterial, producto, usuario y configuracion. No hay entidad para bodega, zona, canal, condición y forma de pago, transportista ni agente comercial; las 11 bodegas se obtuvieron de un Excel | Endpoints o entidades de solo lectura para esos catálogos | La pantalla de nuevo pedido necesita esos selects (bodega, zona, condición de pago...) | Pendiente |
| B8 | **Contactos de clientes** | `listaContactosEmpresa` viene **vacía en los 62 clientes** y **0 de los 999 pedidos de 2026** tienen `contacto`, aunque la pantalla de AS2 tiene el campo "Contacto" | ¿Dónde guardan los representantes de campo (company man) y de Quito? ¿Existe algún registro en AS2, o conviene mantenerlos solo en el portal? | Ventas elige el representante según el cliente | Pendiente |

## Prioridad C: confirmaciones

| # | Tema | Qué observamos | Qué pedimos | Estado |
|---|---|---|---|---|
| C1 | **`total` del pedido** | El campo `total` es el **subtotal bruto**: `total − descuento + impuesto` da el total de la pantalla (437,23 − 218,62 + 32,79 = 251,40 en `PEC-004670`) | Confirmar la semántica, y si hay un campo con el total final | Pendiente |
| C2 | **Campo para la referencia externa** | Los pedidos tienen `idEntidadOrigen` (legible) y `descripcion2` (la "Nota 2"; solo 10 de 999 pedidos de 2026 la usan). `descripcion` es la "Nota" | Qué campo conviene usar para guardar el código del pedido del portal, mientras no haya creación por API | Pendiente |
| C3 | **Vínculo pedido ↔ `dimensionContable`** | El PDF de integración lo marca como pendiente de confirmar | Qué campo une el pedido con el centro de costo (ingresos por pozo) | Pendiente |
| C4 | **`despacho-cliente/sugerir-despacho-cliente`** | No está claro si crea un documento aprobado o un borrador, ni si genera la Guía de Remisión | Efecto exacto y si genera la guía | Pendiente |
| C5 | **Códigos de error HTTP** | Un 401 llega como 500 con el mensaje en el cuerpo; un campo inexistente devuelve un 500 genérico (`ERROR_PROCESAR`) sin decir cuál | Códigos y mensajes correctos, o al menos el nombre del campo inválido | Pendiente |
| C6 | **Importación Excel de líneas** | La pantalla de pedido tiene "Cargar Excel" y "Plantilla" para las líneas (columnas Código producto, Cantidad, Descripción, Precio, % Descuento) | ¿Existe una importación masiva por API o por archivo para crear pedidos completos? | Pendiente |
| C7 | **Política del API** | El token dura 24 h (según el PDF de integración) | Vigencia real, límites de uso, ventanas de mantenimiento y cómo avisan los cambios de contrato | Pendiente |
| C8 | **Datos duplicados** (para el administrador de AS2) | 1 cédula con más de un usuario y 2 correos repetidos entre usuarios | Depurarlos; el portal ya los marca como ambiguos y no crea cuenta con ellos | Pendiente |
| C9 | **Transportista, vehículo y chofer** | AS2 tiene tres catálogos distintos (exportados a Excel el 15/10/2026): *transportista* (código, nombre fiscal, proveedor, tipo y número de identificación), *vehículo* (placa, marca, tipo, modelo, año, responsable) y *chofer* (licencia, nombre, transportista). Cada uno trae una sola fila (Dynadrill como transportista, un camión y un chofer) | ¿El chofer pertenece a un transportista y el vehículo a un responsable? ¿Se pueden consultar y crear por API (la consulta genérica no los lista)? ¿Qué significa el campo "proveedor" del transportista y "predeterminado" en los tres? | Pendiente |
| C10 | **Guía de remisión electrónica en AS2** | La guía de Dynadrill se imprime con el formato propio y hoy se numera aparte (serie 003-001); AS2 tiene su secuencia `GUI-` (en 288). La clienta de Facturación indica que la guía se firma electrónicamente | ¿AS2 emite la guía electrónica (con firma y autorización del SRI) y se puede crear por API desde un pedido o un despacho? ¿Qué número devuelve y cómo se relaciona con `despacho-cliente`? (ver C4) | Pendiente |
| C11 | **Códigos de producto y de unidad en la plantilla de carga de la prefactura** | La plantilla "AS2 Prefactura Cliente" lleva *Codigo Producto AS2* (ej. `0256822`) y *Codigo Unidad AS2* (ej. `UN`); los códigos de la lista de precios del contrato (ej. `SFS6218`) y sus unidades (día, hora, mes…) no tienen equivalencia confirmada | La equivalencia código de lista de precios ↔ producto de AS2, y los códigos de unidad de AS2 (día, hora, mes…); si la carga acepta CSV además de Excel | Pendiente |
| C12 | **Números reservados por el portal (pedido y prefactura)** | Dynadrill pidió que el código del pedido sea el número del pedido de AS2 (`PEC-`) y que el ticket lleve desde el inicio el número de la prefactura (`PRC-`). Los pedidos de AS2 conservan su número; los creados en el portal reservan el siguiente del secuencial (PEC- visto 4674, PRC- visto 4530). AS2 asigna su propio número al crear el documento | Si AS2 permite indicar el número al crear el pedido de cliente y la prefactura (o importarlos con la plantilla), o cómo evitar que los contadores de AS2 y del portal se desfasen; qué pasa si alguien crea pedidos o prefacturas directamente en AS2 mientras el portal tiene números reservados | Pendiente |

---

## Lo que ya resolvimos por nuestra cuenta (no hace falta preguntar)

- **Pedidos de 2026:** se filtran con `idPedidoCliente >= 14305` (el primer id de 2026). Son 999 (667 `CERRADO`, 317 `ELABORADO`, 10 `PROCESADO`, 5 `ANULADO`).
- **Campos del pedido que sí se pueden leer** (`catalogors/pedidoCliente`): `numero`, `fecha`, `fechaDespacho`, `estado`, `total`, `descuento`, `impuesto`, `descripcion`, `descripcion2`, `usuarioCreacion`, `fechaCreacion`, `usuarioModificacion`, `fechaModificacion`, `idEntidadOrigen`, `numeroCuotas`, `empresa.*`, `bodega.nombre`, `documento.nombre`, `condicionPago.nombre`, `formaPago.nombre`, `zona.nombre`, `canal.nombre`, `transportista.nombre`, `contacto.nombre`, `sucursal.nombre`, `direccionEmpresa.ciudad` y `agenteComercial.{nombre1, idUsuario, nombreUsuario}`. **Rechazados:** `nota`, `nota2`, `observacion`, `numeroExterno`, `referencia`, `numeroOrdenCompra`.
- **Uso real en los 999 pedidos de 2026:** agente comercial en 777, zona en 117, canal en 0, contacto en 0, `descripcion2` en 10.
- **Fechas** llegan en milisegundos desde 1970 (medianoche de Ecuador, UTC-5).
- **Interfaz web:** es JSF/PrimeFaces; al abrir un pedido entrega una sola respuesta XML de ~560 KB con las líneas dentro (paginadas en el cliente). Sirve de referencia, pero no se recomienda automatizarla.

## Orden del día sugerido para la sesión

1. A1 y A2: creación de pedidos y ambiente de pruebas (lo que desbloquea más).
2. A3: las líneas de los pedidos `ELABORADO`.
3. B1 y B2: seguridad de la integración.
4. B3 a B8: filtros, empleados, secuencial, precios, catálogos y contactos.
5. C1 a C8: confirmaciones rápidas.

## Registro de cambios

| Fecha | Cambio |
|---|---|
| 14/10/2026 | Creación del documento con A1–A3, B1–B8 y C1–C8, a partir del PDF "Integración API AS2 – Sistema Dynadrill" (8/10/2026), las pruebas de solo lectura y la respuesta XML de la interfaz web. |
