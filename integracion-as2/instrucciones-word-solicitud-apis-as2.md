# Instrucciones para generar el documento técnico (Word) — Solicitud de APIs de AS2

> Pega **todo** este archivo en Claude web y pídele que genere el documento.
> El objetivo final es un `.docx` formal para enviar al proveedor del ERP (Asinfo)
> y a TI de Dynadrill.

---

## 1. Qué necesito que generes

Un **documento técnico formal en Word (`.docx`)** titulado
**"Solicitud de integración AS2 ↔ Portal Dynadrill — Especificación de APIs y catálogos requeridos"**.

- Idioma: **español (Ecuador)**, registro formal-técnico, dirigido a un proveedor de software.
- Extensión objetivo: **6 a 10 páginas**.
- Debe poder imprimirse y adjuntarse a un correo tal cual.
- Usa **tablas** para todos los listados de módulos y para el control de cambios.
- No inventes datos que no estén en este archivo; donde falte información, deja un
  marcador **`[COMPLETAR: ...]`** (ej. nombre del autor, fecha, contactos).
- No incluyas credenciales ni URLs internas de acceso (solo las rutas de módulo `.jsf`).

---

## 2. Contexto (insumo — reescríbelo con tus palabras, no lo copies literal)

### 2.1 Sobre AS2
- AS2 es el ERP de Dynadrill, provisto por **Asinfo** (asinfo.com.ec).
- Instancia productiva: **AS2 ERP versión 3.1.012**, organización **DYNADRILL ECUADOR C.A.**
- Stack: aplicación web Java (WildFly / PrimeFaces). La navegación es por páginas `.jsf`.
- **No existe un módulo de "API" / "servicios web" en el menú de la aplicación.**
  Lo que sí ofrece de forma nativa son **plantillas de carga masiva** (menú
  *Datos Base › Migración*, y procesos *Cargar Pedido Cliente* / *Carga Factura Cliente*).
- Conclusión: la habilitación de una integración programática depende de **Asinfo**
  (exponer un servicio REST/SOAP, o una vista de base de datos de solo lectura).

### 2.2 Sobre el Portal Dynadrill
- Dynadrill está construyendo un **portal web propio** para dos áreas:
  - **Facturación**: pedido → prefactura (ticket) → AOT → envío al cliente.
  - **Operaciones de campo**: reportes de servicio (Pumping / FCR), inspecciones de
    vehículos, gerenciamiento de viajes, mantenimiento de unidades.
- Hoy el portal funciona contra un **gateway simulado**: catálogos cargados a mano
  (clientes, contrato, lista de precios) y numeración de documentos generada
  localmente. Se necesita reemplazar ese simulador por datos reales de AS2.

### 2.3 Proceso de negocio (resumen)
1. **Apertura del servicio**: el área de Ventas registra el **Pedido** del cliente
   (servicio, pozo, valor estimado con una línea). El Pedido es requisito de AS2
   para poder generar la prefactura.
2. **Recepción de información operativa**: el personal de campo llena, día a día,
   el reporte diario y el reporte de herramientas del servicio ejecutado.
3. **Revisión de la prefactura**: Facturación arma el **ticket/prefactura** cruzando
   el reporte de herramientas × la **lista de precios** (código, tarifa, tipo
   Material/Servicio) + consumo de materiales. Verifica OT, contrato, horas,
   transporte, totales, correspondencia con los soportes.
4. **Envío al cliente**: PDF de prefactura + reporte diario + reporte de herramientas
   (firmados) + guía de remisión (solo si hay ítems tipo Material).
5. **Registro en AS2**: recién **después** de verificar con el cliente, se actualiza
   el valor del Pedido en AS2 con los consumos reales y se genera la prefactura /
   factura definitiva. El **número de prefactura/ticket lo asigna AS2**.

### 2.4 Puntos de integración (qué necesita el portal de AS2)
- **Catálogos maestros** (lectura periódica): clientes, contratos, lista de precios,
  productos/unidades, bodegas, vehículos, choferes, transportistas, canales, zonas,
  empleados/vendedores, condición y forma de pago.
- **Pedidos** (dos vías): traer los pedidos que Ventas abre en AS2, y — a futuro —
  registrar en AS2 los que se originen en el portal.
- **Despachos / consumo de bodega** (lectura): materiales realmente despachados,
  para las líneas tipo Material de la prefactura.
- **Prefactura / factura / guía de remisión** (escritura, fase posterior):
  registrar la prefactura verificada y obtener el número oficial.
- **Numeración secuencial**: AS2 es el dueño del correlativo de pedido, prefactura
  y factura; hay que definir cómo se coordina con un sistema externo.

---

## 3. Alcance solicitado — módulos de AS2

