# Paridad visual del frontend con la demo

Inventario de páginas para la fase de diseño (27/10/2026). La demo es `origin/main` de `DIGITEC-IT-PROJECTS/dynadrill-frontend` (desplegada en `dynadrill.digitec.com.ec`); el frontend nuevo es `gamr2026/dynadrill-frontend-platform`, rama `diseno/facturacion-demo`.

**Método por página:** abrir la misma pantalla en la demo y en el frontend nuevo, en escritorio (1440 px) y móvil (390 px), capturar las dos y ajustar hasta que coincidan en estructura, jerarquía, espaciado y textos. Los datos son de prueba y se restauran al terminar.

> **Plan vigente de lo que falta:** `PLAN-CIERRE-FRONTEND.md` (27/10/2026). Este documento conserva el inventario de rutas y el avance por pantalla.

## Resultado del inventario de rutas

El frontend nuevo ya tiene **todas las rutas de la demo**, salvo `qhse/ptw/:id` (la demo abre el PTW en una página propia; el nuevo lo abre en un diálogo). Además agrega rutas que la demo no tiene: Flota, Auditoría, Encuestas, Roles y permisos, Aprobaciones de Pumping, Derrames, Emergencias, Investigaciones, SWA y Términos. Esas no tienen contra qué compararse: se diseñan con el sistema de diseño del propio proyecto.

## Estado por módulo

Leyenda: **Hecho** = comparado y ajustado; **Por comparar** = existe en ambos, falta la comparación visual; **Solo nuevo** = no existe en la demo.

### Acceso

| Ruta | Demo | Nuevo | Estado visual |
|---|---|---|---|
| `(raíz del módulo)` | sí | sí | Por comparar |

### Dashboard

| Ruta | Demo | Nuevo | Estado visual |
|---|---|---|---|
| `(raíz del módulo)` | sí | sí | Por comparar |

### Facturación

| Ruta | Demo | Nuevo | Estado visual |
|---|---|---|---|
| `(raíz del módulo)` | sí | sí | Por comparar |
| `/aots/:id` | sí | sí | Por comparar |
| `/catalogos` | sí | sí | Por comparar |
| `/lista-precios` | sí | sí | Por comparar |
| `/lista-precios/:id` | sí | sí | Por comparar |
| `/pedidos` | sí | sí | Hecho (escritorio y móvil) |
| `/pedidos-demo` | — | sí | Solo nuevo |
| `/pedidos-demo/:id` | — | sí | Solo nuevo |
| `/pedidos/:id` | sí | sí | Hecho (escritorio y móvil) |
| `/pedidos/:id/editar` | — | sí | Solo nuevo |
| `/pedidos/:id/orden-trabajo` | — | sí | Solo nuevo |
| `/pedidos/nuevo` | — | sí | Solo nuevo |
| `/prefacturas` | sí | sí | Por comparar |
| `/prefacturas/:id` | sí | sí | Estilos idénticos a la demo; contenido distinto por estado |
| `/reporteria` | sí | sí | Por comparar |

### Operaciones (entrada)

| Ruta | Demo | Nuevo | Estado visual |
|---|---|---|---|
| `/fcr` | sí | sí | Por comparar |
| `/pumping` | sí | sí | Por comparar |

### Operaciones · Pumping

| Ruta | Demo | Nuevo | Estado visual |
|---|---|---|---|
| `(raíz del módulo)` | sí | sí | Por comparar |
| `/:id` | sí | sí | Por comparar |
| `/aprobaciones` | sí | sí | Por comparar |
| `/pedidos` | — | sí | Solo nuevo |
| `/pedidos/:id` | — | sí | Solo nuevo |
| `/pedidos/aprobaciones` | — | sí | Solo nuevo |

### Operaciones · FCR

| Ruta | Demo | Nuevo | Estado visual |
|---|---|---|---|
| `(raíz del módulo)` | sí | sí | Por comparar |
| `/:id` | sí | sí | Por comparar |
| `/configuracion-codigos` | sí | sí | Por comparar |
| `/pedidos` | — | sí | Solo nuevo |
| `/pedidos/:id` | — | sí | Solo nuevo |

### Inventario

