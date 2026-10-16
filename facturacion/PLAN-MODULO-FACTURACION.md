# Plan — Reescritura del Módulo de Facturación

> Rama de trabajo: `feature/facturacion-proceso-completo` (dynadrill-frontend)
> Fuente del proceso: `documentacion/facturacion/PASOS DEL PROCESO.txt` + soportes de esta carpeta
> Estado: **Fases 0–8 implementadas** (build + typecheck en verde). Pendiente: revisión en fase de pruebas y ajustes.

---

## 1. Contexto

El módulo de Facturación actual (`src/app/features/facturacion`) implementa un esqueleto
conceptual (OTQ → documentación diaria → prefactura calculada → ticket → facturado) que
**cubre ~30-40%** del proceso descrito por el cliente y arrastra diferencias de modelo.
Este plan lo **reescribe** alrededor del ciclo real y del vocabulario del negocio.

### Alcance confirmado

| # | Decisión |
|---|---|
| 1 | El app llega **hasta el paso 4**: prefactura generada + todos los soportes listos → envío al cliente → firma **o rechazo**. Pasos 5-7 (registro AS2, emisión SRI, cobro) = export + placeholder. |
| 2 | **Pedido bidireccional** portal ↔ AS2 vía API (todo **mock** en esta fase; el gateway simula ambos lados). |
| 3 | **Sin roles nuevos.** La captura operativa se queda en FCR / Pumping; se agrega la **conexión** hacia Facturación (documentos + campana). |
| 4 | Reporte de Herramientas: se **reutiliza el modelo de FCR** (`FcrToolUsageEntry`, estados O/S/D/V) y el formato de `COMP. 4130_SCHF-246`. |
| 5 | **Lista de Precios multicliente** con CRUD. |
| 6 | **AOT en esta fase.** AOT = formato de la pestaña **OTQ** de `COMP. 4130` (*"ORDEN DE TRABAJO / RESUMEN DE COSTOS"*, numeración OPR). |
| 7 | **Reescribir el vault** (FACT-001 … FACT-005 + conceptos) con este proceso. |
| 8 | **Bodega / BOM: fuera** del app (interno de AS2, solo referenciado). |
| 9 | **4 líneas de servicio**: `Fishing`, `Pumping`, `Completion`, `CTU` (las del Secuencial Tk Control). |
| 10 | En el **paso 1**, Ventas captura **una sola línea estimada** (código + cantidad + valor) = base "cotizado" para el reporte *cotizado vs. real*. |
| 11 | IVA **15%** (vigente Ecuador desde 2024, confirmado en la hoja `Facturado`). |

---

## 2. Reconciliación de modelo (vocabulario)

| Término | Qué es | Quién lo maneja |
|---|---|---|
| **Pedido** | Entidad ancla. Nace en AS2 o en el portal (bidireccional). Cabecera completa + 1 línea estimada. Número secuencial compartido con AS2. | Ventas |
| **Reporte Job** (DYN-SGI-RE-047) | Bitácora diaria de actividades (día / hora / duración / detalle / pozo). | Operador (FCR / Pumping) |
| **Reporte de Herramientas** (DYN-FCR-RE-008) | Matriz herramienta × serie × día, estado **O/S/D/V**; totales alimentan el Ticket. | Operador (**solo FCR**) |
| **Prefactura / Ticket** | Se **arma** cruzando Reporte de Htas × Lista de Precios + materiales + personal. "Nada sale inventado". | Facturación |
| **AOT** | Documento oficial final generado del Ticket firmado. Cabecera fija, detalle = prefactura, numeración OPR. Firmas físicas. | Facturación |
| **Guía de Remisión** | Documento de traslado de mercadería. Solo si hay ítems **tipo Material**. Se hace **después** de los PDF. | Facturación |
| **Lista de Precios** | Tarifario por **cliente/contrato**. Ítems: `código, descripción, unidad, precio, tipo (Material/Servicio)`. Códigos vienen de AS2. | Facturación (CRUD) |