> Rutas verificadas sobre el menú de la instancia AS2 3.1.012.
> En el documento, preséntalas **agrupadas por dominio funcional** (como abajo) y,
> además, incluye el **listado plano completo** como Anexo A.

### 3.1 Comercial / Ventas
| # | Módulo AS2 | Ruta | Para qué lo necesita el portal |
|---|---|---|---|
| 1 | Empresa / Cliente | `/AS2/paginas/datosBase/empresa/empresa.jsf`, `/AS2/paginas/datosBase/empresa/actualizarCliente.jsf` | Catálogo de clientes: código, razón social, RUC, subclientes |
| 2 | Lista de Precios | `/AS2/paginas/datosBase/empresa/listaPrecios.jsf` | Tarifario por cliente/contrato: código, descripción, unidad, precio, tipo (Material/Servicio) |
| 3 | Lista de Descuentos | `/AS2/paginas/datosBase/empresa/listaDescuentos.jsf` | Porcentajes de descuento aplicables a la prefactura |
| 4 | Condición de Pago | `/AS2/paginas/datosBase/empresa/condicionPago.jsf` | Cabecera del pedido |
| 5 | Forma de Pago | `/AS2/paginas/datosBase/empresa/formaPago.jsf` | Cabecera del pedido |
| 6 | Contrato | `/AS2/paginas/ventas/procesos/contratoVenta.jsf` | Número de contrato, vigencia y datos del contrato (encabezado de la AOT) |
| 7 | Canal | `/AS2/paginas/ventas/configuracion/canal.jsf` | Cabecera del pedido |
| 8 | Zona | `/AS2/paginas/ventas/configuracion/zona.jsf` | Cabecera del pedido |
| 9 | Pedido Cliente | `/AS2/paginas/ventas/procesos/pedidoCliente.jsf` | Traer pedidos abiertos en AS2 (por fecha) y su estado; a futuro, alta desde el portal |
| 10 | Cargar Pedido Cliente | `/AS2/paginas/ventas/procesos/cargarPedidoCliente.jsf` | Alta masiva de pedidos originados en el portal |
| 11 | Despacho Cliente | `/AS2/paginas/ventas/procesos/despachoCliente.jsf` | Materiales despachados por bodega, para vincularlos a la prefactura |

### 3.2 Inventario / Bodega
| # | Módulo AS2 | Ruta | Para qué lo necesita el portal |
|---|---|---|---|
| 12 | Producto | `/AS2/paginas/inventario/configuracion/producto/producto.jsf` | Código de producto AS2, descripción, categoría |
| 13 | Unidad | `/AS2/paginas/inventario/configuracion/unidad.jsf` | Código de unidad de medida AS2 |
| 14 | Bodega | `/AS2/paginas/inventario/configuracion/bodega.jsf` | Catálogo de bodegas (varias por cliente) |
| 15 | Kardex / Stock | `/AS2/paginas/inventario/reportes/inventarioProducto.jsf`, `/AS2/paginas/inventario/reportes/reporteStock.jsf` | Saldos y movimientos de inventario |
| 16 | Orden Salida Material | `/AS2/paginas/inventario/procesos/ordenSalidaMaterial.jsf` | Consumo real de materiales del servicio |
| 17 | Consumo Bodega | `/AS2/paginas/inventario/procesos/consumoBodega.jsf` | Consumo real de materiales del servicio |
| 18 | Salida de Material | `/AS2/paginas/inventario/procesos/salidaMaterial.jsf` | Consumo real de materiales del servicio |

### 3.3 Transporte
| # | Módulo AS2 | Ruta | Para qué lo necesita el portal |
|---|---|---|---|
| 19 | Vehículo | `/AS2/paginas/inventario/configuracion/vehiculo.jsf` | Catálogo de unidades de transporte |
| 20 | Tipo de Vehículo | `/AS2/paginas/inventario/configuracion/tipoVehiculo.jsf` | Clasificación de unidades |
| 21 | Transportista | `/AS2/paginas/inventario/configuracion/transportista.jsf` | Guía de remisión y gestión de viajes |
| 22 | Chofer | `/AS2/paginas/inventario/configuracion/chofer.jsf` | Conductores (hoy simulados en el portal) |
| 23 | Logística Cliente (opcional) | `/AS2/paginas/ventas/procesos/logisticaCliente.jsf` | Datos de logística asociados al despacho |

### 3.4 Facturación / Comprobantes
| # | Módulo AS2 | Ruta | Para qué lo necesita el portal |
|---|---|---|---|
| 24 | Prefactura Cliente | `/AS2/paginas/ventas/procesos/prefacturaCliente.jsf` | Número de prefactura y registro de la prefactura verificada |
| 25 | Liberar Prefactura Cliente | `/AS2/paginas/ventas/procesos/liberarPrefacturaCliente.jsf` | Liberación de la prefactura |
| 26 | Factura Cliente | `/AS2/paginas/ventas/procesos/facturaCliente.jsf` | Emisión de la factura (fase posterior) |
| 27 | Guía de Remisión Electrónica | `/AS2/paginas/comprobantesElectronicos/guiaRemisionElectronica.jsf` | Número oficial de guía de remisión (SRI) |

