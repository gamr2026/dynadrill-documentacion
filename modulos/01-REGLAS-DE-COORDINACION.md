# Reglas de coordinación entre sesiones

Varias sesiones trabajan a la vez **en la misma máquina, en el mismo repositorio, contra la misma base de datos de desarrollo**. Estas reglas evitan que una rompa a otra.

## 1. Dueño de cada cosa

| Cosa | Dueño | Los demás |
|---|---|---|
| `libs/<contenedor>/<modulo>/**` | la sesión de ese módulo | no lo editan; lo consumen por su `index.ts` o por contrato |
| Schema de base de datos de un módulo y sus migraciones | la sesión de ese módulo | solo lectura |
| `docs`: `documentacion/modulos/plan-<modulo>.md` | la sesión de ese módulo | lo leen |
| `documentacion/<area>/CONSULTAS-PARA-DYNADRILL.md` | todos, cada uno en su propia sección (`## <módulo>`) | no editan secciones ajenas |
| Frontend del módulo (`src/app/features/<area>/...`) | la sesión de ese módulo | no lo editan |

## 2. Archivos compartidos (puntos de choque) y cómo tocarlos

Son pocos. Toque **solo** su parte, con ediciones pequeñas (reemplazo de un fragmento, no reescritura del archivo) y relea el archivo justo antes de editarlo.

| Archivo | Qué se agrega | Regla |
|---|---|---|
| `libs/shared/authz/src/lib/permissions.ts` y `module-roles.ts` | los permisos y matrices de **su** módulo, en un bloque comentado con el nombre del módulo | no cambie permisos de otros; después corra `npm run db:seed:identidad`; si hay una prueba que cuenta permisos (`identidad.integration.spec.ts`), súbale el número y regístrelo |
| `libs/shared/authz/src/lib/role-code.ts` | roles nuevos (solo si el negocio los pide) | **cambio global**: pregunte antes (ver `03-DECISIONES-PENDIENTES.md`) |
| `apps/gateway/src/app/routes.ts` y `routes.spec.ts` | los prefijos de su módulo | una línea por prefijo; agregue su caso en el `spec` |
| `apps/operaciones/src/app/app.module.ts` (y `apps/qhse`, `apps/worker`) | importar su módulo | una línea de `import` y una en `imports: []` |
| `tsconfig.base.json` | el alias `@dyn/<modulo>` de su librería | una línea |
| `package.json` | scripts `db:migrate:<modulo>` y `db:seed:<modulo>` | dos líneas, junto a los de su módulo |
| `libs/plataforma/avisos/src/catalog/plantillas/<modulo>.ts` | las plantillas y reglas de aviso **de su módulo** | un archivo por módulo; el índice (`plantillas/index.ts`) tiene una línea por módulo. Evento nuevo → agréguelo a `consumers/eventos-con-aviso.consumer.ts` (una línea) |
| `scripts/levantar-local.ps1` y `reiniciar` | el arranque de un contenedor nuevo | solo si crea un contenedor |
| `infra/db/init/*.sql` y `infra/docker-compose.yml` | cambios de schemas, usuarios o servicios | **cambio global**: regla 6 |
| Frontend: `app.routes.ts`, `navigation.service.ts`, `environment*.ts` | la ruta y el menú de su módulo | una entrada |
| `documentacion/modulos/REGISTRO-DE-CAMBIOS-COMPARTIDOS.md` | una entrada por cambio en un archivo compartido o en un contrato | obligatorio |

## 3. Migraciones y orden entre módulos

- Las migraciones viven dentro de cada módulo (no hay choque de nombres). Use la fecha real: `AAAAMMDDHHMMSS_<descripcion>`.
- **Dependencias de migración**: si su módulo tiene una FK a otro módulo del mismo contenedor, el otro debe estar aplicado primero. Orden: `flota` → `mantenimiento`; `inventario` antes de lo que lo referencia; `pumping`/`fcr` después de `flota`. Si necesita algo que aún no existe, pídalo en el registro y avance con lo demás.
- Una migración **aplicada** no se edita: se agrega otra.
- **No** correr `npm run infra:reset` ni borrar la base sin avisar (afecta a las demás sesiones y al usuario).
- Las pruebas de integración crean y borran filas reales en la base compartida: use nombres únicos por corrida y no dependa de que una tabla esté vacía.

## 4. Verificación: una a la vez

La máquina tiene poca memoria. Antes de correr `npx nx run-many ...`, un build del frontend o `ng test`:

1. Revise `documentacion/modulos/.bloqueos/`. Si hay un archivo `nx.lock`, otra sesión está verificando: espere o trabaje en otra cosa.
2. Cree `documentacion/modulos/.bloqueos/nx.lock` con su sesión y la hora. Al terminar, bórrelo.
3. Para una sola librería puede usar `npx jest` dentro de su carpeta (es liviano) sin bloqueo.

El mismo bloqueo (`db.lock`) aplica a: reiniciar servicios de otros, aplicar `infra:reset`, o correr los *seeds* de identidad.

## 5. Cómo se comunican las sesiones

- **Por escrito, en este directorio.** No hay conversación directa.
- `REGISTRO-DE-CAMBIOS-COMPARTIDOS.md` (solo se agrega al final): fecha, sesión/módulo, qué cambió, en qué archivo, y qué debe saber el resto.
- **Preguntas a otro módulo**: sección "Preguntas abiertas" del `plan-<modulo>.md` del destinatario, con su nombre. Quien trabaja ese módulo las revisa al inicio de cada tramo.
- **Cambios a un contrato** (`02-CONTRATOS-ENTRE-MODULOS.md`): nunca cambie el significado de un evento ya publicado. Agregue campos (compatibles) o un evento nuevo, y regístrelo.
- **Decisiones de negocio**: `03-DECISIONES-PENDIENTES.md`; las toma el usuario.

## 6. Cambios globales (pregunte primero al usuario)

Roles nuevos, cambios en `infra/db/init`, nuevos contenedores, cambios al modelo de identidad o a `catalogos` (otra sesión puede depender), cambios de reglas de este directorio, cambios al gateway que afecten rutas existentes, y cualquier cambio que obligue a reiniciar todo.

## 7. Git y ramas

Hoy el repositorio `dynadrill-platform` no tiene remoto y tiene muchos archivos sin confirmar. Mientras el usuario no decida lo contrario:

- Todas las sesiones trabajan en la misma copia; por eso la disciplina de la regla 1 y 2.
- **Nadie confirma (`commit`) ni sube** sin que el usuario lo pida.
- Recomendación para cuando el usuario lo autorice: confirmar la base actual, y que cada sesión trabaje en su propia rama/*worktree* (`git worktree add ..\dynadrill-platform-<modulo> -b modulo/<modulo>`). Así se evita pisar archivos y se integra al final.

## 7.1 Puertos y procesos

Cada contenedor tiene su puerto fijo (ver el contexto). Una sesión **solo reinicia el contenedor que modificó**. Si cambia la plataforma, el gateway o un `shared/*`, avise en el registro: los demás deben reconstruir.

## 8. Al terminar un tramo (lista de verificación)

1. Migración aplicada, semilla corrida, pruebas del módulo y `lint`/`build` en verde (con el bloqueo de la regla 4).
2. Frontend: `ng test` y `ng build` en verde.
3. Contenedor reiniciado y probado a mano.
4. Plan del módulo actualizado (estado, pendientes, consultas) y entrada en el registro.
5. Mensaje final al usuario con: qué quedó, qué falta y qué decisiones necesita.