> El código actual llama **"OTQ"** al ancla — eso desaparece. El ancla es el **Pedido**.
> La "cotización de Ventas" se reduce a **1 línea estimada** dentro del Pedido (decisión 10).

---

## 3. Máquina de estados del Pedido

```
BORRADOR                         (Ventas creando)
  └─> ABIERTO                    (registrado en portal o AS2, esperando ejecución)
        └─> EN_OPERACION         (trabajo en campo)
              └─> EN_ELABORACION_OPERATIVA   (operadores cargando Reporte Job / Htas)
                    └─> DOCUMENTOS_COMPLETOS (todos los soportes recibidos)
                          └─> EN_REVISION_PREFACTURACION  (Facturación revisa / arma)
                                ├─> EN_CORRECCION  ──► (devuelto a la persona; vuelve a revisión)
                                └─> PREFACTURA_GENERADA   (prefactura + paquete PDF listo)
                                      └─> ENVIADO_PARA_FIRMAS   (al cliente)
                                            ├─> RECHAZADO_POR_CLIENTE ──► EN_CORRECCION
                                            └─> TICKET_FIRMADO
                                                  └─> AOT_GENERADA   ◄── FIN DEL ALCANCE DEL APP
                                                        └─> (placeholder) ENVIADO_A_CONTROL_DE_COSTOS
                                                              └─> (placeholder) LISTO_PARA_FACTURAR
                                                                    └─> (placeholder) FACTURADO
```

Estados alineados con la dimensión **STATUS** de `VENTAS_DYNADRILL_2026.xlsm` y con
`Estado Servicio / Estado TKT / Estado OT` del Secuencial Tk Control.

### Semáforo de tiempos (del Secuencial Tk Control)

| Métrica | Cálculo | Verde | Amarillo | Rojo |
|---|---|---|---|---|
| `DIAS_PREFACTURACION` | Fin de servicio → `DOCUMENTOS_COMPLETOS` | ≤ 3 | 4–7 | > 7 |
| `DIAS_FIRMA` | `ENVIADO_PARA_FIRMAS` → `TICKET_FIRMADO` | ≤ 3 | 4–7 | > 7 |

En rechazo / retraso se captura la **razón** (ej. "cliente de vacaciones") — la automatización
no garantiza que el cliente firme más rápido.

---

## 4. Conexión FCR / Pumping → Facturación

| | Reporte Job | Reporte de Htas | Persistencia hoy | Trabajo en Fase 3 |
|---|---|---|---|---|
| **FCR** | `FcrTicket.activityLog` | `FcrTicket.toolUsageLog` (O/S/D/V) | Sí | Link al Pedido + aviso a campana + lectura desde Facturación |
| **Pumping** | `DailyActivityReport` | — (no aplica) | **No** (solo memoria) | Persistir (endpoint mock) + link + aviso + lectura |

- Cada ticket **FCR / Pumping** se vincula al **Pedido** por el número de ticket compartido.
- Al firmar/completar un documento, el módulo operativo empuja una fuente a
  `NotificationsService` → el facturador ve en la **campana**:
  *"Juan cargó el Reporte de Htas · Pozo BETA-9 · Ticket 4313"*.
- En el detalle del Pedido, Facturación ve un **panel de avance**:
  *"Reporte Job: 3/5 días · Reporte de Htas: al día · Materiales: pendiente"*.
  Cuando está completo → habilita **"Generar prefactura"**.
- Los modelos `FcrActivityLogEntry`, `FcrToolUsageEntry`, los enums O/S/D/V y los PDF
  `reporte-job-pdf-dialog` / `reporte-herramientas-pdf-dialog` / `solicitar-correccion-dialog`
  se **extraen a `shared/`** para que FCR y Facturación los consuman sin acoplarse.

---

## 5. Reportería (paso "REPORTES DEL APLICATIVO")

Fuente de formato: `VENTAS__DYNADRILL_2026.xlsm` + `Secuencial Tk Control EXP 2025201`.

