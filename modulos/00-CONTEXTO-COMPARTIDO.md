# Contexto compartido (léalo completo antes de empezar)

## 1. El proyecto en una página

Dynadrill es una empresa de servicios petroleros (Ecuador). Existe una **demo** (backend NestJS + SQLite y un frontend Angular) que se está **reemplazando** por un backend de producción en PostgreSQL. El frontend se conserva y se adapta módulo por módulo. Quien construye un módulo entrega: **base de datos + backend + pantallas + pruebas + documentación**.

| Pieza | Ubicación (`C:\Users\Digitec\Documents\proyectos\`) | Notas |
|---|---|---|
| Backend nuevo (monorepo Nx) | `dynadrill-platform` | repo git propio, rama `main`, sin remoto, con muchos archivos sin confirmar |
| Frontend (copia adaptada) | `dynadrill\dynadrill-frontend-platform` | Angular, Vitest. Repo `DIGITEC-IT-PROJECTS/dynadrill-frontend`, rama `feat/integracion-backend-platform` |
| Demo backend (SOLO LECTURA) | `dynadrill-backend` | NestJS + Prisma + SQLite. Es la fuente de las reglas de negocio |
| Demo frontend original | `dynadrill\dynadrill-frontend` | no se modifica |
| Documentación | `documentacion` | repo `proyectos`, rama `developer` |
| Proyecto de referencia de estilo | `nuevo-portal` | otra empresa del grupo; se consultó para el modelo de base de datos |

> **Aviso importante sobre la demo.** La referencia es el **`main` remoto** de `dynadrill-backend` (08/10/2026, `ec6bbe2`) y de `dynadrill-frontend` (07/10/2026, `74ca851`) en GitHub (`DIGITEC-IT-PROJECTS`). **Las carpetas locales `dynadrill-backend` y `dynadrill\dynadrill-frontend` están desactualizadas** (24/09 y 28/09): no se actualizan ni se tocan; para leer el `main` actual se clona en una carpeta temporal (`git clone --depth 50 --branch main <url> <carpeta temporal>`). `dynadrill-frontend-platform` y sus `specs/` están al nivel del `main` del frontend. Qué cambió y cómo afecta: `04-REVISION-CONTRA-DEMO-MAIN.md`. Antes de empezar su módulo, compare el `main` con su plan (`git ls-remote origin refs/heads/main` dice si cambió). Ejemplos ya detectados: el paso `mantenimiento` salió del flujo de Pumping; el checklist QHSE de equipos fue reemplazado por la inspección de vehículos; el checklist de ingreso a locación pasó a la ejecución; el cierre del ticket exige el Acta de Entrega de Locación.

## 2. Arquitectura

- **Contenedores** (cada uno es una app NestJS; hablan entre sí por **eventos (RabbitMQ con outbox/inbox)** o HTTP interno, nunca por import):

| Contenedor | App / puerto | Schemas | Usuario de base de datos |
|---|---|---|---|
| gateway | `apps/gateway` 3100 | — | — |
| plataforma | `apps/plataforma` 3101 | `identidad`, `catalogos`, `integraciones`, `archivos`, `firmas`, `avisos`, `auditoria`, `msg_plataforma` | `app_plataforma` |
| comercial | `apps/comercial` 3102 | `comercial`, `msg_comercial` | `app_comercial` |
| operaciones | `apps/operaciones` 3103 | `fcr`, `pumping`, `flota`, `mantenimiento`, `inventario`, `msg_operaciones` | `app_operaciones` |
| qhse | `apps/qhse` (por crear, 3104) | `qhse`, `msg_qhse` | `app_qhse` |
| worker | `apps/worker` (por crear) | `reporting`, `msg_worker` | `app_worker` |
| firmas-ocr | `apps/firmas-ocr` 8090 (Python) | — | — |

  Los schemas, usuarios y privilegios ya están en `infra/db/init/02-schemas.sql`. **Cambiar esos archivos exige `npm run infra:reset` o un `ALTER` a mano y afecta a todos: coordínelo** (regla 6 del archivo de coordinación).
- **Un módulo = una librería Nx** en `libs/<contenedor>/<modulo>/` (ejemplo: `libs/operaciones/pumping`, `@dyn/pumping`). Cada una trae `prisma/schema.prisma`, `prisma/migrations/*` (SQL escrito a mano), `prisma/seed.ts`, `src/` (controllers, services, dto, consumers, catalog), pruebas y `index.ts`. **Módulo de referencia para copiar patrones: `libs/operaciones/pumping`** (y `libs/comercial/pedidos` para algo más grande).
- **Gateway** (`apps/gateway/src/app/routes.ts`): los prefijos de la demo siguen yendo a la demo. Lo migrado se publica bajo un prefijo nuevo (`/api/operaciones/...`, `/api/comercial/...`, `/api/v2/catalogos` con reescritura). Para un módulo que convive con la demo se usa un prefijo `v2` (ejemplo para QHSE: `/api/v2/qhse` reescrito a `/api/qhse`).
- **Seguridad**: JWT RS256 con permisos dentro del token. Cada endpoint exige un permiso (`@RequirePermission`) definido en `libs/shared/authz/src/lib/permissions.ts` (hoy 77). Los permisos y roles por defecto salen de ahí; luego los edita un administrador en la base. El puente a la demo (token HS256) solo traduce si el usuario tiene `legacy_id`.
- **Eventos**: `EventBus.publish(tx, evento)` en la misma transacción que el cambio (outbox); consumidores con `handleOnce` (inbox, idempotente). Nombres: `<contenedor o módulo>.<entidad>.<hecho en pasado>` (`operaciones.pumping.asignacion_realizada`). Ver `02-CONTRATOS-ENTRE-MODULOS.md`.
- **Avisos** (correo y campanita): la plataforma ya tiene plantillas y reglas por evento y rol, y **avisos por cuenta elegida** (el evento trae `asignados: [{ usuarioId, rolCodigo }]`). Cada módulo agrega sus plantillas.
- **Archivos**: módulo `archivos` (Azurite en local); cada tipo de documento es un `modulo_archivo` con su regla.
- **Frontend**: servicios por módulo, pantallas con `@digitec-it-projects/dynadrill-ui`, impresión de formatos con `DocumentoPdfService` + `window.print()`. La campanita se alimenta del servicio de avisos.

## 3. Reglas que no se negocian

1. **Base de datos normalizada y profesional.** Catálogos como tablas con `id` y FK (nunca texto suelto ni constantes de la demo); valores fijos como `ENUM` de PostgreSQL; **cero JSON** en lugar de columnas; **cero copias de nombre**: se guarda el id con FK y el nombre se obtiene con JOIN. Solo se conserva copia en **documentos emitidos** (guía, orden de trabajo, prefactura firmada) y en datos de AS2 que no existen en el catálogo. Las FK a las tablas maestras (`catalogos`, `identidad`, `archivos`) son reales; los modelos Prisma de esas tablas dentro de un módulo son **espejos de solo lectura** (ver `libs/operaciones/pumping/prisma/schema.prisma`, sección final). La demo guarda casi todo en `payload` JSON: **eso hay que desarmarlo en tablas**.
2. **Auditoría en todo.** `created_by`/`updated_by` y las columnas de "quién hizo qué" son FK a `identidad.usuario`.
3. **Ids UUIDv7 generados por la aplicación** (`uuidv7()` de `@dyn/utils`), sin `DEFAULT` en la base.
4. **Migraciones SQL a mano** (con `dyn_migrator`, directo a PostgreSQL en el 5433) y `prisma migrate deploy` (`npm run db:migrate:<modulo>`). No usar `migrate dev`. Cada módulo agrega sus scripts `db:migrate:<modulo>` y `db:seed:<modulo>` en `package.json`.
5. **Permisos de lectura entre schemas mínimos**: `GRANT SELECT` solo de las tablas y columnas necesarias; nunca `password_hash` ni la clave del archivo.
6. **Pruebas de integración contra PostgreSQL real** (`RUN_INTEGRATION=1`), que **crean sus propios registros maestros reales** (ver `src/testing/maestros.ts` en `pumping` y `comercial`) y los borran al final; nombres y documentos únicos por corrida (`Date.now()`); restauran contadores. Unitarias donde aplique.
7. **El módulo no se da por terminado** sin: migración aplicada, semilla, pruebas verdes, `lint` y `build` en verde, pantalla funcionando, reinicio de servicios y documentación actualizada.
8. **Idioma**: español neutro con **"usted"**, nunca voseo. Aplica a textos de pantalla, mensajes de error, comentarios y documentos.
9. **Correos de prueba**: **todos** salen únicamente a `gustavo_morales@digitec.com.ec` (el servicio de avisos lo garantiza; no lo salte). SMTP local = Mailpit (`http://localhost:8025`).
10. **Sin commits ni subidas** salvo que el usuario lo pida. **Nunca** imprimir ni guardar tokens, claves, `.env` ni el secreto JWT de la demo.
11. **La demo es de solo lectura.** No se modifica `dynadrill-backend` ni `dynadrill-frontend`; sí se puede leer su código y su SQLite (`prisma\dynadrill.db`).
12. **Cuentas nuevas inactivas** hasta entregarlas (salvo autorización expresa).
13. **No lanzar procesos pesados en paralelo**: una sola verificación `nx` a la vez en toda la máquina (memoria limitada) y sin `sleep` encadenados.
14. **Dudas de negocio**: se anotan en `documentacion/<area>/CONSULTAS-PARA-DYNADRILL.md` (o `integracion-as2/CONSULTAS-PARA-ASINFO.md` si es de AS2) y se continúa con la opción conservadora.

## 4. Qué ya existe (para reutilizar)

- **Identidad**: usuarios, roles (15), permisos, sesiones, cuentas de empleados de AS2 (≈ 70), directorio de personas por rol (`GET /api/roles/:codigo/usuarios`).
- **Catálogos** (`catalogos`): clientes, campos, bloques, pozos, taladros, zonas, bodegas, condiciones de pago, personas de contacto, transportistas, tipos de vehículo, vehículos, choferes.
- **Archivos**: subida con verificación, firmas electrónicas (OpenCV, Tesseract, pyHanko) y manuscritas.
- **Avisos**: plantillas, reglas, campanita, correo seguro.
- **Integración AS2**: lectura de pedidos, empleados, clientes; exportación CSV de prefactura.
- **Comercial (pedidos)**: pedido, documentos operativos, prefactura, guía de remisión, orden de trabajo, cierre, secuenciales.
- **Pumping hasta el traslado de salida**: ticket por pedido, asignación emparejada, requisitos por paso, términos, checklist de ingreso, reporte de unidad (salida). Ver `pumping/PLAN-TRASLADO-SALIDA.md`.

## 5. Comandos útiles

```powershell
cd C:\Users\Digitec\Documents\proyectos\dynadrill-platform
npm run infra:up                       # PostgreSQL, PgBouncer, RabbitMQ, Azurite, Mailpit, Jaeger
npm run db:generate                    # prisma generate de todos los módulos
npm run db:migrate:<modulo>            # aplica migraciones
npm run db:seed:<modulo>               # siembra catálogos del módulo
npx nx run-many -t lint test build --parallel=1     # verificación completa (UNA a la vez)
$env:RUN_INTEGRATION = '1'             # activa las pruebas con base de datos real
scripts\levantar-local.ps1             # levanta todo (ver también el script de reinicio)
```

Servicios en local: gateway 3100, plataforma 3101, comercial 3102, operaciones 3103, demo 3300 (arráncala con `PORT=3300`), frontend 4200 (`npm start` = `ng serve` con proxy), OCR 8090.

## 6. Lecciones aprendidas (ahórrese el tiempo)

- En Bash los *heredocs* con ciertos caracteres fallan: use la herramienta de escritura de archivos o un script de Python.
- En `supertest`, **no** use `await` dentro de los argumentos de una petición ya creada (`http().put(...).send(await f())`): calcule el cuerpo antes.
- El filtro de errores solo devuelve `message` (como `detail`) y `code`; **no** devuelve campos extra de la excepción.
- Un `ConflictException({ message, code })` es la forma de devolver un 409 con código.
- Un `Pool` de pruebas con `dyn_migrator` sirve para sembrar y limpiar; los usuarios `app_*` no pueden borrar sin un `GRANT DELETE` explícito en la migración.
- Los modelos espejo de otros schemas en `schema.prisma` exigen `schemas = ["propio", "catalogos", "identidad", ...]` en el `datasource`.
- `ng test` y `ng build` del frontend tardan; ejecútelos una vez al final del tramo.
