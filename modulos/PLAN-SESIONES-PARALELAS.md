# Plan de sesiones paralelas: cerrar backend y base de datos normalizada

> Creado el 22/10/2026. Objetivo del día: terminar los pendientes de **backend y base de datos** de `PENDIENTES-DE-MIGRACION.md` §2 con **4 sesiones en paralelo** más la sesión principal (integración). El frontend de lo nuevo se adapta **después** (reglas de `PENDIENTES-DE-MIGRACION.md` §0.2: diseño idéntico al de la demo).
> Skills usadas: `addyosmani/agent-skills` (instaladas en `~\.claude\skills`). Briefs por sesión: `sesiones/BRIEF-S1.md` … `BRIEF-S4.md`.

## 1. Reparto

| Sesión | Rama | Carpeta de trabajo | Alcance |
|---|---|---|---|
| **S1** QHSE-A | `sesion/s1-qhse-a` | `dynadrill-platform-s1` | Desechos → Derrames → Emergencias/MEDEVAC |
| **S2** QHSE-B | `sesion/s2-qhse-b` | `dynadrill-platform-s2` | Investigación de incidentes → Requisitos legales → Objetivos y Aspectos ambientales → Avisos de QHSE |
| **S3** Plataforma y Comercial | `sesion/s3-plataforma-comercial` | `dynadrill-platform-s3` | Auditoría → Comercial (C9, C10, `documentoTicketId`, cantidad por día) → Firmas |
| **S4** Operaciones | `sesion/s4-operaciones` | `dynadrill-platform-s4` | FCR (disponibilidad, Observaciones, PDF de cierre, IPERC, ticket atascado) → Mantenimiento B3 → Pumping D2 → Inventario (mínimos, unidad compartida) |
| **Principal** | `desarrollo` | `dynadrill-platform` | Fusionar ramas de sesión, gateway (B11), pruebas completas, después Dashboard/Reportería (con las tablas de S1 y S2) y el frontend |

Cada sesión trabaja en **su propia carpeta** (copia de trabajo de git) para no pisar archivos, compilaciones ni puertos. Ya están creadas (22/10/2026) con `node_modules` enlazado (junction), los `.env` copiados y los clientes de Prisma generados; no hace falta preparar nada. **No** use `ln -s` de Git Bash para enlazar `node_modules`: copia el directorio completo.

## 2. Decisiones ya tomadas (no reabrir)

- **B7 (22/10/2026):** las herramientas que el operador selecciona en el flujo de FCR **no mueven el kardex**; solo se registran en el ticket. No se agrega `ticket_fcr_id` a los movimientos de inventario.
- FCR **no** lleva unidades ni reporte de unidad de llegada.
- El ticket de FCR conserva el diseño acumulativo por fase de la demo.

## 3. Fuera de alcance hoy (necesita decisión o respuesta externa; **no inventar**)

Umbrales de derrames (consultar a Dynadrill); fórmulas KPI de `MAN-MASTER-001`; qué se conserva del Reporte Diario de Pumping; IN1, IN2, IN3, IN5, IN8 e IN7/D3 de Inventario; lista blanca de AS2 con TI; consultas R5, R6, G6–G8 de Facturación. Si una sesión llega a un punto que depende de ellas: modelar solo lo que no depende de la respuesta, dejar el resto documentado en `PENDIENTES-DE-MIGRACION.md` y seguir.

## 4. Flujo obligatorio de cada sesión (skills)

1. `using-agent-skills`; leer `PENDIENTES-DE-MIGRACION.md` §0 y §2, el `plan-*.md` de su módulo y su `BRIEF`.
2. `spec-driven-development` **corto**: una mini-especificación por subdominio (reglas de la demo que se respetan, tablas, eventos, permisos). Reutilizar los `plan-*.md`; no crear PRD nuevos. **Se la muestra al usuario antes de construir.**
3. `planning-and-task-breakdown`: rebanadas verticales (migración + servicio + permisos + eventos + pruebas).
4. `incremental-implementation` + `test-driven-development`: una rebanada a la vez; pruebas de integración contra las reglas de la base (`RUN_INTEGRATION=1`).
5. `doubt-driven-development` solo en migraciones y reglas que bloquean cierres.
6. `code-review-and-quality` antes de cada commit.
7. Commit y entrega con las reglas del §5 (el script del proyecto manda sobre `git-workflow-and-versioning`).

## 5. Reglas para no pisarse

