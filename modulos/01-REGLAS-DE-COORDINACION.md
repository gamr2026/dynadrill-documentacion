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

### 4.1 Base de pruebas separada (desde el 26/10/2026)

Las pruebas de integración (`RUN_INTEGRATION=1`) corren **solo** contra `dynadrill_test`, nunca contra `dynadrill` (la del portal). Antes compartían base: dejaban datos visibles en el portal, adelantaron la secuencia PEC- hasta 900058 y el outbox que escribían lo publicaban los servicios encendidos (Operaciones creaba tickets para pedidos de prueba).

- `npm run db:test:preparar` crea o reinicia `dynadrill_test` como copia de `dynadrill` y el vhost de RabbitMQ `dynadrill_test`. Repítalo después de aplicar migraciones nuevas en desarrollo (o aplique la migración también en la de pruebas).
- `tools/jest/base-de-pruebas.cjs` (en el `jest.preset.js`) arma las URL `TEST_*` (bases y `TEST_RABBITMQ_URL`) con las credenciales de `infra/.env` y **rechaza** cualquiera que no apunte a una base o vhost `*_test`. Motivo del vhost: la prueba de Plataforma levanta la app completa con las mismas colas que el servicio encendido, que le consumía los mensajes.
- Las pruebas se conectan directo a Postgres (5433), no por PgBouncer.
- Con `RUN_INTEGRATION` cada proyecto corre sus archivos en serie (`maxWorkers: 1` en el preset). Entre proyectos use `npx nx run-many -t test --parallel=1`: en paralelo, las pruebas de concurrencia (30 entradas de kardex, 25 emisiones de secuencia) agotan el tiempo de transacción y los tableros cuentan datos de otros archivos.

## 5. Cómo se comunican las sesiones

- **Por escrito, en este directorio.** No hay conversación directa.
- `REGISTRO-DE-CAMBIOS-COMPARTIDOS.md` (solo se agrega al final): fecha, sesión/módulo, qué cambió, en qué archivo, y qué debe saber el resto.
- **Preguntas a otro módulo**: sección "Preguntas abiertas" del `plan-<modulo>.md` del destinatario, con su nombre. Quien trabaja ese módulo las revisa al inicio de cada tramo.
- **Cambios a un contrato** (`02-CONTRATOS-ENTRE-MODULOS.md`): nunca cambie el significado de un evento ya publicado. Agregue campos (compatibles) o un evento nuevo, y regístrelo.
- **Decisiones de negocio**: `03-DECISIONES-PENDIENTES.md`; las toma el usuario.

## 6. Cambios globales (pregunte primero al usuario)

Roles nuevos, cambios en `infra/db/init`, nuevos contenedores, cambios al modelo de identidad o a `catalogos` (otra sesión puede depender), cambios de reglas de este directorio, cambios al gateway que afecten rutas existentes, y cualquier cambio que obligue a reiniciar todo.

## 7. Git y ramas (actualizado el 18/10/2026)

Los repositorios ya tienen remoto (cuenta privada `gamr2026`): `dynadrill-platform` (backend, rama integradora `desarrollo`), `dynadrill-frontend-platform` (frontend, rama `feat/integracion-backend-platform`, remoto de respaldo **`respaldo`**) y `dynadrill-documentacion`. **Nada va a `main` de la demo** (`dynadrill-backend` y `dynadrill-frontend` de `DIGITEC-IT-PROJECTS`); el `origin` de la carpeta del frontend es el de la demo: **nunca empuje allí**.