| Ruta | Demo | Nuevo | Estado visual |
|---|---|---|---|
| `(raíz del módulo)` | sí | sí | Por comparar |
| `/articulos` | sí | sí | Por comparar |
| `/articulos/:id` | sí | sí | Por comparar |
| `/despachos` | sí | sí | Por comparar |
| `/vehiculos` | sí | sí | Por comparar |

### Mantenimiento

| Ruta | Demo | Nuevo | Estado visual |
|---|---|---|---|
| `(raíz del módulo)` | sí | sí | Por comparar |
| `/gerenciamiento-viaje` | sí | sí | Por comparar |
| `/kpis` | sí | sí | Por comparar |
| `/mis-tareas` | sí | sí | Por comparar |
| `/mis-viajes` | sí | sí | Por comparar |
| `/operativo` | sí | sí | Por comparar |

### QHSE

| Ruta | Demo | Nuevo | Estado visual |
|---|---|---|---|
| `(raíz del módulo)` | sí | sí | Por comparar |
| `/aspectos-ambientales` | sí | sí | Por comparar |
| `/dashboard` | sí | sí | Por comparar |
| `/derrames` | — | sí | Solo nuevo |
| `/derrames/:id` | sí | sí | Por comparar |
| `/derrames/bandas` | — | sí | Solo nuevo |
| `/desechos` | sí | sí | Por comparar |
| `/desechos/:id` | sí | sí | Por comparar |
| `/documentos` | sí | sí | Por comparar |
| `/emergencias` | — | sí | Solo nuevo |
| `/emergencias/:id` | sí | sí | Por comparar |
| `/epi` | sí | sí | Por comparar |
| `/eventos` | sí | sí | Por comparar |
| `/eventos-criticos` | sí | sí | Por comparar |
| `/inspecciones` | sí | sí | Por comparar |
| `/investigaciones` | — | sí | Solo nuevo |
| `/investigaciones/:id` | sí | sí | Por comparar |
| `/iperc` | sí | sí | Por comparar |
| `/iperc/:id` | sí | sí | Por comparar |
| `/legal` | sí | sí | Por comparar |
| `/objetivos-ambientales` | sí | sí | Por comparar |
| `/planificacion` | sí | sí | Por comparar |
| `/ptw` | sí | sí | Por comparar |
| `/ptw/:id` | sí | — | Falta en el nuevo |
| `/registros` | sí | sí | Por comparar |
| `/stop` | sí | sí | Por comparar |
| `/swa` | — | sí | Solo nuevo |
| `/swa/:id` | sí | sí | Por comparar |
| `/terminos` | — | sí | Solo nuevo |

### Usuarios

| Ruta | Demo | Nuevo | Estado visual |
|---|---|---|---|
| `(raíz del módulo)` | sí | sí | Por comparar |

### Raíz

| Ruta | Demo | Nuevo | Estado visual |
|---|---|---|---|
| `(raíz del módulo)` | sí | sí | Por comparar |
| `/auditoria` | — | sí | Solo nuevo |
| `/cambiar-clave` | — | sí | Solo nuevo |
| `/dashboard` | sí | sí | Por comparar |
| `/dashboard/facturacion` | sí | sí | Por comparar |
| `/dashboard/flota` | — | sí | Solo nuevo |
| `/dashboard/inventario` | sí | sí | Por comparar |
| `/dashboard/mantenimiento` | sí | sí | Por comparar |
| `/dashboard/qhse` | sí | sí | Por comparar |
| `/dashboard/usuarios` | sí | sí | Por comparar |
| `/encuesta/:token` | — | sí | Solo nuevo |
| `/encuestas` | — | sí | Solo nuevo |
| `/login` | sí | sí | Por comparar |
| `/modulos/operativo` | sí | sí | Por comparar |
| `/roles-permisos` | — | sí | Solo nuevo |

## Resultado de comparar el código con el de la demo (27/10/2026)

Se comparó cada plantilla (`.html`) y hoja de estilos (`.scss`) de la demo con la del frontend nuevo, **normalizando el formato** (las diferencias de saltos de línea que introduce Prettier no cuentan). De 314 archivos, **solo 47 difieren de verdad**, y la mayoría por poco. Es decir, el frontend nuevo ya comparte con la demo casi todo el diseño; lo que falta no es rehacerlo, sino revisar esas 47 diferencias y las pantallas nuevas.