**Repositorio**
- Se trabaja solo dentro de la carpeta propia de la sesión; nunca en `dynadrill-platform` (principal) ni en las de otras sesiones.
- Commit: desde la carpeta de la sesión, en PowerShell: `.\scripts\commit-modulo.ps1 -Modulo <x> -EnRamaActual -Mensaje "..." -Rutas <rutas propias> -Subir`. Solo rutas propias; nunca `git add -A`, `reset`, `checkout` ni `stash`.
- Mensaje: asunto ≤100 caracteres y **cada línea del cuerpo ≤100**; Conventional Commits; atribución la agrega el script.
- Un commit por rebanada terminada y probada. La sesión principal fusiona las ramas `sesion/*` en `desarrollo`.

**Archivos compartidos** (`libs/shared/authz/src/lib/permissions.ts`, tablas de rutas del gateway, `REGISTRO-DE-CAMBIOS-COMPARTIDOS.md`, `PENDIENTES-DE-MIGRACION.md`)
- Solo se **agrega** un bloque propio al final de su sección; nunca se reordena ni se reformatea el resto. Se commitean al terminar cada rebanada para que el conflicto sea mínimo.

**Base de datos y servicios**
- Cada sesión migra **solo su propio esquema** (`npm run db:migrate:<x>`); sin `infra:reset`. Las marcas de tiempo de migración deben ser únicas y **posteriores a `20261023120000`** (la última existente): S1 usa `2026102410xxxx`, S2 `2026102411xxxx`, S3 `2026102412xxxx`, S4 `2026102413xxxx`.
- **Nadie modifica ni borra datos de la base compartida a mano.** Las pruebas de integración crean y limpian sus propios datos.
- Las sesiones corren pruebas y compilaciones, **no** levantan servicios en los puertos 3100–3104, 3300 ni 4200 (los usa la sesión principal). Si necesita un servicio, lo pide a la sesión principal.
- `nx test`: `RUN_INTEGRATION=1 NO_COLOR=1 npx nx test <lib> --skip-nx-cache --testPathPatterns=...` (FCR tarda varios minutos: ejecutar en segundo plano). Antes de la primera prueba: `npx nx run <proyecto>:prisma-generate`.

**Calidad (el listón no baja)**
- Reglas de BD de `PENDIENTES-DE-MIGRACION.md` §0.1: normalizada, FK reales dentro del contenedor, **sin FK entre contenedores** (ids con `COMMENT`), sin JSON, auditoría (`created_at/by`, `updated_at/by`), historia inmutable, catálogos en tablas, `CHECK`s de las reglas de negocio.
- Texto en español neutro con **«usted»** (nunca voseo), también en mensajes de error y plantillas.
- Prohibido silenciar para pasar: nada de `@ts-ignore`, `eslint-disable`, pruebas omitidas o borradas, ni aserciones debilitadas.
- Correos de prueba solo a `gustavo_morales@digitec.com.ec`; nunca imprimir secretos ni `.env`.
- Cada nuevo subdominio: migración, semilla de catálogos, API bajo su prefijo, permisos en `permissions.ts`, eventos por outbox, plantillas de avisos si aplica, pruebas de integración y **actualización de `PENDIENTES-DE-MIGRACION.md`** (qué quedó hecho y qué falta, incluido lo que necesitará el frontend).

## 6. Cronograma del día

| Bloque | Qué pasa | Duración |
|---|---|---|
| 0 | Sesión principal: carpetas, briefs, prompts (este plan) | hecho al abrir las sesiones |
| 1 | Cada sesión: mini-especificación + plan de rebanadas; **el usuario aprueba** | ~30 min |
| 2 | Construcción por rebanadas, un commit por rebanada | el grueso del día |
| 3 | **Corte a la hora que el usuario fije** (sugerido: 1,5 h antes de terminar): cada sesión cierra su rebanada en curso, deja todo probado y commiteado y documenta lo que falte | 1,5 h |
| 4 | Sesión principal: fusión de `sesion/*`, `nx run-many -t test`, gateway (B11 con `curl` autenticado), Dashboard/Reportería con las tablas de S1/S2 | resto |

Lo que no esté probado y commiteado a la hora del corte **no se fusiona**: se documenta como pendiente.

## 7. Cierre de la sesión principal (lista de verificación)

- [ ] Cada rama `sesion/*` revisada y fusionada en `desarrollo` (conflictos en archivos compartidos resueltos conservando ambos bloques).
- [ ] Migraciones de los 4 esquemas aplican limpias sobre una base vacía y sobre la actual.
- [ ] `RUN_INTEGRATION=1 npx nx run-many -t test` en verde; `lint` y `build` de los contenedores.
- [ ] Gateway: los prefijos nuevos pasan (B11) y `routes.spec.ts` actualizado.
- [ ] `PENDIENTES-DE-MIGRACION.md` y `REGISTRO-DE-CAMBIOS-COMPARTIDOS.md` al día; frontend pendiente listado por pantalla.
