# Avance de implementación — Módulo de Facturación (reescritura)

> Rama: `feature/facturacion-proceso-completo` · Fases 0–8 completas · build + typecheck en verde · sin commits.

## Flujo end-to-end disponible (todo mock)

1. **Pedido** (FACT-001): alta desde el Portal (rol Ventas / Facturación) con cabecera completa
   + 1 línea estimada desde la lista de precios. Gateway AS2 bidireccional: "Sincronizar con AS2"
   baja pedidos creados del otro lado. Lista con filtros (línea/estado/origen) + semáforo de días.
2. **Documentos operativos** (FACT-002): FCR empuja Reporte Job + Reporte de Herramientas al
   aprobar reportes; Pumping empuja Reporte Job al guardar el reporte diario. Panel de avance en
   el detalle del Pedido + campana del facturador. "Simular carga de operador" para demo.
3. **Prefactura** (FACT-003): se **arma** cruzando el Reporte de Herramientas (días O/S/D + series)
   × Lista de Precios (tarifa + tipo) + cargo de personal por días de Reporte Job. Checklist de
   revisión. PDF `DYN-AFN-RE-11B`.
4. **Envío al cliente** (FACT-004): paquete de PDFs + adjuntos → firma **o rechazo** (motivo +
   razón del retraso + devuelto a persona). Guía de Remisión solo si hay ítems Material y después
   del envío.
5. **AOT** (FACT-004): se genera de la prefactura firmada. Nº `[OT]-OPR-[POZO]-[CIUDAD]-[AÑO]`,
   fecha = inicio − 1 día, encabezado fijo, detalle = prefactura. PDF formato "ORDEN DE TRABAJO /
   RESUMEN DE COSTOS". Marcar como firmada (física).
6. **Reportería** (FACT-005): 5 reportes (por mes · por pozo y línea · estado por cliente ·
   cotizado vs. real · control de tickets con semáforo) + export CSV.
7. **Cierre**: export de la plantilla de carga a AS2 (`Codigo Producto AS2 / Codigo Unidad AS2 /
   Cantidad / Descripción / Precio / Porcentaje Descuento`). Placeholder de registro AS2 / SRI.

## Rutas del módulo

`/dashboard/facturacion/` → `pedidos` · `pedidos/:id` · `prefacturas` · `prefacturas/:id` ·
`aots/:id` · `lista-precios` · `lista-precios/:id` · `reporteria`

Sidebar: **Pedidos · Prefacturas · Lista de precios · Reportería**.
Rol *Ingeniería de Ventas*: ve solo **Pedidos** (alta y consulta).

## Compartido (FCR ↔ Pumping ↔ Facturación)

`src/app/shared/models/operativo-docs.model.ts` (tipos O/S/D/V, bitácora),
`src/app/shared/components/reporte-job-pdf-dialog` + `reporte-herramientas-pdf-dialog`,
`src/app/shared/services/operativo-docs-bridge.service.ts` (puente operativo → Facturación).
FCR mantiene alias `Fcr*` sobre los tipos compartidos.

## Pendiente / notas de fase de pruebas

- La integración real con la API de AS2 (hoy gateway simulado en `facturacion-pedidos-mock.interceptor.ts`).
- Emisión SRI-Core, Control de Costos y seguimiento de cobro (fuera de alcance por diseño).
- Separación fina de roles: hoy el rol *Ingeniería de Ventas* llega a Pedidos; el resto del
  módulo es de *Facturación*. Operadores usan FCR/Pumping.
- Los seeds del mock alinean 2 tickets FCR (`FCR-116` → Pedido 4313) y 1 Pumping
  (`PUMP-2026-00458` → Pedido 4304) para demostrar el puente; el resto de datos son de demostración.
- La lista de precios trae un solo cliente (EP Petroecuador 2025201); el CRUD ya es multicliente.
