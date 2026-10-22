# BRIEF S4: Operaciones (FCR, Mantenimiento B3, Pumping D2, Inventario)

## Prompt de arranque

Abra Claude Code en `C:/Users/Digitec/Documents/proyectos/dynadrill-platform-s4` y pegue:

```
Usted es la sesión S4 del plan de sesiones paralelas de Dynadrill. Trabaje SOLO en esta carpeta (rama sesion/s4-operaciones).
Lea C:/Users/Digitec/Documents/proyectos/documentacion/modulos/sesiones/BRIEF-S4.md y siga sus instrucciones y las reglas de
C:/Users/Digitec/Documents/proyectos/documentacion/modulos/PLAN-SESIONES-PARALELAS.md. Responda en español con «usted». Empiece por la mini-especificación
y el plan de rebanadas de su primer subdominio y espere la aprobación del usuario antes de construir.
```

## Datos de la sesión

- Carpeta de trabajo: `C:/Users/Digitec/Documents/proyectos/dynadrill-platform-s4` · rama: `sesion/s4-operaciones` · módulo para `commit-modulo.ps1`: `operaciones`
- Código principal: `libs/operaciones/{fcr,flota,mantenimiento,pumping,inventario}`
- Antes de la primera prueba: `npx nx run <proyecto>:prisma-generate` (los clientes generados no se versionan).

## Cómo trabajar (obligatorio)

Lea primero, en este orden: `documentacion/modulos/PLAN-SESIONES-PARALELAS.md` (reglas §4 y §5: son obligatorias), `documentacion/modulos/PENDIENTES-DE-MIGRACION.md` (§0 y la sección de su módulo), `documentacion/modulos/00-CONTEXTO-COMPARTIDO.md` y `01-REGLAS-DE-COORDINACION.md`, y el plan de su módulo. Luego siga el flujo del §4 del plan con las skills instaladas (`using-agent-skills`, `spec-driven-development` corto, `planning-and-task-breakdown`, `incremental-implementation` + `test-driven-development`, `doubt-driven-development` en migraciones, `code-review-and-quality`).

**Primera entrega:** la mini-especificación y el plan de rebanadas de su primer subdominio. **Muéstrela al usuario y espere su aprobación** antes de escribir migraciones o código.

## Alcance (en este orden de prioridad)

1. **FCR** (`libs/operaciones/fcr`): (a) disponibilidad de operadores por rango en la asignación (✓/✗ por operador según el servicio, como la demo; Pumping ya tiene `ocupadas`: reutilice la idea); (b) **Observaciones** del ticket (registro con autor y fecha, inmutable); (c) datos para el **PDF de resumen y la encuesta de satisfacción** del cierre (encuesta normalizada: preguntas en catálogo, respuestas en filas); (d) endpoint para el banner de la **matriz IPERC** del ticket (por evento o consulta, sin FK entre contenedores); (e) decidir con el usuario si el ticket del servicio puede **volver de Inspección a «Tipo de operador»** o si ese paso exige el listado de herramientas antes de avanzar (hoy un ticket pasado sin herramientas queda atascado; ejemplo: ticket 4551). **Revise la demo con cuidado antes de agregar cada ítem**: el usuario ya reprochó agregar de más.
2. **Mantenimiento B3**: consumidor de `qhse.reporte_unidad.generado` (suscripción única a `source: 'qhse'`, idempotente por `casoId`, crea el reporte recibido con origen QHSE). FCR no genera reporte de unidad.
3. **Pumping D2**: migrar Pumping de `catalogos.vehiculo` a `flota.unidad` (asignación y guía), sin FK entre contenedores (ids con `COMMENT`) y con migración de los datos existentes.
4. **Inventario**: mínimos de stock y evento `stock.bajo_minimo` (IN4); unidad como catálogo compartido (IN9). **B7 decidido el 22/10/2026: las herramientas de FCR NO mueven el kardex.** No invente IN1, IN2, IN3, IN5 ni IN8 (esperan decisión del usuario).

## Planes y documentos de referencia

- `documentacion/modulos/plan-fcr.md`, `plan-mantenimiento.md`, `plan-flota.md`, `plan-inventario.md`, `plan-pumping-restante.md`, `documentacion/fcr/`, `documentacion/mantenimiento/`.
- Demo: `dynadrill/dynadrill-frontend` (pantallas FCR) y `dynadrill-backend`.
- El diseño acumulativo por fase de FCR (tal cual la demo) no se cambia.

## Reglas específicas de esta sesión