| # | Reporte | Dimensiones | Métricas |
|---|---|---|---|
| 1 | Ventas & Nº trabajos por mes | Mes | Revenue real, Jobs |
| 2 | Ingresos por pozo y línea de servicio | Pozo, Línea (Fishing/Pumping/Completion/CTU) | Revenue real |
| 3 | Estado de tickets por cliente (accruals) | Cliente, Estado de proceso | Accrual (por facturar), Nº tickets, Días |
| 4 | Cotizado vs. real | Pedido | Valor estimado (Ventas) vs. valor prefactura |
| 5 | Reporte de ventas estilo *Secuencial Tk Control* | OT, Cliente, Ticket, Línea, Pozo, Rig, Analista, Vendedor, Rep. Campo, Rep. Quito, fechas, estados | Semáforo `DIAS_PREFACTURACION` / `DIAS_FIRMA` |

Export CSV/Excel. Semáforo con umbrales configurables.

---

## 6. Entidades de datos (nuevas / reescritas)

```
Pedido
  id, code (secuencial AS2), origen: 'as2' | 'portal', as2Ref, lastSyncedAt
  cliente, subcliente, clienteRuc
  lineaServicio: 'fishing' | 'pumping' | 'completion' | 'ctu'
  campo, bloque, pozo, taladroRig
  numeroContrato
  agenteComercial (vendedor Dynadrill)
  representanteCampo (PEC), representanteQuito (PEC)
  analistaFacturacion
  condicionPago, zona, canal, bodega
  itemEstimado: { codigo, descripcion, unidad, cantidad, valorEstimado }
  fechaInicioServicio, fechaFinServicio
  estado: EstadoPedido
  historialEstados: { estado, fecha, usuario, motivo? }[]

ListaPrecios
  id, cliente, numeroContrato, vigenteDesde, activa
  items: ListaPreciosItem[]
ListaPreciosItem
  codigo, descripcion, unidad, precio, tipo: 'Material' | 'Servicio'

DocumentoOperativo (referencia; el dato vive en FCR/Pumping)
  pedidoId, origen: 'fcr' | 'pumping'
  tipo: 'reporte_job' | 'reporte_herramientas'
  ticketOperativoId, estado, firmadoPor, firmadoAt, pdfDisponible

Prefactura  (= Ticket de Facturación)
  id, code, pedidoId
  items: PrefacturaItem[]   // armados desde Reporte Htas × LP + materiales + personal
  PrefacturaItem: { codigo, descripcion, unidad, serie?, cantidad, precioUnitario,
                    precioTotal, tipo, fuente: 'htas' | 'material' | 'personal' | 'cambio_alcance' }
  subtotalServicios, subtotalMateriales, subtotal, iva (15%),
  retencionIR, retencionIVA, netoCobrar
  estado, envioCliente?: { enviadoAt, medio }, firmaCliente?, rechazoCliente?

RechazoCliente
  motivo, razonRetraso?, fecha, itemsObservados?, devueltoA (persona), seguimiento

AOT   // = pestaña "OTQ" de COMP.4130 → "ORDEN DE TRABAJO / RESUMEN DE COSTOS". Verificado 1:1 contra el archivo.
  id, pedidoId, prefacturaId
  numeroOt,        // secuencial propio (692, 425, 848…), distinto del nº de ticket
  ciudad,          // 'UIO'… (para el código OPR)
  numeroOpr,       // = `${numeroOt}-OPR-${pozo}-${ciudad}-${año}`  (asocia ticket ↔ AOT)
  fecha,           // = fechaInicioServicio - 1 día
  numeroContrato, contratoTexto,   // párrafo largo, fijo por contrato
  descripcionRequerimiento,        // "Descripción del Requerimiento o de la Orden de Trabajo"
  servicio,        // = servicio + '/' + pozo + '/' + rig
  fechaInicio, fechaTerminacion,   // de la prefactura/pedido
  detalle: AotItem[],              // = detalle de la prefactura (codigo, servicio, unidad, tarifa, cantidad, total)
  valorOt,         // = suma del detalle (derivado)
  representanteContratista: { nombre, cargo },   // ej. "Ab. Mónica Rojas" / "Representante Legal"
  representanteCliente:     { nombre, cargo },   // editable — de quien solicitó el servicio
  estado: 'generada' | 'firmada'   // firmas físicas → flag manual
  // Cabecera (contratista, contrato, nº, servicio, fechas, representantes) NO editable una vez generada.

Excepcion  (cambio de alcance / sobrepaso — se conserva, adaptada al Pedido)
GuiaRemision  (solo si hay ítems tipo Material)
```

