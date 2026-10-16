# Plan: Notificaciones y flujo documental QHSE ↔ Ventas ↔ Pumping (v2)

Plan de trabajo para ejecutar en **Claude Code** sobre `dynadrill-backend`
(NestJS + Prisma/SQLite) y `dynadrill-frontend` (Angular). Esta v2 reemplaza
la v1: se revisó contra el código real y se incorporan las decisiones que
cerró el negocio (sección "Decisiones cerradas").

Quien lo retome **no tiene el contexto de la conversación original**. Cada
fase trae su estado actual con archivo:línea y lo que hay que cambiar.

> **Importante: sobre qué versión del código se escribió.** La revisión de la
> v2 se hizo sobre una copia de `main` sincronizada con origin el
> **2026-09-21**. La v1 mencionaba piezas que **no existían en esa copia**
> (`DocumentoFirmado`, `DocumentosFirmadosService`, "Solicitud de Despacho a
> Bodega"). Probablemente estaban en otra máquina, todavía sin subir. La
> **Fase 0** verifica esto, y el plan trae un camino para cada caso. Los
> números de línea son aproximados (de esa copia): siempre ubicar por
> símbolo con grep, no por número de línea.

---

## Origen (pedido del negocio, resumido)

1. Al crear un Pedido, notificar a **Técnico HSE + Gerente HSE** (además del
   Jefe de Base, a quien hoy se le avisa de manera informal). Así QHSE le
   pide al cliente el **documento de locación** (Formato de Recepción) y va
   preparando el PTW.
2. El **Jefe de Base** hace la asignación completa del Pedido de **Pumping**:
   Supervisor, Operadores, Unidades **y químicos**.
3. Al asignar personal, notificar a QHSE con el detalle. QHSE abre un **caso
   de inspección por equipo**; el Operador o el Supervisor sube un documento
   con el checklist cubierto (sin formato fijo por ahora); QHSE aprueba o
   rechaza.
4. El **ART** lo carga el Supervisor y aparece precargado en el PTW.
5. El **PT** (Permiso de Trabajo) lo carga el Supervisor **a diario**, antes
   de operar en campo; QHSE valida que esté cargado.
6. Documento nuevo **SFI** (Formato de Seguridad de Ingreso): lo elabora
   QHSE a partir de la notificación del punto 3, y el Supervisor se lo
   entrega a PE para que el personal pueda ingresar.
7. *(Fuera de alcance, ver al final.)* Gerenciamiento de viaje por Conductor.

## Decisiones cerradas con el negocio

| # | Decisión |
|---|----------|
| D1 | La asignación del punto 2 incluye **químicos** (con su salida de bodega y el documento de mezcla): todo el paso `asignacion` pasa al Jefe de Base. |
| D2 | **Solo Pumping.** FCR no cambia: su `asignacion` sigue con `SUPERVISOR`. |
| D3 | El "PT diario" **no es un documento nuevo**: es el documento `ptw_prellenado` que ya tiene cada PTW. Hay un PTW por día de operación. El label pasa a ser **"Permiso de Trabajo (PT)"**. |
| D4 | El **ART es uno por trabajo**, con **vigencia legal de 15 días**. Si el trabajo dura más de 15 días, hay que generar otro ART antes de operar en campo después del día 15. Un pedido puede tener **varios ART en el tiempo**. |
| D5 | Mientras QHSE no apruebe el checklist de **todos** los equipos asignados, **no se puede realizar el paso `traslado_salida` de Pumping**. Lo valida el backend, no solo la pantalla. |
| D6 | El notificador de QHSE no crea una tabla `Notification`. Usa avisos **calculados por consulta**, pero se muestran en **toda la app**, no solo en una página (ver Fase 3). |

## Preguntas abiertas (no bloquean empezar)

- **P1. ART vencido:** ¿bloquea operar (p. ej. abrir el PTW del día o
  `ejecucion_operativa`) o solo avisa? **Por defecto, mientras no haya
  respuesta:** solo se avisa (a QHSE y al Supervisor). El bloqueo queda
  detrás de una constante `ART_VENCIDO_BLOQUEA = false` para activarlo sin
  refactor.
- **P2.** ¿ART, PT y SFI aplican también a tickets FCR? **Por defecto:**
  solo Pumping. El almacenamiento se diseña por `pedidoId`, así que sumar
  FCR después solo requiere los endpoints del lado FCR y la UI.
- **P3.** ¿El SFI también bloquea `traslado_salida`? **Por defecto:** no,
  solo aviso.
- **P4.** "Equipos" del checklist = **unidades asignadas** (`Unidad`). Si el
  negocio quiere incluir otros equipos (herramientas, bombas sueltas), se
  agregan como otro `equipoTipo` sin cambiar el modelo.

## Roles (`libs/common/src/auth/role-code.ts`)

`JEFE_BASE`, `TECNICO_HSE`, `COORDINADOR_HSE`, `GERENTE_HSE`, `SUPERVISOR`,
`SUPERVISOR_PUMPING`, `OPERADOR`, `SUPERADMIN`. `withAdmins(...)` agrega
`SUPERADMIN` y `JEFE_BASE`.

Nota: `ModuleRoles.qhse` **excluye al Supervisor a propósito**, a pedido del
cliente (`module-roles.ts`, comentario sobre `qhse`). **No abrir los
controllers de QHSE al Supervisor.** Lo que sube o descarga el Supervisor
cuelga de los endpoints del ticket de Pumping, donde él ya tiene acceso.

---

## Fase 0 — Sincronizar y verificar (obligatoria, antes de tocar código)

1. En ambos repos: `git status` (si hay cambios, `git stash -u`),
   `git checkout main`, `git pull origin main`, `npm install`. En el
   backend, además: `npx prisma generate` y `npx prisma migrate dev`.
2. Crear una rama de trabajo por repo, por ejemplo
   `feat/qhse-pumping-notificaciones`.
3. Correr la línea base y anotar los conteos: `npx tsc --noEmit` (en los
   dos repos), `npx jest` (backend), `npx ng build --configuration production`
   (frontend).
4. **Verificar qué hay en `main`** (grep) y elegir el camino de la Fase 2:
   - `model DocumentoFirmado` en `prisma/schema.prisma` y
     `DocumentosFirmadosService` en `libs/domains/facturacion/src/pedidos/`.
     - **Si existe**, con campos `(pedidoId, tipo, referencia)` y upsert:
       **Camino A** (reusarlo).
     - **Si no existe**: **Camino B** (extender `PedidoDocumento`).
   - La "Solicitud de Despacho a Bodega" en `facturacion-domain.service.ts`.
     Si existe, es el precedente de UI y flujo para abrir, cargar y
     aprobar/rechazar con motivo (Fase 4). Si no existe, el precedente es
     `FcrToolInspection` (ver Fase 4).
5. Confirmar el orden de pasos de Pumping en el frontend (`PumpingStep` en
   `pumping.model.ts`). Se espera
   `… asignacion → traslado_salida → revision_reportes_salida …`.

---

## Fase 1 — El Jefe de Base hace toda la asignación (solo Pumping)

### Estado actual (verificado)

- **El Jefe de Base ya elige al Supervisor.** El select "Supervisor
  responsable" está en el paso `revision_inicial`
  (`ticket-detail-page.html` ~L159 → `saveSupervisor()` en
  `ticket-detail-page.ts` ~L2073 → `PATCH operations/pumping/tickets/:id/assign-supervisor`).
  `revision_inicial` ya pertenece a `RoleCode.JEFE_BASE`.
- El paso `asignacion` (`ticket-detail-page.html` ~L177–303 →
  `saveAssignments()` ~L2103) hoy lo hace el **Supervisor**. Incluye:
  - operadores y unidades con emparejamiento (`operatorAssignments`,
    `allOperatorsHaveUnits`),
  - químicos: salida de bodega real vía `movimientosInventarioService.registrar`,
    y documento de mezcla obligatorio si hay químicos,
  - validación de unidades de Transporte con inspección vehicular aprobada
    (`validateTransporteUnits`),
  - `PATCH …/assign-resources` y luego `advanceToNextStep`.
- Hay **dos copias** del mapa rol↔paso, que deben quedar en sync:
  - backend: `libs/domains/operaciones/src/workflow/workflow-role.maps.ts`,
    `PUMPING_STEP_ROLE.asignacion = PUMPING_SUPERVISORES`;
  - frontend: `features/operations/pumping/models/pumping.model.ts` ~L64,
    `PUMPING_STEP_ROLE.asignacion = { roleName: 'Supervisor', roleId: 1 }`.
- El frontend **cambia de rol automáticamente** al avanzar
  (`this.auth.switchRole(nextRole.roleName, nextRole.roleId)` en varias
  partes de `ticket-detail-page.ts`, ~L1256, 1278, 1491, 1520, 1810, 2057,
  2333). Si solo se cambia el backend, el front pasa a "Supervisor" y el
  guard responde 403.
- `assign-supervisor` y `assign-resources`
  (`pumping-actions.controller.ts`) **no tienen `@WorkflowGate('pumping')`**:
  hoy cualquier rol de `ModuleRoles.pumping` puede llamarlos.
- Las listas de supervisores, operadores y unidades están **escritas a mano
  en el código** (`supervisorOptions`/`operatorOptions`/`unitOptions` en el
  front; `SUPERVISOR_NAMES`/`OPERATOR_DATA` en `pumping-domain.service.ts`).
  **Fuera de alcance** reemplazarlas por usuarios reales. Solo dejar una
  nota en el código.

### Cambios

**Backend**
- `workflow-role.maps.ts`: `PUMPING_STEP_ROLE.asignacion = RoleCode.JEFE_BASE`.
  **No tocar** `FCR_PHASE_ROLE` (D2).
- `pumping-actions.controller.ts`: agregar `@WorkflowGate('pumping')` a
  `assign-supervisor` (paso `revision_inicial` → JEFE_BASE) y a
  `assign-resources` (paso `asignacion` → JEFE_BASE). Antes, confirmar con
  grep en el front (`pumping.service.ts`) que no se llaman desde otros
  pasos.
- Revisar los permisos que ahora usa el Jefe de Base en `asignacion`. Todos
  deberían pasar por `withAdmins`; confirmar:
  - `ModuleRoles.inventarioConsumo` (salida de químicos),
  - la subida del documento de mezcla (`POST facturacion/pedidos/:id/documentos-adjuntos`,
    hereda `ModuleRoles.pedidos`),
  - `maintenanceReadOps` (lista de unidades e inspecciones).
- Buscar `asignacion` en `libs/common/src/estados/actor-canonico.ts` y
  `timeline.ts`: si el responsable a mostrar en el timeline está fijo como
  Supervisor, pasarlo a Jefe de Base.
- Actualizar `workflow-role.guard.spec.ts` si prueba `asignacion`, y agregar
  un caso: Supervisor en `asignacion` → 403; Jefe de Base → OK.

**Frontend**
- `pumping.model.ts`: `asignacion: { roleName: 'Jefe de Base', roleId: 4 }`
  (mismo `roleId` que `revision_inicial`; verificar).
- `ticket-detail-page.ts`/`.html`: revisar textos y validaciones que
  asuman al Supervisor en `asignacion`, por ejemplo el fallback
  `responsable = … ?? t.assignedSupervisor ?? 'Supervisor'` en
  `withdrawChemicalsFromWarehouse`. Debe registrar al usuario actual
  (Jefe de Base).
- Opcional (preguntar antes de hacerlo): unir `revision_inicial` y
  `asignacion` en una sola pantalla, porque ahora los hace el mismo rol.
  **No incluido por defecto.**

### Criterio de aceptación
El Jefe de Base crea el ticket, asigna Supervisor, operadores, unidades y
químicos, y avanza a `traslado_salida` sin cambiar de rol. Un Supervisor
recibe 403 en `asignacion`. FCR sigue igual.

---

## Fase 2 — Documentos QHSE reales: Formato de Recepción, ART, PT y SFI

### Estado actual (verificado)

- `Ptw` (`schema.prisma`): `id, code, fase, pedidoId?, payload`. El comentario
  del modelo dice: *"Un pedido puede tener varios PTW — uno por día de
  operación (FACT-004)"*. `abrirPtwDesdeTicket` (`qhse-domain.service.ts`)
  abre el PTW del día siguiente cuando el anterior está cerrado.
- El PTW recién se crea cuando **toda la cobertura IPERC está aprobada**
  (`asegurarPtwDeServicio`). Por eso **no existe al crear el pedido**, y el
  Formato de Recepción **no puede colgar del PTW**.
- `PTW_DOCUMENTOS_REQUERIDOS` (`qhse-domain.service.ts` ~L43) tiene
  `formato_recepcion`, `art`, `ptw_prellenado` y `carnet_vacunas`. Hoy son
  solo un booleano `{ tipo, label, cargado, fileName?, cargadoAt? }` dentro
  de `payload.documentos`, sin archivo real.
- Ruta del controller de PTW: **`qhse/ptw`** (no `ptws`), con
  `@Roles(...ModuleRoles.qhse)` a nivel de clase.
- Patrones de subida real que ya existen (disco local en `UPLOADS_DIR`,
  nunca servido como estático):
  - `PedidoDocumento` + `PedidoDocumentosService`
    (`facturacion/src/pedidos/pedido-documentos.service.ts`): lista libre
    por pedido, **sin campo `tipo`**.
  - `FcrDocumento` y `PumpingDocumento`: un documento por
    `@@unique([ticketId, campo])`. `PumpingDocumento` ya guarda uno por día
    (`campo = 'monitoreo-<fecha>'`).
  - Tipos de archivo permitidos: `TIPOS_ARCHIVO_DOCUMENTO_PEDIDO`
    (`pedido-documentos.constants.ts`).

### Diseño: un solo mecanismo, indexado por `pedidoId`

Todos los documentos QHSE se guardan por `(pedidoId, tipo, referencia)`:

| tipo | referencia | Uno o varios | Sube | Lee |
|------|-----------|--------------|------|-----|
| `qhse_formato_recepcion` | `'vigente'` | 1 por pedido | QHSE | QHSE, Supervisor |
| `qhse_art` | fecha de emisión `YYYY-MM-DD` | **varios** por pedido (D4) | Supervisor | QHSE, Supervisor |
| `qhse_pt` | `ptw.code` (p. ej. `PTW-2026-0041`) | 1 por PTW = 1 por día (D3) | Supervisor | QHSE, Supervisor |
| `qhse_sfi` | `'vigente'` | 1 por pedido | QHSE | QHSE, Supervisor (descarga para entregar a PE) |

- **Vigencia del ART:** no se guarda aparte, se calcula
  `vigenciaHasta = referencia + ART_VIGENCIA_DIAS` (constante = 15, en el
  dominio QHSE). "ART vigente para la fecha X" = el ART con la fecha de
  emisión más reciente que sea ≤ X y cuya vigencia cubra X.
- **Camino A** (existe `DocumentoFirmado` con `(pedidoId, tipo, referencia)`
  y upsert): reusarlo tal cual con los `tipo` de la tabla. Sin migración.
- **Camino B** (no existe): migración que agrega a `PedidoDocumento` dos
  columnas opcionales, `tipo String?` y `referencia String?`, más
  `@@unique([pedidoId, tipo, referencia])`. En SQLite los NULL no chocan
  entre sí, así que los adjuntos existentes (tipo null) no se ven
  afectados. Agregar a `PedidoDocumentosService` un método
  `guardarTipado(pedidoId, tipo, referencia, file, uploadedBy)` con upsert
  (reemplaza el archivo si ya existe y borra el anterior del disco), y otro
  `listarTipados(pedidoId, tipos?)`. `listar()` debe seguir devolviendo
  **solo** los que tienen `tipo = null`, para no mezclarlos en la pestaña
  de adjuntos de Ventas.
- Nombre sugerido: `QhseDocumentosService` en `libs/domains/qhse/src/documentos/`,
  que envuelve cualquiera de los dos caminos. Así controllers y front no se
  enteran de cuál se usó.

### Endpoints

**Lado QHSE** (nuevo `QhseDocumentosController`, `@Roles(...ModuleRoles.qhse)`):
- `GET  /qhse/pedidos/documentos?desde=` — pedidos de Pumping activos
  (id, code, cliente, campo, pozo, fecha inicio, createdAt) con el estado de
  sus 4 tipos. Es la bandeja "Documentos por pedido" de QHSE. Reemplaza la
  idea de v1 de abrir `ModuleRoles.pedidos` a QHSE: QHSE hoy solo tiene
  `pedidosRead` (`GET :id`), no el listado.
- `POST /qhse/pedidos/:pedidoId/documentos/:tipo/:referencia` — solo para
  `qhse_formato_recepcion` y `qhse_sfi`. Otro `tipo` → 403.
- `GET  /qhse/pedidos/:pedidoId/documentos` y
  `GET /qhse/pedidos/:pedidoId/documentos/:tipo/:referencia` (descarga, stream
  igual que `descargarDocumentoAdjunto` en `pedidos.controller.ts`).

**Lado Supervisor** (en `pumping-actions.controller.ts` o un controller
hermano, `@Roles(...ModuleRoles.pumping)`):
- `GET  /operations/pumping/tickets/:id/documentos-qhse`: los 4 tipos del
  pedido del ticket, más el PTW abierto del día (id y code) y el ART vigente
  hoy con su `vigenciaHasta`.
- `POST /operations/pumping/tickets/:id/documentos-qhse/art` (body: fecha de
  emisión + archivo). Roles: `SUPERVISOR`, `SUPERVISOR_PUMPING` y admins.
- `POST /operations/pumping/tickets/:id/documentos-qhse/pt/:ptwCode`: valida
  que el PTW pertenezca al pedido del ticket y esté abierto. Mismos roles.
- `GET  /operations/pumping/tickets/:id/documentos-qhse/:tipo/:referencia`
  (descarga, incluido el SFI).
- Todos resuelven `pedidoId` desde el ticket en el servidor. Nunca se acepta
  `pedidoId` en el body.

### Integración con el PTW
- `PTW_DOCUMENTOS_REQUERIDOS`: cambiar el label de `ptw_prellenado` a
  **"Permiso de Trabajo (PT)"**. Mantener el `tipo` `ptw_prellenado` para no
  romper los payloads existentes. Agregar
  `{ tipo: 'sfi', label: 'Formato de Seguridad de Ingreso (SFI)' }`.
- `PtwService.findOne` / `findAll`: al devolver el PTW, **calcular**
  `documentos[].cargado` / `fileName` / `cargadoAt` a partir de
  `QhseDocumentosService` (formato de recepción y SFI por pedido; ART
  vigente en la fecha del PTW; PT con `referencia = ptw.code`), en vez de
  confiar en el booleano del payload. `carnet_vacunas` sigue como hoy.
  **No** eliminar el booleano del payload (compatibilidad con PTWs sueltos
  sin pedido).
- Agregar un método en `qhse-domain.service.ts`:
  `estadoDocumentalDePedido(pedidoId, fecha)` →
  `{ formatoRecepcion, sfi, artVigente, artVenceEnDias, ptHoy }`, que usan el
  PTW, los avisos (Fase 3) y el gate de P1.

### Frontend
- `features/qhse/ptw/models/ptw.model.ts`: agregar `'sfi'` a
  `PtwDocumentoTipo` y actualizar el label de `ptw_prellenado`.
- `ptw-detail-page`: mostrar los documentos calculados con link de
  descarga; en ART, mostrar "vigente hasta dd/mm" o "vencido".
- Nueva página QHSE **"Documentos por pedido"** (en `features/qhse/`, ruta
  bajo el guard de QHSE): tabla de pedidos con el estado de formato de
  recepción, ART vigente, PT de hoy y SFI; subida de formato de recepción y
  SFI.
- `ticket-detail-page` (Pumping): bloque **"Documentos QHSE"**, visible desde
  `asignacion` en adelante:
  - ART: subir con fecha de emisión; mostrar "vigente hasta" y una alerta si
    faltan ≤ 3 días o ya venció.
  - PT: botón "Subir PT de hoy" contra el PTW abierto del día. Si no hay PTW
    abierto, mostrar "QHSE aún no abrió el PTW del día".
  - SFI y Formato de Recepción: solo descarga.

### Criterio de aceptación
QHSE sube el formato de recepción apenas existe el pedido (aunque todavía no
haya PTW). El Supervisor sube el ART y el PT desde el ticket sin tener
acceso a QHSE. El PTW de cada día muestra todo precargado. Un ART de más de
15 días aparece como vencido.

---

## Fase 3 — Avisos a QHSE en toda la app (campana)

### Estado actual (verificado)

- `core/services/notifications.service.ts`: `setSource(id, items)` /
  `clearSource(id)`. El Header (`layout/header/header.ts`) lee `items()`.
- **La única fuente hoy es de página:** `maintenance-list-page.ts` ~L390
  llama a `setSource('maintenance', …)` en un `effect` y a `clearSource` en
  `onDestroy`. Los avisos **solo existen mientras esa página está
  abierta**. Si QHSE copia ese patrón, no se enteraría de nada fuera de su
  pantalla.
- El servicio documenta que el shell **no puede importar feature modules**
  (para no inflar el bundle inicial).

### Diseño

- **Backend:** `GET /qhse/avisos` (`ModuleRoles.qhse`), calculado por
  consulta, sin tabla. Devuelve `{ id, tipo, titulo, detalle, link, fecha }[]`:
  - `pedido_sin_formato_recepcion`: pedido de Pumping activo sin
    `qhse_formato_recepcion` (punto 1).
  - `personal_asignado`: ticket que ya pasó `asignacion`, con el detalle de
    Supervisor, operadores y unidades (desde el payload del ticket), que
    todavía **no tiene SFI** o **no tiene los casos de checklist abiertos**
    (este último se agrega en la Fase 4) (puntos 3 y 6).
  - `ptw_sin_pt_hoy`: PTW abierto del día sin `qhse_pt` (punto 5).
  - `art_por_vencer` / `art_vencido`: ≤ 3 días o vencido (D4).
  - Checklists en estado `cargado` esperando revisión (se agrega en la
    Fase 4).
- **Opcional:** `GET /operations/pumping/tickets/avisos-supervisor` para el
  Supervisor (subir PT de hoy, ART por vencer, checklist rechazado). Sugerido
  pero **no obligatorio** en esta entrega.
- **Frontend:** nuevo `core/services/qhse-avisos-feeder.service.ts` (solo
  `HttpClient`, sin importar `features/qhse`). Se inicializa en
  `layout/shell/shell.ts`. Si el rol del usuario es `Técnico HSE`,
  `Coordinador HSE` o `Gerente HSE` (**no** Jefe de Base ni Superadmin,
  para no llenarles la campana), consulta `GET /qhse/avisos` al iniciar,
  en cada `NavigationEnd` (con debounce) y cada 5 minutos, y hace
  `setSource('qhse', items)`. Al hacer logout o cambiar de rol:
  `clearSource('qhse')`.
- El link de cada aviso lleva a la página "Documentos por pedido", al PTW o
  a la bandeja de checklists.

### Dependencia
Depende de la Fase 2 (estado de los documentos). La Fase 4 le agrega dos
tipos de aviso más.

---

## Fase 4 — Checklist QHSE por equipo, que bloquea `traslado_salida`

### Estado actual (verificado)

- `InspeccionEquipo` (QHSE) es un CRUD sin estados. **No usarlo como base.**
- Precedente más cercano: `FcrToolInspection` (`schema.prisma`, servicio
  `operaciones/src/fcr-tickets/fcr-tool-inspecciones.service.ts`). Es uno
  por equipo, con `@@unique([ticketId, toolId])` y
  `estado: borrador|enviado|aprobado|rechazado`. Si en la Fase 0 aparece
  "Solicitud de Despacho a Bodega", usar también su UI de aprobar/rechazar
  con motivo.
- **Los equipos sí tienen ID estable:** en Pumping, `Unidad.id` (los
  `unitOptions` del front usan ids reales del catálogo `Unidad`). El
  detalle queda en el payload del ticket tras `assign-resources`
  (`unitIds`, `assignments`); confirmar los nombres exactos de los campos en
  `pumping-domain.service.ts`, método `assignResources`.
- Ya existe un requisito parecido: `validateTransporteUnits`
  (`ticket-detail-page.ts`) exige una **inspección vehicular aprobada**
  (Mantenimiento/Supervisor) antes de asignar unidades de Transporte. **Se
  mantiene.** El checklist QHSE es un control **adicional y posterior** a la
  asignación.
- `PumpingDomainService.advance(id, step, actor)` recibe el **paso destino**
  y ya tiene un gate del mismo estilo: al pasar a
  `revision_reportes_llegada` bloquea si hay mantenimientos abiertos. Copiar
  esa forma.

### Modelo (migración nueva)

```prisma
/// Caso de inspección QHSE por equipo asignado a un ticket de Pumping.
/// Bloquea traslado_salida hasta que todos los equipos del ticket estén 'aprobado'.
model QhseChecklistEquipo {
  id              Int      @id @default(autoincrement())
  pumpingTicketId Int
  pumpingTicket   PumpingTicket @relation(fields: [pumpingTicketId], references: [id])
  equipoTipo      String   @default("unidad") // P4: extensible
  equipoId        Int      // Unidad.id
  equipoNombre    String   // snapshot del code de la unidad (p. ej. 'PUM-07')
  /// 'pendiente' | 'cargado' | 'aprobado' | 'rechazado'
  estado          String   @default("pendiente")
  abiertoPor      String
  documentoNombreOriginal String?
  documentoNombreArchivo  String?
  documentoMimeType       String?
  documentoTamanoBytes    Int?
  documentoRutaRelativa   String?   // 'qhse-checklists/<ticketId>/<uuid.ext>'
  cargadoPor      String?
  cargadoAt       DateTime?
  revisadoPor     String?
  revisadoAt      DateTime?
  motivoRechazo   String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([pumpingTicketId, equipoTipo, equipoId])
  @@map("qhse_checklist_equipos")
}
```
(Agregar la relación inversa `checklistsQhse QhseChecklistEquipo[]` en
`PumpingTicket`.)

### Reglas
- **QHSE abre los casos** (punto 3):
  `POST /qhse/checklist-equipos/abrir { pumpingTicketId }` crea un caso
  `pendiente` por cada unidad del ticket. Es idempotente: no duplica. Si la
  asignación cambia, abre los casos que falten y **no borra** los de
  unidades que ya no están (se ignoran para el gate).
- **Carga:** Operador o Supervisor (`OPERADOR`, `SUPERVISOR`,
  `SUPERVISOR_PUMPING` y admins), desde el ticket:
  `POST /operations/pumping/tickets/:id/checklist-qhse/:checklistId` con el
  archivo. Pasa de `pendiente` o `rechazado` a `cargado`. Como el personal
  no está ligado a usuarios reales, el control es por rol y no por persona:
  documentarlo.
- **Revisión:** `POST /qhse/checklist-equipos/:id/aprobar` y
  `POST /qhse/checklist-equipos/:id/rechazar { motivo }` (motivo
  obligatorio). Roles: `ModuleRoles.qhse`. Solo se revisa un caso en estado
  `cargado`.
- **Bandeja QHSE:** `GET /qhse/checklist-equipos?estado=&pumpingTicketId=`.
  Descarga: `GET /qhse/checklist-equipos/:id/documento`.
- **Gate D5 (backend, obligatorio):** método
  `checklistsAprobados(pumpingTicketId)` en el dominio: `true` solo si hay al
  menos un caso por cada unidad **actualmente** asignada y **todos** están
  `aprobado`. Si falta un caso, cuenta como no aprobado. Se aplica en dos
  lugares:
  1. `PumpingDomainService.advance`: si el paso **actual** es
     `traslado_salida` (o sea, se intenta salir de ese paso), responder 400
     con `"Traslado de salida bloqueado: QHSE no aprobó el checklist de: PUM-07, CAM-04"`.
  2. Cualquier endpoint que ejecute acciones de `traslado_salida` estando el
     ticket en ese paso (como mínimo `PATCH …/unit-report`; buscar otros con
     grep en el `.html`, sección `currentStep() === 'traslado_salida'`).
- **Frontend `ticket-detail-page`:** en `traslado_salida`, si
  `checklistsAprobados` es false, mostrar un banner con la lista de equipos
  y su estado, y **deshabilitar** todo el formulario del paso. Mostrar una
  sección "Checklist QHSE" por equipo, con botón de carga y el motivo de
  rechazo si lo hay. Exponer el estado en
  `GET /operations/pumping/tickets/:id/checklist-qhse`.
- **Frontend QHSE:** página "Checklist de equipos" (bandeja por ticket con
  abrir, descargar, aprobar y rechazar).
- **Avisos (Fase 3):** agregar `checklist_por_abrir` (ticket asignado sin
  casos) y `checklist_por_revisar` (casos en `cargado`).

### Tests mínimos (jest)
- Gate: sin casos → bloquea; un caso `cargado` → bloquea; todos `aprobado`
  → deja avanzar; una unidad nueva sin caso → bloquea.
- `abrir` es idempotente.
- `rechazar` sin motivo → 400.
- ART: cálculo de vigencia en los días 0, 15 y 16 (Fase 2).

---

## Seed (`prisma/seed.ts`)

Mantener el hábito del repo: después de `npx prisma migrate reset --force`
(migraciones + `prisma/seed-full.ts`) tiene que quedar al menos:
- un pedido de Pumping sin formato de recepción (para ver el aviso),
- un ticket en `traslado_salida` con 2 unidades: un checklist `aprobado` y
  otro `cargado` (gate bloqueando),
- un ART emitido hace 14 días (aviso "por vencer") y un PTW del día sin PT.

Los archivos sembrados deben existir de verdad en `UPLOADS_DIR`, o bien el
seed crea solo la metadata y la descarga responde 404 con un mensaje claro.
Elegir uno y documentarlo.

## Checklist de verificación (cada fase)

- `npx tsc --noEmit` en el backend y en el frontend, sin errores.
- `npx jest` en el backend: los conteos de la Fase 0 más los tests nuevos,
  todo en verde.
- `npx ng build --configuration production` sin errores.
- Migraciones con `npx prisma migrate dev --name <nombre>`. Nunca editar
  `schema.prisma` sin migración.
- `npx prisma migrate reset --force` completo funciona de principio a fin.
- Mapas rol↔paso del backend y del frontend en sync (Fase 1).
- Commits chicos por fase, en la rama de trabajo. Sin push ni merge a `main`
  sin revisión.

## Orden de ejecución

0 → 1 → 2 → 3 → 4. La Fase 1 es independiente y puede ir en paralelo con la
2. La 3 necesita la 2. La 4 necesita la 1 (asignación de unidades por el
Jefe de Base) y le agrega avisos a la 3.

---

## Fuera de alcance — Gerenciamiento de viaje (se autoriza aparte)

El negocio pidió que el gerenciamiento de viaje lo genere el **Conductor**
(hoy es texto libre, no un usuario), con aprobación según el nivel de
riesgo: bajo → Supervisor; medio/alto → Gerente HSE o Jefe de Base. Se
decidió construirlo completo, con rol y usuario Conductor reales, **después**
de cerrar las Fases 1–4.

Estado actual: `TravelManagementDialog`
(`features/operations/pumping/components/travel-management-dialog.ts`) es
100% frontend, sin tabla ni endpoint. El riesgo bajo se autoaprueba; el
medio/alto pide al Jefe de Base (no hay rama real para Gerente HSE).
Relacionado: `ConductorPermisos` (`schema.prisma`) usa el nombre como clave
simulada, sin FK a `User`.
