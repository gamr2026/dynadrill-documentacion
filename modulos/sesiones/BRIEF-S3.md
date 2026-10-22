# BRIEF S3: Plataforma y Comercial (Auditoría, Comercial, Firmas)

## Prompt de arranque

Abra Claude Code en `C:/Users/Digitec/Documents/proyectos/dynadrill-platform-s3` y pegue:

```
Usted es la sesión S3 del plan de sesiones paralelas de Dynadrill. Trabaje SOLO en esta carpeta (rama sesion/s3-plataforma-comercial).
Lea C:/Users/Digitec/Documents/proyectos/documentacion/modulos/sesiones/BRIEF-S3.md y siga sus instrucciones y las reglas de
C:/Users/Digitec/Documents/proyectos/documentacion/modulos/PLAN-SESIONES-PARALELAS.md. Responda en español con «usted». Empiece por la mini-especificación
y el plan de rebanadas de su primer subdominio y espere la aprobación del usuario antes de construir.
```

## Datos de la sesión

- Carpeta de trabajo: `C:/Users/Digitec/Documents/proyectos/dynadrill-platform-s3` · rama: `sesion/s3-plataforma-comercial` · módulo para `commit-modulo.ps1`: `plataforma`
- Código principal: `libs/plataforma/* y libs/comercial/pedidos`
- Antes de la primera prueba: `npx nx run <proyecto>:prisma-generate` (los clientes generados no se versionan).

## Cómo trabajar (obligatorio)

Lea primero, en este orden: `documentacion/modulos/PLAN-SESIONES-PARALELAS.md` (reglas §4 y §5: son obligatorias), `documentacion/modulos/PENDIENTES-DE-MIGRACION.md` (§0 y la sección de su módulo), `documentacion/modulos/00-CONTEXTO-COMPARTIDO.md` y `01-REGLAS-DE-COORDINACION.md`, y el plan de su módulo. Luego siga el flujo del §4 del plan con las skills instaladas (`using-agent-skills`, `spec-driven-development` corto, `planning-and-task-breakdown`, `incremental-implementation` + `test-driven-development`, `doubt-driven-development` en migraciones, `code-review-and-quality`).

**Primera entrega:** la mini-especificación y el plan de rebanadas de su primer subdominio. **Muéstrela al usuario y espere su aprobación** antes de escribir migraciones o código.

## Alcance (en este orden de prioridad)

1. **Auditoría** (`plataforma/auditoria`): proyectar los eventos que ya publican todos los módulos en una línea de tiempo consultable (quién, qué, cuándo, sobre qué entidad), inmutable, con permiso de lectura. El esquema existe vacío; falta la lib y su registro en el contenedor, según `plan-firmas-y-auditoria.md`.
2. **Comercial** (`libs/comercial/pedidos`): C9 (descargar el PDF de **todos** los documentos del pedido), C10 (plantillas de ejemplo de Pumping y FCR en «Nuevo pedido»), validar que `documentoTicketId` de los documentos firmados pertenezca al ticket, y la **cantidad por día del Reporte de Herramientas de FCR** llevada en el evento y en `documento_operativo_uso` (hoy Comercial recibe solo el total por ítem; lea la publicación de `libs/operaciones/fcr` sin editarla: FCR es de S4). Limpieza opcional con migración: permiso `comercial.cierre.gestionar` y columnas `factura_*` sin uso.
3. **Firmas** (`plataforma/firmas`): evidencia de firma (hoy cada módulo guarda su «firma de una línea» y QHSE tiene OCR de firmas). Siga `plan-firmas-y-auditoria.md`; si el plan exige decisiones del usuario, preséntelas en la mini-especificación.

## Planes y documentos de referencia

- `documentacion/modulos/plan-firmas-y-auditoria.md`, `plan-comercial-ajustes.md`, `plan-integracion-final.md`, `plan-corte-de-la-demo.md`.
- `documentacion/facturacion/PLAN-MODULO-FACTURACION.md` y `CONSULTAS-PARA-DYNADRILL.md` (R5, R6, G6–G8 son consultas abiertas: no las decida).
- `documentacion/fcr/PLAN-REPORTE-DE-HERRAMIENTAS-POR-ITEM.md` para la cantidad por día.

## Reglas específicas de esta sesión