---

## 7. Plan por fases

> Cada fase deja el proyecto **compilando** y el módulo **navegable**.
> Revisión del cliente entre fases.

**Estado: Fases 0–8 completas.** Resumen de lo entregado en `documentacion/facturacion/AVANCE-IMPLEMENTACION.md`.

### Fase 0 — Fundaciones: modelo + vault + mocks

- Reescribir `facturacion.model.ts` con las entidades de §6.
- Extraer a `shared/`: `ActivityLogEntry`, `ToolUsageEntry`, enums O/S/D/V, los 3 diálogos
  PDF/corrección de FCR. FCR pasa a consumirlos desde `shared`.
- Reescribir el vault:
  - `procesos/FACT-001` — Apertura del servicio (Pedido, bidireccional)
  - `procesos/FACT-002` — Recepción de información operativa (Reporte Job / Htas)
  - `procesos/FACT-003` — Revisión de la prefactura + devoluciones/rechazos
  - `procesos/FACT-004` — Envío al cliente + AOT
  - `procesos/FACT-005` — Reportería
  - Conceptos: `Pedido`, `Prefactura`, `Ticket`, `AOT`, `Reporte-Job`, `Reporte-de-Herramientas`,
    `Lista-de-precios`, `Guia-de-Remision`. Actualizar `00-MOC/MOC-Procesos`, `areas/Facturacion`.
- Reescribir seeds de `facturacion-mock.interceptor.ts` alrededor de `Pedido`.
- Reemplazar rutas/páginas OTQ-céntricas por un shell mínimo de **Pedidos** (lista + detalle
  read-only) para que el módulo siga navegable.

### Fase 1 — Pedido + alta por Ventas + sync AS2 (mock bidireccional)

- Entidad `Pedido` completa + 4 líneas de servicio.
- Pantalla **"Nuevo Pedido"** (rol Ventas) con toda la cabecera + 1 línea estimada.
- **Gateway AS2 mock bidireccional**: lista única de pedidos; alta desde el portal se "empuja"
  al mock AS2; el mock AS2 puede sembrar/agregar pedidos; numeración secuencial compartida.
- Lista de Pedidos en Facturación con estado de proceso y filtros.

### Fase 2 — Lista de Precios multicliente (CRUD)

- Entidad `ListaPrecios` por cliente/contrato, ítems con `tipo`.
- CRUD: crear lista, importar (plantilla), editar/agregar/quitar ítems, activar/desactivar.
- El selector de ítems (prefactura, cambio de alcance) usa la lista del **cliente del Pedido**.
- Reemplaza la página "Lista de precios" actual (mono-tarifario).

### Fase 3 — Conexión operativa (FCR + Pumping → Facturación)

- Vínculo ticket operativo ↔ Pedido.
- **FCR**: aviso a campana al firmar Reporte Job / Reporte Htas; lectura desde el detalle
  del Pedido + PDF.
- **Pumping**: endpoint mock para persistir `DailyActivityReport` + link al Pedido + aviso a
  campana + lectura desde el detalle del Pedido. (Sin Reporte de Htas.)
- Panel de avance de documentos en el detalle del Pedido → habilita "Generar prefactura".

### Fase 4 — Prefactura / Ticket

- El Ticket se **arma** cruzando: Reporte de Htas (días O/S/D + series) × Lista de Precios
  (tarifa + tipo) + consumo de materiales + hojas de tiempo.