### 3.5 Maestros / Seguridad
| # | Módulo AS2 | Ruta | Para qué lo necesita el portal |
|---|---|---|---|
| 28 | Empleado Genérico | `/AS2/paginas/datosBase/empleadoGenerico.jsf` | Agentes comerciales / vendedores |
| 29 | Persona Responsable | `/AS2/paginas/datosBase/personaResponsable.jsf` | Responsables de documentos |
| 30 | Especialidad | `/AS2/paginas/datosBase/especialidad.jsf` | Especialidad de chofer / empleado |
| 31 | Usuario | `/AS2/paginas/seguridad/usuario/usuario.jsf` | Identidades (a evaluar si se sincroniza) |
| 32 | Rol | `/AS2/paginas/seguridad/rol.jsf` | Roles (a evaluar si se sincroniza) |
| 33 | Secuencia | `/AS2/paginas/datosBase/secuencia.jsf` | Numeración de pedido / prefactura / factura |

---

## 4. Consultas para el proveedor (Asinfo) — incluir como sección propia

1. ¿AS2 dispone de **API (REST o SOAP)** para consulta y registro de estos módulos?
   De ser así, solicitamos documentación y credenciales de un **ambiente de pruebas**.
2. Si no existe API, ¿qué alternativas hay — **vista de base de datos de solo lectura**
   o **plantillas de carga** — y qué limitaciones tienen (tiempo real vs. lotes,
   validaciones, campos disponibles)?
3. **Autenticación** y requisitos de red: usuario de servicio, whitelisting de IP, VPN.
4. **Numeración (módulo Secuencia)**: ¿cómo se coordina el correlativo de pedido,
   prefactura y factura entre AS2 y un sistema externo? ¿El portal *reserva* un número
   o *confirma* uno ya consumido?
5. **Reconciliación**: clave natural para identificar un pedido y evitar duplicados.
6. **Frecuencia y notificación**: ¿AS2 puede notificar cambios (webhook) o solo admite
   consulta por sondeo? ¿Cada cuánto?
7. **Despacho / consumo de bodega**: ¿es consultable como dato estructurado o solo
   como documento?

---

## 5. Estructura que debe tener el documento Word

1. **Portada** — título, "Dynadrill Ecuador C.A.", destinatario ("Asinfo — Soporte / Integraciones"), versión, fecha, autor. Usar `[COMPLETAR]` donde falte.
2. **Control de versiones** — tabla (versión, fecha, autor, descripción).
3. **1. Introducción y antecedentes** — qué es AS2, qué es el portal Dynadrill, por qué se necesita la integración (basado en la sección 2 de este archivo).
4. **2. Objetivo del documento** — 1 párrafo.
5. **3. Alcance** — qué entra y qué no (fase 1: lectura de catálogos y pedidos; fase 2: escritura de prefactura/factura).
6. **4. Situación actual** — el portal opera con un gateway simulado; describir brevemente.
7. **5. Arquitectura objetivo** — párrafo + diagrama textual simple (Portal ⇄ [capa de integración] ⇄ AS2).
8. **6. Catálogos y procesos requeridos** — las 5 tablas agrupadas de la sección 3, con una breve introducción por grupo.
9. **7. Requisitos no funcionales** — autenticación, seguridad de red, disponibilidad, volumen estimado, frecuencia de sincronización, ambiente de pruebas.
10. **8. Modalidad de integración esperada** — describir las opciones (API REST/SOAP preferida; vista BD; archivos) y la preferencia de Dynadrill.
11. **9. Consultas para el proveedor** — la lista de la sección 4.
12. **10. Próximos pasos** — reunión técnica, definición de modalidad, plan por fases.
13. **Anexo A — Listado completo de módulos y rutas** — tabla plana con los 33 ítems (# / módulo / ruta).
14. **Anexo B — Glosario** — Pedido, Prefactura/Ticket, AOT, Lista de Precios, Guía de Remisión, BOM, Kardex.

---

## 6. Formato y estilo

- Encabezado de página con el título corto del documento; pie de página con número de página y "Confidencial — Dynadrill".
- Títulos numerados, fuente legible (Calibri/Arial 11), interlineado 1.15.
- Tablas con encabezado sombreado y bordes finos.
- Sin lenguaje comercial ni marketing; frases cortas y precisas.
- No usar el término "lectura/escritura" como clasificación visible en las tablas del
  cuerpo; esa distinción va solo, de forma narrativa, en la sección de Alcance (fase 1 / fase 2).
- Entregar el resultado como archivo **`.docx`** descargable.
