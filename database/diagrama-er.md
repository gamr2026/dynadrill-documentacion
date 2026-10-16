# Diagrama ER completo — Dynadrill (Mermaid)

> Generado a partir de [`schema-propuesto.prisma`](./schema-propuesto.prisma) (Etapa 2, ya aprobado y revisado — incluye la corrección de RBAC en `auth`, la generalización de `maestros.personas`, los catálogos AS2, el split de `Unidad` y las demás correcciones de la revisión crítica del 2026-09-18). Cada bloque es un diagrama Mermaid independiente. Se dividió **por schema** (en vez de un único diagrama de ~80 tablas) porque un solo diagrama de ese tamaño es ilegible; al final hay un diagrama de alto nivel con las relaciones **entre** schemas/microservicios. Si quieres todo en un solo diagrama, usa [`diagramas-mermaid/todo-en-uno.mmd`](./diagramas-mermaid/todo-en-uno.mmd).
>
> **⚠️ Si tu visor te da `UnknownDiagramError: No diagram type detected`:** es porque copiaste el `.md` completo (con los títulos, el índice y el texto en prosa) dentro de un renderer que solo acepta sintaxis Mermaid pura — no sabe qué hacer con el Markdown alrededor. Dos formas de arreglarlo:
> 1. Copia **solo** el contenido entre las líneas ` ```mermaid ` y ` ``` ` de cada bloque (sin esas líneas de cerca), o
> 2. Usa los archivos ya listos para pegar sin editar nada, en [`diagramas-mermaid/`](./diagramas-mermaid/) — cada uno (`00-alto-nivel.mmd`, `01-auth.mmd`, ... `10-transversales.mmd`, más `todo-en-uno.mmd`) contiene *solo* el diagrama, sin Markdown alrededor.
>
> Convención: `PK` = clave primaria (`UUID`), `FK` = referencia física real (mismo schema), `FKL` = referencia lógica (cruza schema, sin constraint física — ver §3.3/§7 del análisis).