- Las libs nuevas de plataforma siguen la estructura de `libs/plataforma/avisos` o `archivos` (esquema propio, Prisma, outbox/inbox con `claveInbox` por grupo; ver `libs/shared/messaging`). Regístrelas en `apps/plataforma`.
- No toque el corte del prefijo `/api/facturacion` (es de la sesión principal).
- Migraciones: `2026102412xxxx` en adelante (posteriores a `20261023120000`); cada esquema con su `db:migrate:<x>`.
- Reportería y Dashboard **no** son de esta sesión.

## Criterio de «terminado» por subdominio

Migración aplicada en base vacía · semilla de catálogos · API con permisos en `permissions.ts` · eventos por outbox · pruebas de integración en verde (reglas de la base incluidas) · `PENDIENTES-DE-MIGRACION.md` actualizado (hecho / falta / qué necesitará el frontend) · commit con `commit-modulo.ps1`.

## Frontend (segunda parte: solo después del backend)

**Orden:** primero todo su backend, hasta la hora de corte. Después, en el último bloque, adapte el frontend de los subdominios que quedaron **terminados, probados y commiteados**. Lo que no alcance queda anotado en `PENDIENTES-DE-MIGRACION.md` como pendiente de frontend. La sesión principal se encarga de las pantallas cuyo backend ya existía antes de hoy (Despachos de Bodega, Códigos por cliente de FCR, corte de Facturación a `/api/comercial`, catálogos a `/api/v2/catalogos`): **no las toque**.

**Dónde:** `C:/Users/Digitec/Documents/proyectos/dynadrill/dynadrill-frontend-merge` (rama de trabajo `integracion/fusion-front`; es la copia adaptada del frontend, **su `origin` es la demo: NUNCA empujar a `origin`**). Se edita en esa carpeta, sin cambiar de rama.

**Cómo se entrega:** rama propia `modulo/s3-front` (ya creada) con el script, desde la carpeta del frontend, solo con rutas propias:
`..\..\dynadrill-platform\scripts\commit-modulo.ps1 -Modulo s3-front -Mensaje "feat(...): ..." -Rutas <rutas propias> -Subir -Remoto respaldo`
(el script crea el commit en `modulo/s3-front` sin tocar la rama actual; la sesión principal la fusiona en `integracion/fusion-front`).

**Reglas de frontend (obligatorias):**
- **Diseño idéntico al de la demo, en escritorio y móvil.** No invente diseño ni haga «copy-pages sin estilos»: tome los componentes y estilos de la pantalla de la demo (`dynadrill/dynadrill-frontend/src/app/features/...`) y cambie solo los datos y la lógica para usar el backend nuevo (`/api/v2/qhse`, `/api/operaciones/...`, `/api/comercial`, `/api/plataforma/...`; ids UUID). Antes de agregar algo, confirme en la demo que es parte del flujo.
- Texto en español neutro con **«usted»**, nunca voseo (también en mensajes de error y botones).
- Angular del proyecto: componentes standalone con `ChangeDetectionStrategy.OnPush`, señales, `input()`/`output()`, flujo de control nativo (`@if`, `@for`), formularios reactivos, accesibilidad AA. Retire el servicio de la demo que la pantalla reemplaza.
- **Archivos compartidos del frontend** (`app.routes`, `qhse.routes.ts`, `navigation.service.ts`, modelos y servicios comunes): solo agregue su bloque; **no los incluya en su commit** (el script formatearía y llevaría los cambios de otras sesiones): avise a la sesión principal qué cambió y ella los commitea.
- Verificación: `npx ngc --noEmit -p tsconfig.app.json` (no valida SCSS: use `npx sass --no-source-map archivo.scss`), `npx ng test --watch=false --include='<ruta>'`. **No use el navegador (Playwright) ni levante `ng serve`**: son del usuario y de la sesión principal; pida al usuario que revise la pantalla.
- Solo formatee (`prettier`) sus propias rutas.

**Pantallas de su alcance:**
- Comercial: descargar el PDF de todos los documentos del pedido (C9) y las plantillas de ejemplo en «Nuevo pedido» (C10), en `features/facturacion/pedidos-comercial`; hoja del Reporte de Herramientas de FCR con las cantidades por día cuando el backend las entregue.
- Plataforma: pantalla de consulta de **Auditoría** (línea de tiempo con filtros) y, si el backend de **Firmas** queda listo, su visor de evidencia. Defina con el usuario dónde va en el menú.