- Todas las sesiones comparten **una sola copia de trabajo**. Por eso **nadie usa** `git add -A`, `git commit` directo, `git checkout`/`switch`, `git stash`, `git reset`, `prettier --write` ni `eslint --fix` fuera de las rutas de su módulo (ya pasó: formatear `libs/operaciones` entera cambió archivos de otras sesiones).
- **Cómo se confirma:** con el script `scripts/commit-modulo.ps1` (sin cambiar de rama ni tocar el índice real). Crea el commit en la rama `modulo/<su-modulo>` solo con las rutas que usted indique, les da formato con Prettier, valida el mensaje con commitlint y, con `-Subir`, la sube. Backend: `./scripts/commit-modulo.ps1 -Modulo flota -Mensaje "feat(flota): ..." -Rutas libs/operaciones/flota -Subir`. Frontend (desde `dynadrill-frontend-platform`): agregue `-Remoto respaldo`.
- **Mensajes (commitlint):** asunto en minúscula, `tipo(modulo): descripcion`, líneas del cuerpo de 100 caracteres como máximo. El script agrega la atribución.
- **Quién fusiona:** la sesión principal fusiona `modulo/<modulo>` en `desarrollo` (lint, pruebas y compilación antes). Confirme con frecuencia (al cerrar cada tramo) para no acumular.
- Los **documentos** (`documentacion/`) los confirma la sesión principal; usted solo los escribe.

## 7.1 Puertos y procesos

Cada contenedor tiene su puerto fijo (ver el contexto). Una sesión **solo reinicia el contenedor que modificó**. Si cambia la plataforma, el gateway o un `shared/*`, avise en el registro: los demás deben reconstruir.

## 8. Al terminar un tramo (lista de verificación)

1. Migración aplicada, semilla corrida, pruebas del módulo y `lint`/`build` en verde (con el bloqueo de la regla 4).
2. Frontend: `ng test` y `ng build` en verde.
3. Contenedor reiniciado y probado a mano.
4. Plan del módulo actualizado (estado, pendientes, consultas) y entrada en el registro.
5. Mensaje final al usuario con: qué quedó, qué falta y qué decisiones necesita.

## Estándar de calidad: base de datos y backend (obligatorio, revisión del 17/10/2026)

El usuario revisa primero la base de datos. Antes de dar un tramo por terminado, verifique cada punto y déjelo anotado en su plan:

1. **Sin datos duplicados.** Un dato vive en un solo lugar y se consulta con JOIN. Si por estar en otro contenedor (D1) debe guardar una referencia, guarde solo el id; si además necesita un texto copiado (código, nombre), justifíquelo por escrito en el plan y en un COMMENT de la columna, y manténgalo actualizado por evento.
2. **Ningún id sin FK dentro del mismo servidor.** Un id polimórfico sin FK no se acepta: use una columna con FK por cada origen y un CHECK de que solo una esté llena, o una tabla puente. Los ids sin FK solo se admiten entre contenedores distintos y con COMMENT que lo diga.
3. **Catálogos de verdad.** Valores que el negocio cambia o amplía son tabla con id uuid, código único y FK; valores fijos del sistema son enum de PostgreSQL. Nada de texto libre donde hay un conjunto conocido (tallas, lugares, categorías por nombre). No decida comportamiento comparando textos de nombres en migraciones ni en código: use una columna o un código estable.
4. **Integridad en la base, no solo en el servicio.** CHECK de coherencia entre columnas, FK compuestas cuando un dato depende de dos tablas, índices únicos parciales para reglas como una vigente por clave, NOT NULL donde corresponde. Si una regla solo la valida el servicio, pregúntese si la base puede garantizarla.
5. **Historia inmutable.** Kardex, lecturas, historiales y registros firmados: sin UPDATE y sin DELETE para el rol de la aplicación (REVOKE en la migración); los errores se corrigen con un registro nuevo.
6. **Auditoría uniforme.** `created_at/created_by/updated_at/updated_by` con FK a `identidad.usuario` en toda tabla editable.
7. **Permisos mínimos.** GRANT SELECT por columnas y solo lo necesario sobre tablas de otros schemas; justifique en un comentario cada dato personal que lea (por ejemplo, cédula).
8. **Una migración por cambio, reversible por otra migración, sin editar migraciones ya aplicadas.** Los datos sembrados van en la semilla (idempotente), no en la migración, salvo catálogos mínimos del sistema.
9. **Backend limpio.** Servicios pequeños con una responsabilidad, DTO validados con class-validator, errores con mensajes claros en español neutro con "usted", transacciones para todo lo que cambia varias tablas, eventos publicados por el outbox dentro de esa misma transacción, consumidores idempotentes, sin `any`, sin copiar y pegar entre módulos, comentarios que explican el porqué.
10. **Pruebas de integración con base real** que ejerciten también las reglas de la base (CHECK, FK, REVOKE): una prueba que intente violarlas y espere el rechazo.
11. **Pule lo ya entregado.** Antes de avanzar a un tramo nuevo, revise lo que ya construyó contra esta lista y corrija con una migración nueva. Los hallazgos concretos de su módulo están en la sección siguiente.

