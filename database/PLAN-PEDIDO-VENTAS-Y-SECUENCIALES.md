# Pedido creado por Ventas y secuenciales de documentos

> 14/10/2026. Complementa `PLAN-MIGRACION-PEDIDOS.md` (el modelo de ese plan parte de los 10 pedidos de la demo, con datos sucios; este documento define cómo debe **nacer** un pedido nuevo). Fuentes: respuestas del usuario del 14/10/2026, `Integración API AS2 – Sistema Dynadrill.pdf` (8/10/2026) y la hoja `Secuencias` de `AS2_Datos_Extraidos.xlsx` (79 documentos). Es un diseño: **nada de esto está implementado todavía**.

## 0. Decisiones vigentes (14/10/2026)

- **Corte:** se migra todo el ciclo comercial junto (pedido, documentos operativos, prefactura, guía, AOT).
- **Ids:** UUID en la API (decisión confirmada; el uso de `legacy_id` en pedidos se revisa en la siguiente nota).
- **Archivos:** el módulo `archivos` se construye antes del corte.
- **La demo no es una restricción.** El backend y el frontend nuevos hacen por completo lo que hacía la demo; la demo (rama `main`) no se toca y **no hay espejo ni escritura doble hacia ella**. Los pedidos visibles en la demo son datos de prueba (*seed*): no se migran.
- **Estados:** solo transiciones válidas; solo el Superadmin puede forzar un estado, con motivo obligatorio y registro. Los estados `en_operacion`, `documentos_completos` y `facturado` se vuelven automáticos (inicio del ticket, cierre del ticket por el supervisor, factura emitida en AS2); mientras Operaciones no esté migrada, se disparan a mano con la misma acción controlada.
- **Cierre del ticket:** el pedido pasa a `documentos_completos` y se habilita "Generar prefactura".
- **Prefactura de campo (por detallar en la fase de prefactura):** además de la que genera Facturación, Operaciones puede generar una prefactura y hacerla firmar por el *company man* en campo. En los datos de la demo hay documentos firmados de tipo `prefactura` (2), posiblemente de este flujo; por verificar.
- **Pedidos de AS2 de 2026 (todos los estados):** se leen del API; no son datos a guardar. Solo se guarda un registro del portal cuando Ventas "completa" un pedido de AS2 o cuando se crea uno en el portal (ver las confirmaciones pendientes en la conversación del 14/10/2026).
- **Estados por proceso:** catálogo de estados, transiciones y seguimiento (historial) definidos en base de datos por proceso; la lógica de las precondiciones sigue en código y se referencia por nombre.

## 0.1 Estado de la construcción

| Fecha | Hecho |
|---|---|
| 14/10/2026 | **Hecho y probado:** contenedor `comercial` (`apps/comercial`, puerto 3102) con el módulo `pedidos` (`libs/comercial/pedidos`); tablas `documento`, `secuencia` y `secuencia_emision` (§5); motor de emisión sin duplicados (25 emisiones simultáneas, reversión, rango, vigencia, anulación y protección de la bitácora, 12 pruebas de integración); semilla de `pedido` (próximo código 4317) y `pedido_cliente_as2` (espejo de `PEC-`, último 4674); permisos `comercial.secuencias.*`; consulta de secuenciales en `/api/comercial/secuencias` (el gateway enruta `/api/comercial` a este contenedor; `/api/facturacion` sigue en la demo hasta el corte). |
| Pendiente | Tabla `pedido`, ítems, historial y catálogo de estados por proceso; sincronización de pedidos de AS2; creación y edición; permisos `comercial.pedidos.*`; resto del ciclo. |

## 1. Cómo nace un pedido (hechos confirmados)

| Hecho | Fuente |
|---|---|
| El pedido nace en AS2 y el portal lo carga por API (lectura). AS2 tiene 4.649 pedidos de Dynadrill (2019 a hoy), 941 en estado `ELABORADO`; 1.012 no anulados en 2026 | PDF, p. 5 y 9 |
| **AS2 no tiene endpoint para crear ni actualizar un Pedido de Cliente** (solo `pedido-proveedor/guardar`). `PUT /v2/factura-cliente/guardar` crea *facturas* y puede emitir XML ante el SRI: no debe usarse | PDF, p. 5 y 9 |
| Ventas es quien crea el pedido, sin aprobación previa | Usuario |
| Mientras no exista API de creación, una opción de prueba es automatizar la interfaz web de AS2 (Python) | Usuario |
| **Alcance de la carga desde AS2: solo los pedidos del año en curso** (2026): unos 1.012 no anulados | Usuario, 14/10/2026 |
| Todo pedido tiene un secuencial; en AS2 es el documento `PEDIDOS CLIENTES`, prefijo `PEC-` | Excel, hoja Secuencias |