- Cantidades/series/precios no editables libremente (vienen de los soportes).
- Cambio de alcance contra el catálogo del cliente (ya avanzado en `feature/ajustes-...`).
- Liquidación: subtotales Material/Servicio, IVA 15%, retenciones IR/IVA, neto a cobrar.
- PDF de Prefactura formato `DYN-AFN-RE-11B` (ya existe base — se ajusta al nuevo modelo).

### Fase 5 — Revisión + envío al cliente + rechazos

- **Checklist de revisión** de Facturación (datos generales, OT, contrato, horas, transporte,
  totales, tarifas, cantidades, materiales, htas, correspondencia ticket↔soportes, integridad).
- **Devolución dirigida** a la persona que llenó el documento, con notificación y **seguimiento
  aunque se haya trasladado de pozo**.
- Estados: `PREFACTURA_GENERADA` → `ENVIADO_PARA_FIRMAS` → `TICKET_FIRMADO` /
  `RECHAZADO_POR_CLIENTE` (motivo + razón del retraso).
- **Paquete de envío**: PDF de Ticket + Reporte Job + Reporte de Htas + adjuntos según servicio
  (BHA, gráficos, OpenWells — upload simulado).
- **Guía de Remisión**: se habilita **solo si hay ítems tipo Material** y **después** de los
  otros PDF.

### Fase 6 — AOT

- Generar AOT del Ticket firmado (entidad `AOT` de §6, verificada 1:1 contra la pestaña
  "OTQ" de `COMP. 4130_SCHF-246`):
  - `numeroOt` secuencial propio + `numeroOpr` = `{numeroOt}-OPR-{POZO}-{CIUDAD}-{AÑO}`.
  - Fecha = `fechaInicioServicio - 1 día`.
  - Servicio = servicio + `/POZO/RIG`.
  - Encabezado (contratista, contrato + párrafo, nº, servicio, fechas, representantes) **fijo**;
    detalle = prefactura; `valorOt` = suma del detalle.
  - `representanteCliente` editable (de quien solicitó el servicio); `representanteContratista`
    por defecto Representante Legal.
- PDF imprimible (firmas físicas). Estado `generada` → `firmada` (flag manual).

### Fase 7 — Reportería

- Los 5 reportes de §5 + semáforo + cotizado vs. real.
- Export CSV/Excel. Filtros por período / cliente / línea / estado.

### Fase 8 — Cierre de alcance

- Export del **Excel plantilla de carga a AS2** (`Codigo Producto AS2 / Codigo Unidad AS2 /
  Cantidad / Descripción / Precio / % Descuento`).
- Placeholder "registro en AS2 tras firma del cliente".
- Wiring de roles (Ventas / Operador / Facturación) en sidebar y guards. Limpieza de código
  muerto del módulo anterior.

---

## 8. Fuera de alcance (esta fase)

- Integración real con la API de AS2 (todo mock).
- Emisión electrónica SRI-Core (paso 6).
- Seguimiento de cobro (paso 7).
- Proceso BOM / despachos de Bodega (interno de AS2).
- Reporte de Herramientas para Pumping (no aplica al negocio).
- OpenWells como sistema (solo se adjunta el PDF que provee el cliente).

---

## 9. Riesgos / decisiones abiertas

| Tema | Nota |
|---|---|
| Reescritura vs. incremento | Es una **reescritura del módulo**. Las pantallas OTQ-céntricas actuales se reemplazan; hay ventana de "módulo en obra" que se mitiga con el shell mínimo de Fase 0. |
| Acoplamiento operativo | FCR y Pumping tendrán que exponer datos/eventos a Facturación. Se resuelve extrayendo a `shared/` + `NotificationsService`, sin dependencia inversa. |
| Numeración secuencial | El nº de ticket lo "posee" AS2. En mock lo genera el gateway; al conectar la API real hay que ceder la autoridad. |
| Formato de soportes no estándar | El cliente aclaró que **no hay formato estándar** por servicio. Los PDF cubren el caso común; los adjuntos (BHA, gráficos) van como upload libre. |
| Multi-cliente en LP | Hoy solo existe Petroecuador (2025201). El CRUD queda listo; otras listas se cargan cuando el negocio las tenga. |
