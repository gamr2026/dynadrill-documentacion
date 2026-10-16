# Plan de migración: Operaciones / Pumping

> Estado al 16/10/2026: **fase O1 construida** (el ticket nace del pedido abierto y llega al Jefe de Base). Lo demás está
> planificado aquí. Fuente: lectura de la demo (`dynadrill-backend/libs/domains/operaciones`, `dynadrill-frontend/.../operations/pumping`)
> y de `PLAN-QHSE-PUMPING-NOTIFICACIONES.md`. La demo no se modificó.

## 1. Cómo funciona Pumping en la demo

Un pedido de la línea Pumping crea de inmediato su **ticket** (la demo lo numera `PUMP-2026-00459`, correlativo desde 458; **el portal nuevo no usa esa numeración**: el ticket es la prefactura y lleva su número) y un PTW para QHSE. El
ticket recorre 11 pasos; cada uno lo atiende un rol:

| # | Paso | Rol | Qué se hace | Condiciones para salir |
|---|---|---|---|---|
| 1 | Revisión inicial | Jefe de Base | Revisa la propuesta (los datos del pedido) | — |
| 2 | Asignación | Jefe de Base | Asigna supervisor, operadores con su unidad y químicos (salida de bodega real contra Inventario) | Abre el checklist QHSE de equipos por cada unidad |
| 3 | Traslado de salida | Operador | Reporte de unidad (DYN-MNT-RE-012: hubodómetro, combustible...), gerenciamiento de viaje | QHSE aprobó el checklist de **todas** las unidades, checklist de ingreso a locación completo y EPI despachado a cada operador |
| 4 | Revisión de reportes de salida | Supervisor / Sup. Pumping | Revisa | — |
| 5 | Ejecución operativa | Operador | Llena el Reporte Diario (DYN-SGI-RE-047, Reporte Job); consumo de químicos | — |
| 6 | Control de retorno | Supervisor | Cuadra químicos y herramientas | — |
| 7 | Traslado de llegada | Operador | Reporte de unidad de llegada | — |
| 8 | Mantenimiento | Supervisor | Atiende novedades de la unidad (ticket aparte en Mantenimiento) | Sin sub-órdenes abiertas de la unidad |
| 9 | Revisión de reportes de llegada | Supervisor | Revisa | — |
| 10 | Revisión final | Supervisor | Aprueba o rechaza (vuelve al paso 9 con motivo) | — |
| 11 | Cierre | Supervisor | Cierra el ticket | — |

Además: documentos del ticket (monitoreo por día), solicitudes de cambio de ítems (el Operador propone, el Supervisor aprueba y
se recalcula la prefactura), y el **empuje de cada Reporte Diario al pedido** como documento operativo (`origen: pumping`),
que es lo que alimenta la prefactura en Facturación.

Problemas de la demo que no se heredan: el ticket guarda todo en un `payload` JSON; operadores, unidades y supervisores están
**fijos en el código** (`OPERATOR_DATA`, `UNIT_DATA`, `SUPERVISOR_NAMES`); el Reporte Diario "vive solo en la memoria del
frontend"; los pasos se guardan como texto y el historial como JSON; el rol responsable se copia en el frontend y en el backend.

## 2. Diseño nuevo

- **Contenedor `operaciones`** (puerto 3103), ya previsto en la arquitectura: usuario `app_operaciones`, schemas `fcr`, `pumping`,
  `flota`, `mantenimiento`, `inventario` y `msg_operaciones`. Un módulo por schema (`libs/operaciones/pumping`, `@dyn/pumping`).
- **Comunicación por eventos** (outbox/inbox sobre RabbitMQ), sin tocar tablas ajenas:
  - `comercial.pedido.abierto` → `operaciones` crea el ticket (una sola vez aunque el evento llegue repetido).
  - `operaciones.pumping.ticket_creado` y `operaciones.pumping.paso_cambiado` → quien los necesite (comercial, QHSE, avisos).
  - A construir: `operaciones.pumping.reporte_diario_recibido` → `comercial` lo registra como documento operativo (hoy entra por API).
  - Los pasos del pedido que ya esperan estos eventos (`operaciones.ticket.iniciado`, `operaciones.reporte.recibido`,
    `operaciones.ticket.cerrado`) están sembrados en el motor de estados de `comercial`.