## 2. Pedido creado por Ventas: datos y reglas

La regla general: cada dato se guarda como **id del catálogo** (para relacionar y filtrar) más una **copia del nombre en ese momento** (para que los documentos impresos no cambien). La exigencia de "obligatorio" aplica solo a los pedidos nuevos (columna `migrado = false`); los 10 de la demo conviven con datos incompletos.

| Dato | Obligatorio al abrir | De dónde sale |
|---|---|---|
| Cliente | Sí (`cliente_id`) | Catálogo de clientes (enriquecido desde AS2) |
| Línea de servicio (FCR / Pumping) y tipo de OT (venta / servicio) | Sí | Listas fijas |
| Tipos y subtipos de servicio | Sí (al menos uno) | Los 17 valores del SQL v1 |
| Campo, bloque, pozo | Sí | Catálogos de ubicación |
| Taladro **o** `rigless = true` | Sí, una de las dos | Catálogo de taladros; `rigless` indica trabajo sin taladro (`CHECK`: taladro nulo si `rigless`) |
| Fecha de inicio y de fin (o duración en días) | Sí | Ventas |
| Agente comercial | Sí | Usuario del portal; por defecto quien crea |
| Representante de campo y de Quito | No (quedan pendientes) | Contacto del cliente; si no hay vínculo, pendiente de resolver con el cliente (decisión del usuario) |
| Técnico HSE | Sí | Usuario con rol `tecnico_hse` activo |
| Ítems estimados | Sí (al menos uno) | **Siempre de la lista de precios** del cliente; o "cargar plantilla" (§3) |
| Sección administrativa: bodega, condición de pago, zona | Bodega sí | Bodega: select del catálogo de bodegas de AS2 (11); condición de pago y zona: catálogos |
| Documento referencial | No (opcional) | Adjunto |
| **Analista de facturación** | **No: se omite al crear** | Lo asigna la jefa de Facturación al terminar el pedido (§4) |

Flujo: `borrador` (opcional, sin número ni efectos) → **abrir** (ventas valida y abre: se asigna el número, y recién ahí se crean el ticket FCR/Pumping y el PTW como consumidores del evento `comercial.pedido.abierto`) → seguimiento. Cada cambio sube `version` (control optimista); con prefactura enviada o firmada el pedido queda congelado.

## 2.1 Pedidos cargados desde AS2: "por completar" y si traen líneas

**Decisión del 14/10/2026.** Los pedidos de 2026 que llegan de AS2 entran al portal como **"por completar"**, sean `ELABORADO` o `PROCESADO`: ninguno trae los datos del portal (línea de servicio, tipo de OT, ubicación, responsables, técnico HSE). Se pueden **distinguir los que traen líneas de AS2 de los que no**.

**Hallazgo del 14/10/2026 (verificado con la captura de pantalla y con la respuesta XML de la interfaz web de AS2).** Las líneas de los pedidos `ELABORADO` **sí existen en AS2**: `PEC-004670` (id 16651) tiene una línea (`SCR5001`, 1 × 437,23 con 50 % de descuento) que la pantalla muestra y que `catalogors/detallePedidoCliente` **no devuelve**. Por tanto no es que Ventas cargue los ítems después: es una **limitación del API REST** para pedidos en `ELABORADO`, que hay que plantear a Asinfo. En el API, `total` es el **subtotal bruto**; el total final es `total − descuento + impuesto` (437,23 − 218,62 + 32,79 = 251,40, igual que la pantalla).

Cómo entrega los datos la interfaz web (JSF/PrimeFaces 15, no REST): al abrir un pedido el navegador hace **una sola petición** `partial/ajax` a `pedidoCliente.jsf` y recibe **una sola respuesta XML** de ~560 KB con la pantalla completa, **incluida la tabla de líneas** (paginada en el cliente: `rows:15`, todas las líneas vienen embebidas). Cada línea trae el código del producto y, oculto, el **id de producto de AS2** (`1012`, el mismo `producto.idProducto` del API), cantidad, precio, descuento y % de descuento. Leer líneas por la interfaz exigiría sesión con segundo factor, el `ViewState` y analizar HTML con identificadores autogenerados (`j_idt...`) que pueden cambiar: es frágil y no se recomienda mientras exista la posibilidad de resolverlo con Asinfo.

