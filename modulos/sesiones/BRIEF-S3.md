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