## Índice
1. [Alto nivel — relaciones entre microservicios](#1-alto-nivel--relaciones-entre-microservicios)
2. [`auth`](#2-schema-auth)
3. [`maestros`](#3-schema-maestros)
4. [`integracion_as2`](#4-schema-integracion_as2)
5. [`facturacion`](#5-schema-facturacion)
6. [`operaciones_fcr`](#6-schema-operaciones_fcr)
7. [`operaciones_pumping`](#7-schema-operaciones_pumping)
8. [`mantenimiento`](#8-schema-mantenimiento)
9. [`inventario`](#9-schema-inventario)
10. [`qhse`](#10-schema-qhse)
11. [`documentos` / `notificaciones` / `workflow`](#11-servicios-transversales)

---

## 1. Alto nivel — relaciones entre microservicios

```mermaid
erDiagram
    AUTH_USUARIOS ||--o{ FACTURACION_PEDIDOS : "created_by (FKL)"
    MAESTROS_CLIENTES ||--o{ FACTURACION_PEDIDOS : "cliente_id (FKL + snapshot)"
    MAESTROS_POZOS ||--o{ FACTURACION_PEDIDOS : "pozo_id (FKL)"
    FACTURACION_PEDIDOS ||--o| OPERACIONES_FCR_FCR_TICKETS : "pedido_id (FKL, unique)"
    FACTURACION_PEDIDOS ||--o| OPERACIONES_PUMPING_PUMPING_TICKETS : "pedido_id (FKL, unique)"
    OPERACIONES_FCR_FCR_TICKETS ||--o{ FACTURACION_DOCUMENTOS_OPERATIVOS : "push al firmar"
    OPERACIONES_PUMPING_PUMPING_TICKETS ||--o{ FACTURACION_DOCUMENTOS_OPERATIVOS : "push al firmar"
    INVENTARIO_ARTICULOS ||--o{ OPERACIONES_FCR_FCR_TOOLS : "articulo_id (FKL)"
    INVENTARIO_ARTICULOS ||--o{ OPERACIONES_PUMPING_PUMPING_CHEMICALS : "articulo_id (FKL)"
    OPERACIONES_PUMPING_PUMPING_UNIT_REPORTS ||--o{ MANTENIMIENTO_UNIT_REPORTS : "genera (evento)"
    QHSE_INSPECCIONES_EQUIPO ||--o{ MANTENIMIENTO_UNIT_REPORTS : "genera si rechazado (evento)"
    OPERACIONES_FCR_FCR_TICKETS ||--o| QHSE_IPERC_MATRICES : "cobertura (validacion API)"
    OPERACIONES_PUMPING_PUMPING_TICKETS ||--o| QHSE_IPERC_MATRICES : "cobertura (validacion API)"
    INTEGRACION_AS2_AS2_SYNC_LOG ||--o{ FACTURACION_PEDIDOS : "sync (clave natural = code)"
    INTEGRACION_AS2_AS2_SYNC_LOG ||--o{ MAESTROS_CLIENTES : "sync catalogo"
    FACTURACION_PEDIDOS ||--o{ DOCUMENTOS_DOCUMENTOS : "adjuntos (API compartida)"
    QHSE_INVESTIGACIONES ||--o{ DOCUMENTOS_DOCUMENTOS : "adjuntos (API compartida)"
    MANTENIMIENTO_SUB_ORDERS ||--o{ DOCUMENTOS_DOCUMENTOS : "adjuntos (API compartida)"
    QHSE_SWA_EVENTOS ||--o{ NOTIFICACIONES_NOTIFICACIONES : "cadena de notificacion"
    QHSE_EMERGENCIA_EVENTOS ||--o{ NOTIFICACIONES_NOTIFICACIONES : "cadena de notificacion"
    MANTENIMIENTO_SUB_ORDERS ||--o{ WORKFLOW_ESTADO_EVENTOS : "espejo de cambio de estado"
    FACTURACION_PEDIDOS ||--o{ WORKFLOW_ESTADO_EVENTOS : "espejo de cambio de estado"
```

---

## 2. Schema `auth`

> ✅ RBAC revisado: `usuarios` ya no tiene `rol_id` propio — el/los rol(es) se resuelven vía `usuario_roles`, y qué puede hacer cada rol vía `permisos`/`rol_permisos`.

```mermaid
erDiagram
    roles {
        uuid id PK
        string code UK
        string nombre UK
        boolean activo
    }
    permisos {
        uuid id PK
        string code UK
        string modulo
        string recurso
        string accion
    }
    rol_permisos {
        uuid rol_id PK
        uuid permiso_id PK
    }
    usuario_roles {
        uuid usuario_id PK
        uuid rol_id PK
        timestamp asignado_at
        uuid asignado_por FK
    }
    usuarios {
        uuid id PK
        string email UK
        string username UK
        string nombre
        boolean estado_acceso
        string especialidad
    }
    usuarios_datos_rrhh {
        uuid usuario_id PK
        string cedula
        string cargo
        string departamento
        date fecha_ingreso
        boolean empleado_activo
    }
    workflow_rol_responsable {
        uuid id PK
        string dominio
        string paso_o_fase
        uuid rol_id FK
    }

    roles ||--o{ rol_permisos : rol_id
    permisos ||--o{ rol_permisos : permiso_id
    usuarios ||--o{ usuario_roles : usuario_id
    roles ||--o{ usuario_roles : rol_id
    usuarios ||--|| usuarios_datos_rrhh : "1 a 1"
    roles ||--o{ workflow_rol_responsable : rol_id
```

---

## 3. Schema `maestros`

> ✅ `personas_contacto` se dividió: `contactos_cliente` (solo representantes del cliente) + `personas` (nuevo, catálogo compartido interno/externo reusado por Mantenimiento y QHSE).

```mermaid
erDiagram
    bloques {
        uuid id PK
        string nombre UK
    }
    campos {
        uuid id PK
        string nombre UK
        string codigo_pec
        string zona
    }
    taladros {
        uuid id PK
        string nombre UK
        boolean habilitado
    }
    pozos {
        uuid id PK
        string codigo UK
        string nombre_completo
        uuid campo_id FK
        uuid bloque_id FK
        boolean habilitado
    }
    clientes {
        uuid id PK
        string identificacion UK
        string nombre_comercial
        boolean activo
    }
    clientes_contratos {
        uuid id PK
        uuid cliente_id FK
        string numero_contrato
        boolean activo
    }
    contactos_cliente {
        uuid id PK
        uuid cliente_id FK
        string tipo
        string nombre
        string cedula
        boolean activo
    }
    personas {
        uuid id PK
        string tipo
        uuid usuario_id FK
        string nombre
        string cedula UK
        string empresa_externa
        boolean activo
    }

    campos ||--o{ pozos : campo_id
    bloques ||--o{ pozos : bloque_id
    clientes ||--o{ clientes_contratos : cliente_id
    clientes ||--o{ contactos_cliente : cliente_id
```

---

## 4. Schema `integracion_as2`

> ✅ Se agregaron los catálogos que AS2 realmente posee (condición de pago, forma de pago, canal, zona, bodega) — antes texto libre en `Pedido`.

```mermaid
erDiagram
    as2_pedidos_pendientes {
        uuid id PK
        string payload
        timestamp created_at
    }
    as2_sync_log {
        uuid id PK
        string entidad
        string entidad_code
        string direccion
        boolean exitoso
    }
    as2_secuencias {
        string nombre PK
        string ultimo_valor
    }
    as2_condiciones_pago {
        uuid id PK
        string codigo UK
        string nombre
        boolean activo
    }
    as2_formas_pago {
        uuid id PK
        string codigo UK
        string nombre
        boolean activo
    }
    as2_canales {
        uuid id PK
        string codigo UK
        string nombre
        boolean activo
    }
    as2_zonas {
        uuid id PK
        string codigo UK
        string nombre
        boolean activo
    }
    as2_bodegas {
        uuid id PK
        string codigo UK
        string nombre
        boolean activo
    }
```

---

## 5. Schema `facturacion`

```mermaid
erDiagram
    pedidos {
        uuid id PK
        string code UK
        string origen
        uuid cliente_id FK
        string cliente_nombre_snapshot
        uuid pozo_id FK
        uuid agente_comercial_id FK
        uuid representante_campo_id FK
        uuid condicion_pago_id FK
        uuid zona_id FK
        uuid bodega_id FK
        uuid tecnico_hse_responsable_id FK
        string linea_servicio
        string estado
    }
    pedido_items_estimado {
        uuid id PK
        uuid pedido_id FK
        string codigo
        decimal cantidad
        decimal valor_unitario
    }
    pedido_historial_estado {
        uuid id PK
        uuid pedido_id FK
        string estado
        timestamp fecha
        uuid usuario_id FK
    }
    listas_precios {
        uuid id PK
        uuid cliente_id FK
        date vigente_desde
        boolean activa
    }
    lista_precios_items {
        uuid id PK
        uuid lista_precios_id FK
        string codigo
        decimal precio
        string tipo
    }
    documentos_operativos {
        uuid id PK
        uuid pedido_id FK
        string origen
        uuid ticket_operativo_id FK
        string tipo
        string estado
    }
    documento_operativo_actividades {
        uuid id PK
        uuid documento_id FK
        date fecha
        string detalle
    }
    documento_operativo_uso_herramientas {
        uuid id PK
        uuid documento_id FK
        string herramienta_ref
        date fecha
        string status
    }
    prefacturas {
        uuid id PK
        string code UK
        uuid pedido_id FK
        decimal neto_cobrar
        string estado
    }
    prefactura_items {
        uuid id PK
        uuid prefactura_id FK
        string codigo
        decimal precio_total
        string tipo
    }
    guias_remision {
        uuid id PK
        uuid pedido_id FK
        uuid prefactura_id FK
        date fecha
    }
    guia_remision_items {
        uuid id PK
        uuid guia_id FK
        string codigo
        decimal cantidad
    }
    aots {
        uuid id PK
        uuid pedido_id FK
        uuid prefactura_id FK
        string numero_ot UK
        string estado
    }
    aot_items {
        uuid id PK
        uuid aot_id FK
        string descripcion
        decimal valor
    }

    pedidos ||--o{ pedido_items_estimado : pedido_id
    pedidos ||--o{ pedido_historial_estado : pedido_id
    pedidos ||--o{ documentos_operativos : pedido_id
    documentos_operativos ||--o{ documento_operativo_actividades : documento_id
    documentos_operativos ||--o{ documento_operativo_uso_herramientas : documento_id
    pedidos ||--o{ prefacturas : pedido_id
    prefacturas ||--o{ prefactura_items : prefactura_id
    pedidos ||--o{ guias_remision : pedido_id
    prefacturas ||--o| guias_remision : prefactura_id
    guias_remision ||--o{ guia_remision_items : guia_id
    pedidos ||--o{ aots : pedido_id
    prefacturas ||--o{ aots : prefactura_id
    aots ||--o{ aot_items : aot_id
    listas_precios ||--o{ lista_precios_items : lista_precios_id
```

---

## 6. Schema `operaciones_fcr`

```mermaid
erDiagram
    fcr_tickets {
        uuid id PK
        string code UK
        string status
        string current_phase
        uuid pedido_id FK
    }
    fcr_tools {
        uuid id PK
        uuid ticket_id FK
        uuid articulo_id FK
        string status
        string missing_reason
    }
    fcr_tool_usage_log {
        uuid id PK
        uuid tool_id FK
        date fecha
        string status
    }
    fcr_activity_log {
        uuid id PK
        uuid ticket_id FK
        date fecha
        string mensaje
    }
    fcr_observations {
        uuid id PK
        uuid ticket_id FK
        string autor
        string mensaje
    }
    fcr_phase_history {
        uuid id PK
        uuid ticket_id FK
        string fase
        uuid aprobado_por
    }
    fcr_tool_inspections {
        uuid id PK
        uuid ticket_id FK
        uuid tool_id FK
        uuid articulo_id FK
        string estado
    }
    fcr_tool_inspection_partes {
        uuid id PK
        uuid inspection_id FK
        uuid articulo_parte_id FK
        string visual_resultado
        string end_resultado
    }
    fcr_tool_inspection_firmas {
        uuid id PK
        uuid inspection_id FK
        string rol
        uuid usuario_id FK
    }

    fcr_tickets ||--o{ fcr_tools : ticket_id
    fcr_tools ||--o{ fcr_tool_usage_log : tool_id
    fcr_tickets ||--o{ fcr_activity_log : ticket_id
    fcr_tickets ||--o{ fcr_observations : ticket_id
    fcr_tickets ||--o{ fcr_phase_history : ticket_id
    fcr_tickets ||--o{ fcr_tool_inspections : ticket_id
    fcr_tools ||--|| fcr_tool_inspections : "1 por herramienta"
    fcr_tool_inspections ||--o{ fcr_tool_inspection_partes : inspection_id
    fcr_tool_inspections ||--o{ fcr_tool_inspection_firmas : inspection_id
```

---

## 7. Schema `operaciones_pumping`

```mermaid
erDiagram
    pumping_tickets {
        uuid id PK
        string code UK
        string status
        string current_step
        uuid pedido_id FK
        uuid taladro_id FK
    }
    pumping_chemicals {
        uuid id PK
        uuid ticket_id FK
        uuid articulo_id FK
        decimal cantidad_asignada
    }
    pumping_tools {
        uuid id PK
        uuid ticket_id FK
        string status
    }
    pumping_operators {
        uuid id PK
        uuid ticket_id FK
        uuid usuario_id FK
    }
    pumping_unit_reports {
        uuid id PK
        uuid ticket_id FK
        uuid unidad_id FK
        uuid pozo_id FK
        date departure_date
    }
    pumping_unit_report_checklist {
        uuid id PK
        uuid report_id FK
        string categoria
        string label
    }
    travel_managements {
        uuid id PK
        uuid ticket_id FK
        string tipo
        string risk_level
    }
    travel_risk_answers {
        uuid id PK
        uuid travel_id FK
        int pregunta_codigo
        int puntaje
    }
    daily_activity_reports {
        uuid id PK
        uuid ticket_id FK
        uuid pozo_id FK
        date fecha
    }
    daily_activity_entries {
        uuid id PK
        uuid report_id FK
        string detalle
    }
    solicitudes_cambio_items {
        uuid id PK
        uuid pumping_ticket_id FK
        uuid pedido_id FK
        string estado
    }
    solicitud_cambio_item_original {
        uuid id PK
        uuid solicitud_id FK
        string codigo
        decimal cantidad
    }
    solicitud_cambio_item_propuesto {
        uuid id PK
        uuid solicitud_id FK
        string codigo
        decimal cantidad
    }

    pumping_tickets ||--o{ pumping_chemicals : ticket_id
    pumping_tickets ||--o{ pumping_tools : ticket_id
    pumping_tickets ||--o{ pumping_operators : ticket_id
    pumping_tickets ||--o{ pumping_unit_reports : ticket_id
    pumping_unit_reports ||--o{ pumping_unit_report_checklist : report_id
    pumping_tickets ||--o{ travel_managements : ticket_id
    travel_managements ||--o{ travel_risk_answers : travel_id
    pumping_tickets ||--o{ daily_activity_reports : ticket_id
    daily_activity_reports ||--o{ daily_activity_entries : report_id
    pumping_tickets ||--o{ solicitudes_cambio_items : pumping_ticket_id
    solicitudes_cambio_items ||--o{ solicitud_cambio_item_original : solicitud_id
    solicitudes_cambio_items ||--o{ solicitud_cambio_item_propuesto : solicitud_id
```

---

## 8. Schema `mantenimiento`

> ✅ `unidades` se dividió en identidad + `unidad_patrimonio` (Administración) + `unidad_control_operativo` (Mantenimiento). `conductor_permisos` ya no depende de una tabla `conductores` propia — referencia `maestros.personas`.

```mermaid
erDiagram
    unidades {
        uuid id PK
        string code UK
        string tipo
        boolean activo
    }
    unidad_patrimonio {
        uuid unidad_id PK
        string placa
        string marca
        uuid responsable_patrimonial_id FK
    }
    unidad_control_operativo {
        uuid unidad_id PK
        decimal horometro_actual
        decimal km_actual
        string categoria_peso
    }
    unidad_registros_preventivos {
        uuid id PK
        uuid unidad_id FK
        string tipo_servicio
    }
    maintenance_orders {
        uuid id PK
        string code UK
        uuid unidad_id FK
        uuid unit_report_id FK
        boolean returned_to_operation
    }
    sub_orders {
        uuid id PK
        uuid order_id FK
        string code UK
        string type
        uuid assigned_user_id FK
        string status
    }
    sub_order_repuestos {
        uuid id PK
        uuid sub_order_id FK
        string numero_parte
        int cantidad
    }
    unit_reports {
        uuid id PK
        string report_no UK
        uuid unidad_id FK
        uuid pozo_id FK
        date fecha_salida
    }
    unit_report_checklist {
        uuid id PK
        uuid report_id FK
        string categoria
    }
    vehicle_inspections {
        uuid id PK
        uuid unidad_id FK
        uuid ticket_id FK
        uuid unit_report_id FK
    }
    vehicle_inspection_checklist {
        uuid id PK
        uuid inspection_id FK
        string categoria
        string estado
    }
    conductor_permisos {
        uuid id PK
        uuid persona_id FK
        date licencia_vencimiento
    }
    registros_mantenimiento {
        uuid id PK
        uuid unidad_id FK
        string clase
        date fecha
    }

    unidades ||--|| unidad_patrimonio : "1 a 1"
    unidades ||--|| unidad_control_operativo : "1 a 1"
    unidades ||--o{ unidad_registros_preventivos : unidad_id
    unidades ||--o{ maintenance_orders : unidad_id
    unidades ||--o{ unit_reports : unidad_id
    unidades ||--o{ vehicle_inspections : unidad_id
    unidades ||--o{ registros_mantenimiento : unidad_id
    unit_reports ||--o| maintenance_orders : unit_report_id
    maintenance_orders ||--o{ sub_orders : order_id
    sub_orders ||--o{ sub_order_repuestos : sub_order_id
    unit_reports ||--o{ unit_report_checklist : report_id
    vehicle_inspections ||--o{ vehicle_inspection_checklist : inspection_id
    vehicle_inspections |o--o| unit_reports : "si No Cumple"
```

---

## 9. Schema `inventario`

> ✅ `categorias_articulo` (nuevo): `Articulo.categoria` deja de ser texto libre.

```mermaid
erDiagram
    categorias_articulo {
        uuid id PK
        string code UK
        string nombre
        boolean activo
    }
    articulos {
        uuid id PK
        string codigo UK
        uuid categoria_id FK
        boolean activo
    }
    articulo_partes {
        uuid id PK
        uuid articulo_id FK
        int orden
        string codigo
    }
    movimientos_inventario {
        uuid id PK
        uuid articulo_id FK
        string tipo
        decimal cantidad
        decimal saldo_resultante
        string origen_modulo
        uuid origen_referencia_id FK
    }

    categorias_articulo ||--o{ articulos : categoria_id
    articulos ||--o{ articulo_partes : articulo_id
    articulos ||--o{ movimientos_inventario : articulo_id
```

---

## 10. Schema `qhse`

> ✅ `rol_notificado` (texto libre) → `rol_notificado_id` (ref. a `auth.roles`) en `swa_notificaciones`/`emergencia_notificaciones`. Nueva tabla `investigacion_trabajador_involucrado`. `emergencia_heridos`/`entregas_epi` referencian `maestros.personas`.

```mermaid
erDiagram
    iperc_matrices {
        uuid id PK
        string code UK
        string estado
        uuid origen_ticket_id FK
    }
    iperc_tasks {
        uuid id PK
        uuid matrix_id FK
        int orden
    }
    iperc_hazards {
        uuid id PK
        uuid task_id FK
        int riesgo_inicial_nd
        int riesgo_inicial_ne
        int riesgo_inicial_nc
    }
    iperc_controles {
        uuid id PK
        uuid hazard_id FK
        string tipo
    }
    ptw_matrices {
        uuid id PK
        string code UK
        uuid iperc_matrix_id FK
        string fase
        boolean ptw_cerrado
    }
    ptw_gas_readings {
        uuid id PK
        uuid ptw_id FK
        decimal h2s
        decimal lel
    }
    ptw_daily_logs {
        uuid id PK
        uuid ptw_id FK
        date fecha
    }
    stop_cards {
        uuid id PK
        string code UK
        uuid observador_id FK
    }
    stop_card_items {
        uuid id PK
        uuid card_id FK
        string bloque
        string estado
    }
    swa_eventos {
        uuid id PK
        string estado
        uuid ticket_id FK
        uuid emergencia_id FK
    }
    swa_notificaciones {
        uuid id PK
        uuid swa_id FK
        uuid rol_notificado_id FK
    }
    derrame_eventos {
        uuid id PK
        string estado
        string volumen
        uuid desecho_generado_id FK
    }
    desechos {
        uuid id PK
        boolean peligroso
        string estado
    }
    desecho_manifiestos {
        uuid id PK
        uuid desecho_id FK
        string gestor_licencia_suia
    }
    desecho_certificados {
        uuid id PK
        uuid manifiesto_id FK
        timestamp recibido_at
    }
    emergencia_eventos {
        uuid id PK
        int nivel
        string estado
        uuid origen_derrame_id FK
    }
    emergencia_timeline {
        uuid id PK
        uuid emergencia_id FK
        timestamp hora
    }
    emergencia_heridos {
        uuid id PK
        uuid emergencia_id FK
        uuid persona_id FK
        string triage_color
        int dias_perdidos
    }
    emergencia_signos_vitales {
        uuid id PK
        uuid herido_id FK
        timestamp hora
    }
    emergencia_notificaciones {
        uuid id PK
        uuid emergencia_id FK
        uuid rol_notificado_id FK
    }
    entregas_epi {
        uuid id PK
        string code UK
        uuid trabajador_id FK
    }
    epi_items {
        uuid id PK
        uuid entrega_id FK
        string elemento
    }
    inspecciones_equipo {
        uuid id PK
        string code UK
        string tipo
        string resultado
    }
    investigaciones {
        uuid id PK
        string resultado
        string estado
        uuid origen_emergencia_id FK
    }
    investigacion_trabajador_involucrado {
        uuid investigacion_id PK
        uuid persona_id FK
        int dias_perdidos
    }
    investigacion_testigos {
        uuid id PK
        uuid investigacion_id FK
    }
    investigacion_cinco_porques {
        uuid id PK
        uuid investigacion_id FK
        int orden
    }
    investigacion_acciones_correctivas {
        uuid id PK
        uuid investigacion_id FK
        string tipo
        string estado
    }
    investigacion_notificacion_legal {
        uuid id PK
        uuid investigacion_id FK
    }
    dashboard_metas {
        int id PK
        json payload_metas
    }
    horas_hombre_periodo {
        uuid id PK
        date fecha
        uuid pozo_id FK
        string contratista
    }
    capacitaciones {
        uuid id PK
        string tema
        date fecha
    }
    capacitacion_asistentes {
        uuid id PK
        uuid capacitacion_id FK
        uuid usuario_id FK
        boolean aprobado
    }

    iperc_matrices ||--o{ iperc_tasks : matrix_id
    iperc_tasks ||--o{ iperc_hazards : task_id
    iperc_hazards ||--o{ iperc_controles : hazard_id
    iperc_matrices ||--o{ ptw_matrices : habilita
    ptw_matrices ||--o{ ptw_gas_readings : ptw_id
    ptw_matrices ||--o{ ptw_daily_logs : ptw_id
    stop_cards ||--o{ stop_card_items : card_id
    swa_eventos ||--o{ swa_notificaciones : swa_id
    swa_eventos ||--o| emergencia_eventos : escala
    derrame_eventos ||--o| desechos : genera
    derrame_eventos ||--o| emergencia_eventos : escala
    emergencia_eventos ||--o{ emergencia_timeline : emergencia_id
    emergencia_eventos ||--o{ emergencia_heridos : emergencia_id
    emergencia_heridos ||--o{ emergencia_signos_vitales : herido_id
    emergencia_eventos ||--o{ emergencia_notificaciones : emergencia_id
    emergencia_eventos ||--o| investigaciones : obliga
    investigaciones ||--o| investigacion_trabajador_involucrado : investigacion_id
    entregas_epi ||--o{ epi_items : entrega_id
    desecho_manifiestos ||--o| desecho_certificados : manifiesto_id
    investigaciones ||--o{ investigacion_testigos : investigacion_id
    investigaciones ||--o{ investigacion_cinco_porques : investigacion_id
    investigaciones ||--o{ investigacion_acciones_correctivas : investigacion_id
    investigaciones ||--o| investigacion_notificacion_legal : investigacion_id
    capacitaciones ||--o{ capacitacion_asistentes : capacitacion_id
```

---

## 11. Servicios transversales

```mermaid
erDiagram
    documentos {
        uuid id PK
        string entidad_tipo "ref. lógica a cualquier schema"
        uuid entidad_id FKL
        string categoria
        string ruta_relativa "directorio dedicado del servidor, §17.15"
        int version
        uuid documento_anterior_id FK
    }
    notificaciones {
        uuid id PK
        string entidad_tipo
        uuid entidad_id FKL
        string tipo
        string canal
        uuid destinatario_id FKL
        uuid destinatario_rol_id FKL
        string estado
    }
    estado_eventos {
        uuid id PK
        string entidad_tipo
        uuid entidad_id FKL
        string dominio
        string estado_anterior
        string estado_nuevo
        uuid usuario_id FKL
    }

    documentos ||--o{ documentos : "version_anterior (self)"
```