Medición del 14/10/2026 sobre los 999 pedidos de 2026 (consulta `catalogors/detallePedidoCliente`): los `ELABORADO` no devuelven líneas en la muestra (0 de 27 revisados; 141 de ellos tienen totales mayores a 100 dólares y aun así no las traen, ver pregunta 1 de §8); los `PROCESADO` sí (10 de 10); los `CERRADO` y `ANULADO`, a veces. Hipótesis del usuario: Ventas registra el pedido en AS2 solo para obtener el código y carga los ítems después.

Dos dimensiones separadas en `pedido` (el estado de AS2 no se mezcla con el del portal):

| Campo | Valores | Para qué |
|---|---|---|
| `estado` (portal) | `borrador` (se muestra como **"Por completar"**: sin ticket ni PTW) → `abierto` → ... | Flujo propio del portal; un pedido de AS2 entra en `borrador` y pasa a `abierto` cuando Ventas completa los datos |
| `as2_estado` | `ELABORADO`, `PROCESADO`, `CERRADO`, `CERRADO_MANUAL`, `ANULADO` | Reflejo del estado en AS2, se actualiza en cada sincronización |
| `as2_lineas_estado` | `con_lineas`, `sin_lineas`, `no_consultado` | Permite filtrar y mostrar la diferencia |
| `as2_lineas_cantidad` | entero | Cuántas líneas devolvió AS2 |
| `as2_lineas_verificado_at` | fecha | Cuándo se consultó por última vez |

Reglas:
- **La consulta de líneas es una por pedido** (el API exige el filtro `pedidoCliente.idPedidoCliente`): la primera carga de ~999 pedidos son ~999 llamadas. En las siguientes pasadas solo se **reconsultan** los pedidos `sin_lineas` cuyo `as2_estado` cambió o que llevan más de un plazo sin verificarse, y los recién cargados; no se reconsulta todo cada vez.
- `sin_lineas` **no significa "vacío"**: puede ser que AS2 aún no las tenga o que el API no las muestre (§8, pregunta 1). La pantalla dice "AS2 sin líneas", no "sin ítems".
- Pantalla de pedidos: pestaña **"Por completar"** y un filtro **"Con líneas de AS2 / Sin líneas de AS2"**.
- Un pedido `con_lineas` ofrece **"Importar líneas de AS2"**: precarga los ítems del pedido (producto, cantidad y precio de AS2), validados contra la lista de precios del cliente. Ventas los revisa y los confirma; no se guardan solos.
- Las líneas que trae AS2 **no reemplazan** a las del portal: si ambas existen, se compara el total y se avisa la diferencia.

## 3. Carga de ítems desde la plantilla Excel de AS2

**Corrección del 14/10/2026.** En un primer borrador se interpretó "cargar plantilla" como plantillas guardadas en el servidor. No es así: en el frontend actual (`nuevo-pedido-dialog`) es un **archivo Excel con el formato de AS2** (columnas `Codigo Producto AS2`, `Cantidad`, `Descripción`, `Precio`, `% Descuento`) que Ventas descarga, llena y sube para traer muchos ítems de una vez, más algunos ejemplos precargados. Por tanto **no hacen falta tablas de plantillas**.

Cómo se trata en el modelo nuevo (los ítems siempre salen de la lista de precios):
- Cada fila se valida contra la lista de precios del cliente por `Codigo Producto AS2`. Si el código no existe, la fila se rechaza con su número de fila.
- El precio y el descuento válidos son los de la lista. Si el archivo trae otro precio, se avisa la diferencia y se usa el de la lista, salvo que quien tenga permiso autorice el precio manual (la demo ya marca esa excepción como `personal_manual`).
- Se importa como borrador de ítems: Ventas revisa y confirma antes de guardar.
- Posible aprovechamiento (**hipótesis por confirmar**): como el formato es el de AS2, el portal podría **exportar** el pedido en esa misma plantilla para que Ventas lo importe en AS2 y no lo digite dos veces. Hay que confirmar con Asinfo si AS2 importa pedidos desde ese archivo.

## 4. Asignación del analista de facturación