| Grupo | Archivos | Qué es |
|---|---|---|
| Facturación | `lista-precios-page` (html y scss) | Quita el botón «Nueva lista»: **el backend nuevo todavía no crea listas de precios** (solo las lee). Es un hueco de backend, no de diseño |
| Facturación | `lista-precios-detail`, `catalogos-ventas`, `persona-form-dialog`, `reporteria` | Cambian los enlaces de datos (`clienteNombre`, `items` paginados) y la persona gana la cédula opcional. Se conserva |
| Inventario | `gestionar-despacho-dialog`, `articulo-detail`, `articulo-form-dialog`, `movimiento-dialog` | Despacho con salidas de stock, partes con código opcional y los campos del backend nuevo. Se conserva |
| Mantenimiento | `suborder-execution-dialog`, `return-to-operation-dialog`, `maintenance-list`, `order-classification-dialog`, `order-detail-panel`, `vehicle-inspection-dialog` | Revisado (27/10): solo cambia la lógica de datos (operador por id, inspecciones de flota, reclasificar novedades según permiso). Única pérdida: «Responsable de entrega» en `return-to-operation-dialog`, porque el backend no tiene ese campo |
| QHSE | `aspecto-ambiental-detail-dialog`, `objetivo-ambiental-detail-dialog`, `legal-page`, `aspecto-ambiental-dialog`, `objetivo-ambiental-dialog` y sus listas | En la demo eran cascarones; el nuevo tiene el detalle real (seguimiento, baja, control). Se conserva |
| Usuarios | `user-form-dialog`, `user-list-page` | Revisado (27/10): botones y casilla según permiso (crear, editar, inactivar). Sin cambio visual |
| Pumping y FCR | `ticket-maintenance-card`, `conductor-tareas`, `ticket-detail-page` (35 caracteres), `configuracion-codigos-page` | Diferencias mínimas |
| Layout | `header` | 4 caracteres (los accesos a Flota, Roles y Auditoría) |

Además hay pantallas **sin equivalente en la demo** (páginas nuevas del backend nuevo: lista y detalle de pedidos comerciales, prefactura, orden de trabajo, formulario de pedido, Flota, Auditoría, Encuestas, Roles y permisos). Las del flujo de Facturación (`pedidos-comercial`) se derivaron de las de la demo y comparten sus estilos; los estilos del detalle de pedido y de la prefactura son idénticos a los de la demo.

**Corregido en el detalle del pedido (comparando con la demo, escritorio y móvil):** barra de acciones compacta, línea de estados completa desde «Abierto», zona de carga de archivos con el estilo del sistema de diseño y, en móvil, la barra superior con el menú «⋮». También se renombró el estado «AOT generada» a «OT generada», como en la demo.

**Pendiente de decisión:** en la demo, «Nuevo pedido» abre un diálogo; en el nuevo abre una página (`/pedidos/nuevo`). Si se quiere paridad exacta hay que decidir si se conserva la página (más cómoda para un pedido con muchos ítems) o se vuelve al diálogo.

## Ya hecho

- Facturación · «Nueva lista de precios» restaurada (botón y diálogo sobre el backend nuevo, 27/10).
- Facturación · lista de pedidos (`/facturacion/pedidos`): plantilla de la demo sobre el backend nuevo, escritorio y móvil (commit `e5fa321`).

## Orden propuesto

1. Facturación (detalle de pedido, prefactura, guías, orden de trabajo, formulario de pedido): es lo que más se usa y ya tiene datos de ejemplo del flujo.
2. Operaciones · Pumping y FCR (listas, detalle del ticket, reportes).
3. Inventario y Mantenimiento.
4. QHSE (PTW, IPERC, STOP, SWA, EPI, desechos, inspecciones).
5. Dashboard y Usuarios.

## Bloqueado por backend

Estas pantallas esperan servicios que todavía no existen: reporte de herramientas de Pumping (precarga y evento), rechazo de prefactura con ítems observados y seguimiento, y metas del tablero HSE (API GET/PUT).