## 9. Lecciones técnicas y reglas nuevas (18/10/2026)

Salieron de construir Inventario, Mantenimiento y Pumping. Léalas antes de escribir código.

1. **No hay transacciones compartidas entre módulos.** Cada módulo tiene su propio cliente de base de datos: no pase su `tx` a otro módulo. El dueño de los datos ofrece métodos con **transacción propia e idempotentes** (llave por renglón); el que llama los usa dentro de su transacción, **después de sus escrituras y antes de publicar el evento**, y compensa si algo falla después (el kardex no se borra: se devuelve). Ejemplos: contrato 4.1 (químicos) y 4.1-bis (repuestos).
2. **Eventos.** El nombre empieza con el contenedor que lo produce (`operaciones.`, `comercial.`, `qhse.`, `plataforma.`). La cola de un consumidor es `<consumidor>.<origen>[.<grupo>]`: si su contenedor ya tiene otro consumidor del mismo origen, ponga un `group` distinto (si no, se reparten los mensajes y se pierden). Consuma con `handleOnce` (inbox); los errores de negocio se registran y se omiten, los demás se relanzan para que se reintente. **Tras crear un consumidor hay que reiniciar el contenedor** (las colas se crean al arrancar) y, en las pruebas, apagar `onApplicationBootstrap` (sin RabbitMQ).
3. **Entre contenedores no hay FK**: guarde solo el id, con `COMMENT` que lo diga; cualquier texto copiado se justifica por escrito. Dentro del mismo contenedor, FK real.
4. **No abra permisos de un módulo ajeno** para que el suyo funcione: pida (o cree) un endpoint estrecho, con el permiso del que lo necesita (ejemplos: `GET inventario/articulos/quimicos`, `GET comercial/pedidos/:id/items-para-cambio`).
5. **Frontend: patrón de adaptación** (ver Mantenimiento y `operations/pumping/tickets-nuevos`): un servicio contra el backend nuevo, un traductor puro (códigos estables ↔ textos de la pantalla) con su prueba, ids UUID (string), errores con `mensajeDeError` (`shared/utils/mensaje-error.util.ts`) y las pantallas nuevas en su carpeta; las viejas (contra la demo) no se tocan hasta el Corte. Un cambio de ids de número a texto obliga a revisar rutas, selects y `localStorage`.
6. **Pruebas de integración:** nombres únicos por corrida, limpiar lo que crean (incluidas `outbox`, `inbox`, archivos y maestros), no depender de tablas vacías. Dos suites a la vez en la misma base pueden fallar por ruido: repita la que falló sola. Las pruebas de Inventario con servicios levantados dejan elementos `EPP<número>` en `qhse.epi_elemento` (ver el README de sus datos).
7. **Datos reales ya cargados** en la base de desarrollo (catálogos, inventario con stock, empleados): no los borre ni corra `infra:reset`; los `db:seed:*` y `db:cargar:*` son idempotentes.
8. **Windows:** en `bash`, los `heredoc` con comillas o apóstrofes se rompen: escriba los archivos con la herramienta de escritura y use scripts de Node en la carpeta temporal. Los archivos tienen CRLF: conserve el fin de línea al reemplazar texto. En PowerShell 5.1 los `.ps1` con acentos deben ir con BOM.
9. **Servicios locales:** después de `nx build <app>`, reinicie solo su contenedor (`Start-Process node dist/apps/<app>/main.js`). Si Docker detiene contenedores por memoria: `docker start dynadrill-rabbitmq-1 dynadrill-mailpit-1 dynadrill-azurite-1 dynadrill-jaeger-1`.
10. **Antes de empezar** lea `ESTADO-SESION-PRINCIPAL.md` (las secciones de lo que su módulo consume), `REGISTRO-DE-CAMBIOS-COMPARTIDOS.md` (lo último) y el plan del módulo con su sección «Encargo». **Al terminar** actualice el plan, anote en el registro y dé el resumen al usuario.