Al crear el pedido, `analista_facturacion_usuario_id` queda nulo. El pedido **termina cuando el supervisor cierra el ticket** (decisión del 14/10/2026). El cierre del ticket FCR o Pumping dispara `comercial.pedido.listo_para_facturacion` y se avisa a la jefa de Facturación, que lo reasigna a un analista (`asignado_por`, `asignado_at`). Permiso propio: `comercial.pedidos.asignar_analista` (jefe de facturación; Superadmin). Mientras FCR y Pumping sigan en la demo, el cierre del ticket ocurre allí: el espejo hacia el portal debe llevar ese hecho (es una tercera escritura demo → portal, además de los documentos operativos y el cambio de ítems de Pumping). Estado del pedido al cerrar el ticket: se propone `documentos_completos` (hoy ningún método de la demo lo produce) y que a partir de ahí se habilite "Generar prefactura"; por confirmar. Hasta que exista el módulo `avisos`, el aviso es una bandeja "pedidos sin analista" calculada al leer.

## 5. Documento y secuencial: tres tablas

Hoy el correlativo sale de "máximo + 1" sin bloqueo y comparte numeración con AS2. Se propone modelar el documento y su secuencial como en AS2, pero con trazabilidad.

### 5.1 Lo que enseña la hoja `Secuencias` de AS2

- Columnas: `Nº`, `Nombre`, `Prefijo`, `Sufijo` (vacío en los 79), `Número actual`, `Longitud`, `Rango desde`, `Rango hasta`, `Vigencia desde`, `Vigencia hasta`. Hay 79 documentos; 12 sin prefijo.
- `PEDIDOS CLIENTES`: prefijo `PEC-`, número actual **4.674**, longitud 10 (el prefijo cuenta: `PEC-` + 6 dígitos con ceros, p. ej. `PEC-004674`), rango 1 a 999.999.
- **Anomalía:** su vigencia es del 9/10/2012 al **31/12/2020** y aun así AS2 emite pedidos en 2026 (el PDF cita `PEC-004653`). Es decir, la vigencia no se hace cumplir. Hay que confirmarlo con Asinfo; mientras tanto la vigencia se modela como informativa, no como bloqueo.
- Otros del ciclo: `PREFACTURA` (`PRC-`, 4.530), `GUIA DE REMISION` (`GUI-`, 288), `FACTURA CLIENTE` (sin prefijo, 1.501), `DESPACHO DE BODEGA` (`DES-`, 5.274).

### 5.2 Quién manda en el número (el punto delicado)

**El número `PEC-` lo asigna AS2.** Si el portal emitiera `PEC-004675` por su cuenta, chocaría con el que AS2 entregue al pedido siguiente. Por eso un pedido tiene **dos números**:

| Número | Quién lo emite | Para qué |
|---|---|---|
| `codigo` (secuencial del portal, hoy de 4 dígitos, de 4180 a 4316; continúa el "Secuencial Tk Control") | El portal, con su propia secuencia | Identificar el pedido en el portal desde que se abre |
| `as2_numero` (`PEC-00xxxx`) y `as2_id_pedido_cliente` | AS2, al crear o cargar el pedido | Enlace con el ERP; se llena al leerlo de AS2 o al subirlo |

El portal **refleja** la secuencia `PEC-` de AS2 (`numero_actual` sincronizado, para conciliar y detectar saltos), pero no emite de ella, salvo que Asinfo reserve un rango propio del portal (`rango_desde/hasta` en AS2) o entregue el número al crear por API.

### 5.3 Modelo (schema `comercial`)

**`documento`** — qué documentos existen y cómo se numeran.

| Columna | Detalle |
|---|---|
| `id` | UUIDv7 |
| `codigo` | `pedido`, `prefactura`, `guia_remision`, `aot`, `documento_operativo`... (único) |
| `nombre` | Nombre en el portal |
| `nombre_as2` | Nombre del documento en AS2 (`PEDIDOS CLIENTES`) para conciliar |
| `emite_portal` | `true` si el portal emite el número; `false` si lo asigna AS2 (como `PEC-`) |
| `activo` | |

**`secuencia`** — un documento puede tener varias (por vigencia, año, sucursal).