- **Pasos y roles en base de datos** (`paso`, `paso_rol`, `transicion`, `ticket_historial`), no en el código ni copiados al frontend.
  Solo existen las transiciones que el módulo ya sabe validar; cada fase agrega las suyas con sus condiciones.
- **Personas y catálogos por referencia**: supervisores y operadores salen de `identidad` (rol), las unidades del módulo `flota`;
  el ticket guarda id + copia del nombre, sin FK entre schemas.

## 3. Fases

| Fase | Contenido | Estado |
|---|---|---|
| **O1** | Contenedor `operaciones`; ticket creado del pedido abierto; bandeja del Jefe de Base (por permiso y rol del paso); revisión inicial → asignación; historial | **Hecha** |
| **O2** | Asignación completa: supervisor, operadores y unidades (de `identidad` y `flota`), químicos con salida de bodega (requiere `inventario`) | Pendiente |
| **O3** | Reporte Diario (Reporte Job) persistido en servidor, por día, con sus actividades; **empuje al pedido** (`comercial` lo recibe por evento). Destraba la prefactura sin cargar por API | Pendiente |
| **O4** | Traslado de salida con sus condiciones: reporte de unidad, checklist de ingreso, checklist QHSE de equipos y EPI (dependen de QHSE y Flota) | Pendiente |
| **O5** | Revisión de reportes, control de retorno, traslado de llegada, mantenimiento, revisión final y cierre (con rechazo); el pedido pasa a "documentos completos" al cerrar | Pendiente |
| **O6** | Documentos del ticket, solicitudes de cambio de ítems, conductor y gerenciamiento de viaje | Pendiente |

Dependencias de otros módulos: Flota (unidades), Inventario (químicos y despachos), QHSE (PTW, checklists, EPI), Mantenimiento
(sub-órdenes). Conviene migrar Flota e Inventario antes de O2 o acordar una puerta temporal.

## 4. Lo construido en O1

- Schema `pumping`: `paso`, `paso_rol`, `transicion`, `ticket` (copia del pedido con ids de catálogo + nombre),
  `ticket_tipo_servicio`, `ticket_historial`; enums `macro_estado` y `origen_cambio`.
- Número de ticket: el de la prefactura que vendrá. `comercial` lo reserva del secuencial de la prefactura al abrir el pedido (`pedido.ticket_numero`, también en el evento `comercial.pedido.abierto`) y la prefactura lo hereda; el ticket de Pumping lo copia.
- API `/api/operaciones/pumping/tickets` (lista con `mios`, `paso`, `q`), `/tickets/:id` y `/tickets/:id/avanzar`; permiso
  `pumping.tickets.operar`; solo el rol del paso (o Superadmin) avanza.
- El evento `comercial.pedido.abierto` ahora trae los nombres (cliente, campo, bloque, pozo, taladro).
- Pantallas "Pedidos de Pumping" (bandeja y detalle) en el menú de Jefe de Base, Supervisor Pumping, Operador y Superadmin.
- Avisos: al crearse el ticket, el Jefe de Base recibe un aviso en la campanita y un correo (módulo `avisos` de plataforma, evento `operaciones.pumping.ticket_creado`).
- Gateway: `/api/operaciones` va al contenedor; los prefijos de la demo (`/api/operations`, `/api/unidades`...) siguen en la demo.

## 5. Lo que cambia para las personas

En el menú actual el **Jefe de Base solo ve Pumping y Gerenciamiento de Viaje** (a pedido del cliente), no Facturación. Por eso la
bandeja "Pedidos de Pumping" es la puerta del Jefe de Base a los pedidos nuevos, y el enlace "Ver pedido en Facturación" solo
aparece si su rol tiene permiso sobre pedidos.

## 6. Consultas abiertas

Ver `facturacion/CONSULTAS-PARA-DYNADRILL.md`, sección Operaciones (O5 a O8).
