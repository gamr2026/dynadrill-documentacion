# Paridad visual del frontend con la demo

Inventario de páginas para la fase de diseño (27/10/2026). La demo es `origin/main` de `DIGITEC-IT-PROJECTS/dynadrill-frontend` (desplegada en `dynadrill.digitec.com.ec`); el frontend nuevo es `gamr2026/dynadrill-frontend-platform`, rama `diseno/facturacion-demo`.

**Método por página:** abrir la misma pantalla en la demo y en el frontend nuevo, en escritorio (1440 px) y móvil (390 px), capturar las dos y ajustar hasta que coincidan en estructura, jerarquía, espaciado y textos. Los datos son de prueba y se restauran al terminar.

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
| `/pedidos` | sí | sí | Por comparar |
| `/pedidos-demo` | — | sí | Solo nuevo |
| `/pedidos-demo/:id` | — | sí | Solo nuevo |
| `/pedidos/:id` | sí | sí | Por comparar |
| `/pedidos/:id/editar` | — | sí | Solo nuevo |
| `/pedidos/:id/orden-trabajo` | — | sí | Solo nuevo |
| `/pedidos/nuevo` | — | sí | Solo nuevo |
| `/prefacturas` | sí | sí | Por comparar |
| `/prefacturas/:id` | sí | sí | Por comparar |
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

## Ya hecho

- Facturación · lista de pedidos (`/facturacion/pedidos`): plantilla de la demo sobre el backend nuevo, escritorio y móvil (commit `e5fa321`).

## Orden propuesto

1. Facturación (detalle de pedido, prefactura, guías, orden de trabajo, formulario de pedido): es lo que más se usa y ya tiene datos de ejemplo del flujo.
2. Operaciones · Pumping y FCR (listas, detalle del ticket, reportes).
3. Inventario y Mantenimiento.
4. QHSE (PTW, IPERC, STOP, SWA, EPI, desechos, inspecciones).
5. Dashboard y Usuarios.

## Bloqueado por backend

Estas pantallas esperan servicios que todavía no existen: reporte de herramientas de Pumping (precarga y evento), rechazo de prefactura con ítems observados y seguimiento, y metas del tablero HSE (API GET/PUT).