| Columna | Detalle |
|---|---|
| `id`, `documento_id` | |
| `prefijo`, `sufijo` | Texto, opcionales |
| `longitud_total` | Como AS2: incluye el prefijo (`PEC-` + 6 dígitos = 10) |
| `rango_desde`, `rango_hasta` | El número no puede salir de este rango |
| `numero_actual` | Último emitido; el siguiente es `numero_actual + 1` |
| `vigencia_desde`, `vigencia_hasta` | Informativas (§5.1); `hace_cumplir_vigencia` bandera para el día que se quiera exigir |
| `reinicio` | `nunca` o `anual` (p. ej. `PUMP-2026-00001`) |
| `origen` | `portal` o `as2` (espejo) |
| `as2_numero_actual`, `as2_sincronizado_at` | Último valor leído de AS2 |
| `activa`, `version` | Control optimista |

**`secuencia_emision`** — bitácora inmutable (solo inserción, como las otras bitácoras).

| Columna | Detalle |
|---|---|
| `id`, `secuencia_id` | |
| `numero`, `codigo_formateado` | `4317` y `4317`, o `PEC-004675` |
| `documento_ref_id` | Id del pedido (u otro) que lo recibió |
| `estado` | `emitido`, `anulado`, `huerfano` (número emitido sin documento) |
| `emitido_por`, `emitido_at`, `motivo` | Quién, cuándo y por qué se anuló |
| Única | `(secuencia_id, numero)`: es la garantía contra duplicados |

### 5.4 Cómo se emite un número (sin duplicados)

1. Dentro de la **misma transacción** que crea el pedido: `UPDATE secuencia SET numero_actual = numero_actual + 1 WHERE id = $1 AND numero_actual < rango_hasta RETURNING ...`. El `UPDATE` bloquea la fila, así que dos pedidos simultáneos no obtienen el mismo número.
2. Se arma `codigo_formateado` (prefijo + número con ceros hasta `longitud_total` + sufijo) y se inserta en `secuencia_emision`.
3. Si la transacción falla, el número **no se consume** (no hay saltos). Una secuencia de PostgreSQL (`nextval`) no se revierte y dejaría huecos; por eso no se usa aquí.
4. Fuera del rango o `activa = false`: error claro, sin emitir.
5. Anular un pedido no libera su número: la emisión queda `anulado` y el número no se reutiliza.

Conciliación con AS2: una tarea periódica lee el mayor `PEC-` de AS2 y lo guarda en `as2_numero_actual`; si el portal tiene pedidos con `as2_numero` fuera de lo esperado, se avisa.

## 6. Subir pedidos creados en el portal hacia AS2

Como AS2 no ofrece API, el pedido creado por Ventas en el portal necesita un estado de sincronización y una cola de envío, **independientes del método** que se use para subirlo (API cuando exista, automatización web mientras tanto).

| Campo en `pedido` | Valores |
|---|---|
| `origen` | `as2` (cargado desde AS2) o `portal` (creado por Ventas) |
| `as2_sync_estado` | `no_aplica`, `pendiente_de_subir`, `subiendo`, `subido`, `error` |
| `as2_id_pedido_cliente`, `as2_numero` | Se llenan al subir o al leerlo de AS2 |
| `as2_ultimo_error`, `as2_intentos` | Diagnóstico |

**`pedido_envio_as2`** (cola y bitácora de intentos): `pedido_id`, `metodo` (`api` o `rpa`), `estado`, `intentos`, `ultimo_error`, `payload_hash`, `creado_at`, `procesado_at`. Es el patrón outbox: el pedido queda guardado aunque AS2 falle, y el envío se reintenta sin perderlo.

**Constancia y vinculación cuando AS2 lo crea (decisión del 14/10/2026).** Un pedido creado en el portal queda como "pendiente de crear en AS2", con constancia de su origen, y **no corta la continuidad del flujo**: el ticket, el PTW y los documentos se generan igual desde que Ventas lo abre; no esperan a AS2. Cuando el pedido aparece en AS2, la sincronización lo **vincula** y desde ahí consta que ya existe allí.