- Cuatro módulos en una sesión: **trabaje de a uno, en el orden indicado**; no deje dos a medias.
- No toque los consumidores de Comercial (S3). Si S3 necesita otro campo en un evento de FCR, la solicitud va en `REGISTRO-DE-CAMBIOS-COMPARTIDOS.md`.
- Migraciones: `2026102413xxxx` en adelante (posteriores a `20261023120000`); cada esquema con su `db:migrate:<x>`.
- Las pruebas de FCR tardan 3–5 min: ejecútelas en segundo plano y espere con Monitor.

## Criterio de «terminado» por subdominio

Migración aplicada en base vacía · semilla de catálogos · API con permisos en `permissions.ts` · eventos por outbox · pruebas de integración en verde (reglas de la base incluidas) · `PENDIENTES-DE-MIGRACION.md` actualizado (hecho / falta / qué necesitará el frontend) · commit con `commit-modulo.ps1`.

## Frontend (segunda parte: solo después del backend)

**Orden:** primero todo su backend, hasta la hora de corte. Después, en el último bloque, adapte el frontend de los subdominios que quedaron **terminados, probados y commiteados**. Lo que no alcance queda anotado en `PENDIENTES-DE-MIGRACION.md` como pendiente de frontend. La sesión principal se encarga de las pantallas cuyo backend ya existía antes de hoy (Despachos de Bodega, Códigos por cliente de FCR, corte de Facturación a `/api/comercial`, catálogos a `/api/v2/catalogos`): **no las toque**.

**Dónde:** `C:/Users/Digitec/Documents/proyectos/dynadrill/dynadrill-frontend-merge` (rama de trabajo `integracion/fusion-front`; es la copia adaptada del frontend, **su `origin` es la demo: NUNCA empujar a `origin`**). Se edita en esa carpeta, sin cambiar de rama.

**Cómo se entrega:** rama propia `modulo/s4-front` (ya creada) con el script, desde la carpeta del frontend, solo con rutas propias:
`..\..\dynadrill-platform\scripts\commit-modulo.ps1 -Modulo s4-front -Mensaje "feat(...): ..." -Rutas <rutas propias> -Subir -Remoto respaldo`
(el script crea el commit en `modulo/s4-front` sin tocar la rama actual; la sesión principal la fusiona en `integracion/fusion-front`).

**Reglas de frontend (obligatorias):**
- **Diseño idéntico al de la demo, en escritorio y móvil.** No invente diseño ni haga «copy-pages sin estilos»: tome los componentes y estilos de la pantalla de la demo (`dynadrill/dynadrill-frontend/src/app/features/...`) y cambie solo los datos y la lógica para usar el backend nuevo (`/api/v2/qhse`, `/api/operaciones/...`, `/api/comercial`, `/api/plataforma/...`; ids UUID). Antes de agregar algo, confirme en la demo que es parte del flujo.
- Texto en español neutro con **«usted»**, nunca voseo (también en mensajes de error y botones).
- Angular del proyecto: componentes standalone con `ChangeDetectionStrategy.OnPush`, señales, `input()`/`output()`, flujo de control nativo (`@if`, `@for`), formularios reactivos, accesibilidad AA. Retire el servicio de la demo que la pantalla reemplaza.
- **Archivos compartidos del frontend** (`app.routes`, `qhse.routes.ts`, `navigation.service.ts`, modelos y servicios comunes): solo agregue su bloque; **no los incluya en su commit** (el script formatearía y llevaría los cambios de otras sesiones): avise a la sesión principal qué cambió y ella los commitea.
- Verificación: `npx ngc --noEmit -p tsconfig.app.json` (no valida SCSS: use `npx sass --no-source-map archivo.scss`), `npx ng test --watch=false --include='<ruta>'`. **No use el navegador (Playwright) ni levante `ng serve`**: son del usuario y de la sesión principal; pida al usuario que revise la pantalla.
- Solo formatee (`prettier`) sus propias rutas.

**Pantallas de su alcance:**
- FCR en `features/operations/fcr/tickets-nuevos`: disponibilidad de operadores en la asignación (✓/✗), botón **Observaciones**, PDF de resumen y encuesta de satisfacción del cierre, banner de la matriz IPERC, y el cambio que se decida para el ticket atascado en Inspección.
- Pumping: lo que cambie de pantalla por D2 (unidad de Flota en la asignación y la guía).
- Inventario: mínimos de stock y alerta de stock bajo el mínimo.
- Mantenimiento: lo visible del consumidor B3 (reporte de origen QHSE) si cambia algo en la pantalla.