| Paso | Qué ocurre |
|---|---|
| 1. Ventas abre el pedido en el portal | `origen = portal`, `as2_sync_estado = pendiente_de_crear_en_as2`, y el flujo sigue |
| 2. Alguien lo registra en AS2 | Se pone el **código del portal en la descripción** del pedido de AS2 (p. ej. `PORTAL-4317 ...`), porque AS2 no guarda un id de origen |
| 3. La sincronización diaria lee los pedidos de AS2 del año | Busca ese código en `descripcion`; si coincide, rellena `as2_id_pedido_cliente` y `as2_numero` y marca `vinculado` (`as2_vinculo_metodo = referencia_en_descripcion`) |
| 4. Sin coincidencia exacta | Aparece en una pantalla de **conciliación** con candidatos (mismo cliente, fecha cercana, total parecido) para vincularlo a mano (`manual`) |
| 5. Pendientes antiguos | Un pedido del portal sin pareja en AS2 pasado un plazo se señala como "sin registrar en AS2" |

Un pedido que llega de AS2 y no existe en el portal entra con `origen = as2` (ver §8).

**Riesgos de la automatización web (hay que decirlos antes de empezar):**
- El ingreso web de AS2 pide un **segundo factor con código QR (AS2 Authenticator)** y aceptación de términos (se vio al probar el 13/10). Una automatización desatendida necesita una cuenta de servicio sin esa exigencia o una sesión reutilizable; no se puede asumir que se pueda.
- La interfaz web **no ofrece idempotencia**: un reintento puede crear un pedido duplicado en AS2. Hace falta verificar antes de reintentar (buscar por descripción o referencia).
- El propio PDF indica que **ningún endpoint de escritura debe probarse en el ambiente de producción** y que se pida a Asinfo un ambiente de pruebas. Lo mismo vale para la automatización: probar solo contra pruebas.
- Es frágil ante cambios de pantalla. Debe vivir como un proceso aparte (Python) que consume `pedido_envio_as2`, para que el portal no dependa de él.

Mientras no haya ambiente de pruebas ni API, el estado por defecto de un pedido creado en el portal es `pendiente_de_subir` y Ventas lo registra en AS2 a mano, como hoy.

## 7. Cambios al catálogo y eventos

- `catalogos.bodega` (nuevo): `id`, `nombre`, `as2_id` opcional, `habilitado`, `legacy_id` no aplica. Se siembra con las 11 bodegas de AS2: CBR, CNPC, Consorcio Shushufindi, Ecuaservoil, Gente Oil, Geopark, Orion, SLB, Matriz, Petrobell y Petroecuador. Se cargará por el registro de integraciones, no a mano.
- `contacto_cliente` ligado a `cliente` (rediseño diferido en `ANALISIS-AS2-PERSONAS-Y-CLIENTES.md`): necesario para que Ventas elija el representante del cliente.
- Eventos nuevos además de los de `PLAN-MIGRACION-PEDIDOS.md` §4.5: `comercial.pedido.listo_para_facturacion`, `comercial.pedido.analista_asignado`, `comercial.pedido.subido_a_as2`, `comercial.pedido.error_subida_as2`, `comercial.secuencia.salto_detectado`.
- Permisos: `comercial.pedidos.{ver,crear,editar,anular,asignar_analista}`, `comercial.plantillas.{ver,crear,editar,inactivar}`, `comercial.secuencias.{ver,editar}` (solo Superadmin).

## 8. Preguntas abiertas

Respondidas el 14/10/2026: alcance (solo pedidos de 2026), constancia y vinculación con AS2 sin cortar el flujo (§6), fin del pedido = cierre de ticket por el supervisor (§4), y los pedidos de AS2 (`ELABORADO` y `PROCESADO`) entran "por completar", distinguiendo los que traen líneas (§2.1).

1. **Pregunta para Asinfo:** ¿se pueden leer por el API REST las líneas de un pedido en `ELABORADO`? (Hipótesis "Ventas carga los ítems después": descartada; el pedido `PEC-004670` tiene su línea en la pantalla de AS2.) Mientras tanto el portal no depende de ellas.
2. De los pedidos de 2026, ¿se cargan **todos los estados** de AS2 (incluidos `ANULADO` y `CERRADO`) guardando el estado de AS2, o solo los vigentes?
3. Al cerrar el ticket, ¿el pedido pasa a `documentos_completos` y queda habilitado "Generar prefactura"?
4. La vigencia de `PEDIDOS CLIENTES` terminó en 2020 y AS2 sigue emitiendo: ¿lo confirma con Asinfo?
5. ¿Asinfo importa pedidos desde la plantilla Excel de AS2? (si sí, el portal podría exportarla).
6. ¿Quién conseguirá el ambiente de pruebas y una cuenta de servicio de AS2 sin segundo factor, necesarios para cualquier subida automática?
