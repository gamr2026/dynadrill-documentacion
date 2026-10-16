# Análisis: `dynadrill-backend` ("backend tonto") con SQLite + Prisma

> Estado: **Fases 0-8 completas** — el plan original de este documento está 100% ejecutado. Los 8
> dominios están persistidos con lógica de negocio real (no solo CRUD) y el frontend Angular ya
> habla con este backend de punta a punta, sin ningún `*-mock.interceptor.ts` activo. Repo
> `dynadrill-backend`, sibling de `dynadrill/` — ver su `README.md` para setup y estructura
> completa. Este documento sigue siendo la referencia de diseño (por qué SQLite, estrategia de
> modelado, plan de fases); §8 detalla qué se hizo en cada una.
>
> **Actualización de alcance:** el objetivo es un **compilado autocontenido** de la aplicación
> (algo que se corre localmente, sin depender de infraestructura provisionada), no un servicio
> hosteado 24/7. Por eso la base de datos elegida es **SQLite embebido** en vez de un Postgres
> provisionado — ver §2 y §7.2 para el detalle de la decisión. El resto del análisis (estrategia
> híbrida de modelado, dominios, fases) no cambia: en Prisma, SQLite vs. Postgres es
> prácticamente solo la línea `datasource`, no un rediseño del schema.
>
> **Actualización de estructura:** el backend se organizó como monorepo Nest (`apps/` + `libs/`)
> desde el arranque — no un único proyecto plano — para que quede genuinamente preparado para
> microservicios: cada dominio es una lib independiente importada hoy por el único proceso HTTP
> (`apps/api-gateway`), y el día que alguno necesite ser su propio servicio desplegable se saca a
> su propio `apps/<dominio>-service` sin mover código, solo agregando transporte de
> `@nestjs/microservices`. Detalle completo en el `README.md` del repo.

## 1. Qué es (y qué no es) un "backend tonto"

Hoy `dynadrill-frontend` no tiene backend: cada dominio tiene un `HttpInterceptorFn` en
`src/app/core/mocks/*.interceptor.ts` que intercepta las llamadas a `/api/...` y responde desde
arrays `let` en memoria (se resetean en cada refresh del navegador). Son 8 interceptors, ~5,060
líneas en total, registrados solo en `isDevMode()` (`app.config.ts`).

Un "backend tonto" es un servicio real (Node + Postgres) cuyo único trabajo es **reemplazar esos
arrays en memoria por filas en una base de datos**, exponiendo exactamente los mismos endpoints
`/api/...` con las mismas formas de request/response que ya consume el frontend. No es:

- El backend "real" de Dynadrill (el que mencionan los comentarios del código, ej.
  `auth-mock.interceptor.ts`: *"cuando el backend NestJS de auth exista de verdad"*).
- Un rediseño de la API — la superficie de endpoints ya está definida por lo que el frontend
  llama hoy; el backend tonto la replica, no la redefine.
- Un sistema con reglas de negocio nuevas, permisos finos, auditoría, notificaciones, etc. —
  eso es el backend real. Este solo persiste lo que el mock ya hace.

**Por qué vale la pena igual:** hoy el flujo "crear Pedido → se refleja en FCR → FCR aprueba
reportes → vuelve a Facturación" (recién construido) funciona porque los interceptors comparten
memoria del mismo bundle JS (`crearTicketFcrParaPedido` llamado directo entre módulos). Eso se
pierde en cada refresh y no sobrevive a dos pestañas distintas. Con una base de datos real, ese
puente deja de ser un truco de memoria compartida y pasa a ser una relación de FK persistente —
el flujo que ya se armó se vuelve genuinamente demostrable de extremo a extremo, entre sesiones y
usuarios distintos.

## 2. Stack recomendado

| Pieza | Elección | Por qué |
|---|---|---|
| Runtime/Framework | **NestJS** (no Express plano) | El propio código ya nombra "backend NestJS" como destino final. Construir el backend tonto directo en Nest evita reescribirlo cuando se le agregue lógica real — solo se le van añadiendo guards/servicios sobre la misma estructura de módulos. |
| ORM | **Prisma** | Pedido explícito del usuario. Además: migraciones versionadas, tipos TS generados desde el schema (se pueden compartir/replicar contra los `model.ts` del frontend), buen soporte de columnas `Json` para las partes no relacionales (ver §4). |
| Base de datos | **SQLite** (archivo único, embebido) | El objetivo es un compilado autocontenido, no un servicio hosteado — un `.db` que viaja junto al backend compilado no depende de red ni de una instancia provisionada. Ver §7.2 para el detalle completo de la decisión frente a Postgres. |
| Auth | JWT real + `bcrypt`, casi gratis de agregar ahora | El mock hoy no valida password (cualquier password entra). Con Prisma + `@nestjs/jwt` + `bcrypt` el costo extra es mínimo comparado con hacerlo "tonto" primero y rehacerlo después. Recomendado subirlo de una vez (ver §7). |
| Entorno local | Ninguna infraestructura adicional | Sin Docker ni servicio de base de datos que levantar — el `.db` de SQLite se crea solo al correr las migraciones de Prisma la primera vez. |

**Repo:** nuevo proyecto hermano `dynadrill-backend/` (ya aparece sin trackear en el status de
`proyectos/`, junto a `dynadrill/` y `vault-dynadrill/`) — repo Git propio, igual que
`dynadrill-frontend`.

## 3. Estructura de módulos (1:1 con los interceptors actuales)

Un módulo Nest por cada mock interceptor existente, mismo nombre de dominio:

```
dynadrill-backend/
  prisma/
    schema.prisma
    migrations/
  src/
    auth/            ← auth-mock.interceptor.ts      (login)
    users/           ← users-mock.interceptor.ts      (Users, Roles)
    facturacion/      ← facturacion-pedidos-mock.interceptor.ts
    operations/
      fcr/            ← fcr-mock.interceptor.ts
      pumping/        ← pumping-mock.interceptor.ts
    maintenance/      ← maintenance-mock.interceptor.ts
    qhse/             ← qhse-mock.interceptor.ts
    inventario/       ← inventario-mock.interceptor.ts
    prisma/           ← PrismaService (cliente inyectable, providedIn root)
    common/           ← filtros de excepción, interceptor de respuesta, etc.
```

Cada módulo Nest expone controllers cuyas rutas son **literalmente** las que ya están
hardcodeadas en el frontend (`/api/facturacion/pedidos`, `/api/operations/fcr/tickets`, etc.) —
así el cambio del lado Angular se reduce a apagar el interceptor mock, no a tocar servicios.

## 4. Inventario de dominios a modelar

| Dominio | Mock actual | Recursos `/api/...` | Complejidad de datos |
|---|---|---|---|
| Auth | 31 líneas | `auth/login` | Trivial — delega en Users |
| Users/Roles | 333 líneas | `users`, `roles` | Baja — 2 tablas, 1 FK |
| Inventario | 139 líneas | `articulos`, `movimientos-inventario` | Baja — 2 tablas, 1 FK |
| Facturación | 904 líneas | `facturacion/pedidos` (+`sync-as2`), `listas-precios`, `documentos-operativos`, `prefacturas`, `guias-remision` (bajo `pedidos/:id`), `aots` | Alta — 6 entidades encadenadas (Pedido → DocumentoOperativo → Prefactura → GuiaRemisión/AOT), varias con arrays anidados (`historialEstados`, `usoHerramientas`) |
| Operaciones · FCR | 617 líneas | `operations/fcr/tickets` | Alta — 1 entidad raíz con `activityLog`, `toolUsageLog`, `phaseHistory`, `observations` (arrays de sub-objetos, forma variable por fase) |
| Operaciones · Pumping | 362 líneas | `operations/pumping/tickets` | Media — similar a FCR pero más chico |
| Mantenimiento | 1,190 líneas | `unidades`, `maintenance-orders`, `maintenance-suborders`, `unit-reports`, `vehicle-inspections`, `historial-mantenimiento`, `conductores-permisos` | Alta — 7 recursos relacionados entre sí (orden → sub-órdenes → reportes/inspecciones) |
| QHSE | 1,490 líneas | `qhse/{iperc,ptw,stop,swa,derrames,desechos,emergencias,epi,inspecciones,investigaciones}`, `qhse/dashboard-metas` | **La más grande.** 10 sub-dominios independientes entre sí, cada uno con checklists, firmas, timelines, matrices (IPERC/PTW) — estructuras muy anidadas y bastante variables entre sí |

**Total:** ~26 recursos, ~35–40 entidades TS si se cuentan los modelos anidados con identidad
propia (ítems de checklist, entradas de timeline, etc.).

## 5. Estrategia de modelado: relacional puro vs. JSON — híbrida, por diseño

Modelar **cada** sub-estructura anidada (ej. `IpercHazard.controles[]`, `EmergenciaEvento.timeline[]`,
`FcrTicket.activityLog[]`) como su propia tabla con FK es el camino "correcto" a largo plazo, pero
para un backend tonto es sobre-ingeniería: multiplica por 3-4x las tablas y migraciones sin que
nada hoy necesite consultar esos sub-objetos de forma relacional (el módulo de Reportería, por
ejemplo, ya agrega todo del lado del cliente a partir del payload completo).

**Regla propuesta:**

- **Raíz de agregado → tabla real**, con sus campos escalares como columnas y sus relaciones
  *hacia otras raíces* (ej. `Pedido.clienteId`, `FcrTicket.pedidoCode`, `MaintenanceSuborder.orderId`)
  como FKs de verdad.
- **Sub-estructuras anidadas que solo se leen/escriben completas junto con su raíz** (checklists,
  logs, firmas, matrices IPERC/PTW, `historialEstados`, `activityLog`, `toolUsageLog`) → una
  columna `payload` de texto con el JSON serializado a mano (`JSON.stringify`/`JSON.parse` en el
  service, no algo que Prisma haga solo). **Corrección tras implementar Fase 0:** el conector de
  SQLite de Prisma directamente **no soporta** el tipo `Json` ("the current connector does not
  support the Json type") — no es una opción disponible ahí, a diferencia de Postgres. Por eso el
  schema real usa `String` para estas columnas. Se pierde la posibilidad de filtrar *dentro* del
  JSON desde SQL, pero eso nunca fue el plan: todo el cruce/reporting ya lo hace el frontend sobre
  el payload completo, así que no es una pérdida real hoy. Si algún día esto migra a Postgres, el
  mismo campo pasa a `Json`/`jsonb` de verdad — ahí sí Prisma serializa solo y el motor puede
  indexar/filtrar dentro del JSON.
- Si en el futuro un sub-objeto necesita filtrarse/reportarse desde SQL de forma pesada, se
  "gradúa" de JSON a tabla propia — migración incremental, no una decisión de todo o nada hoy.

**Estado real (Fase 0 ya implementada):** el schema completo, ya validado y migrado, vive en
`dynadrill-backend/prisma/schema.prisma` — no se repite acá para no mantener dos copias que
puedan divergir. Dos ajustes que salieron al implementarlo, frente al ejemplo original de este
análisis: el FK entre `Pedido` y `FcrTicket`/`PumpingTicket` terminó siendo `pedidoId` (entero,
hacia `Pedido.id`) en vez de `pedidoCode` — más simple de indexar y de tipar en Prisma — y cada
`payload` es `String` (JSON serializado a mano), no `Json`, por la limitación de SQLite explicada
arriba. Ese FK `pedidoId` único es exactamente el puente que hoy es una llamada de función entre
dos interceptors — con esto se vuelve una relación de base de datos consultable con un `include`
de Prisma, y sobrevive a refrescos/sesiones distintas.

## 6. Superficie de API a replicar

El patrón de rutas ya es consistente en casi todo el frontend:

- `GET/POST /api/<recurso>` — listar / crear
- `GET/PUT/DELETE /api/<recurso>/:id` — detalle / actualizar / borrar
- `POST /api/<recurso>/:id/<accion>` — transiciones de estado o sub-recursos (ej.
  `pedidos/:id/prefactura`, `pedidos/:id/guia-remision`, probablemente equivalentes en FCR para
  cambios de fase y en Mantenimiento para acciones sobre sub-órdenes)

Replicar esto es mecánico una vez que el schema de cada dominio está definido — cada fase del
plan (§8) incluye "levantar el controller cuyas rutas ya están fijadas por el interceptor
correspondiente" como paso explícito, dominio por dominio, en vez de intentar enumerar aquí las
~26 rutas una por una (se listan al detalle al abrir cada fase, contra el interceptor real, para
no transcribir mal una firma).

## 7. Decisiones a tomar antes de empezar (no técnicas, de alcance)

1. **Auth:** ¿seguimos "tonto" (login sin verificar password, token fijo, como hoy) o subimos
   `bcrypt` + JWT real ya en esta primera etapa? Recomendado: hacerlo real ahora — el costo
   marginal es bajo y elimina el elemento más obviamente falso del sistema.
2. **SQLite vs. Postgres — resuelto en favor de SQLite** (ver nota de alcance al inicio del
   documento): el objetivo es un compilado autocontenido, no un servicio hosteado. Con SQLite el
   `DATABASE_URL` es simplemente `file:./dynadrill.db` — ningún servicio que levantar, ningún
   contenedor, ninguna credencial que gestionar. Si en algún momento esto pasa a ser un backend
   compartido por varios usuarios simultáneos (no solo "un compilado que alguien corre en su
   máquina"), ahí conviene reabrir esta decisión y migrar a Postgres provisionado — el cambio en
   Prisma es acotado (cambiar `provider` en el `datasource`, regenerar migraciones) porque el
   schema ya está pensado para ser agnóstico del motor (ver §5).
3. **Archivos/soportes:** Facturación y QHSE manejan "documentos de respaldo"/adjuntos. El mock
   no persiste archivos reales. El backend tonto necesita decidir: ¿disco local con volumen
   (simple, sirve para desarrollo) o ya usar almacenamiento tipo S3-compatible? Se puede diferir
   guardando solo metadata (nombre, tipo) sin el binario en una primera vuelta, si se prefiere.
4. **Conexión Angular → backend:** hoy no existe `environment.ts` ni `proxy.conf.json` en
   `dynadrill-frontend` — las llamadas van a rutas relativas `/api/...` que el mock intercepta
   *antes* de salir del navegador. Para hablar con un backend real hace falta agregar uno de los
   dos: un `proxy.conf.json` de `ng serve` (más simple, cero cambios de código) o
   `environment.ts`/`environment.prod.ts` con `apiUrl` + un interceptor que anteponga el host.
   Recomendado: `proxy.conf.json` para desarrollo local — no obliga a decidir todavía el dominio
   de producción.
5. **IDs:** los mocks usan enteros autoincrementales en memoria y todos los `model.ts` del
   frontend tipan `id: number`. Prisma con `@id @default(autoincrement())` replica esto exacto
   — cero cambios de tipos en el frontend. (Alternativa `cuid()`/`uuid()` descartada a propósito:
   forzaría cambiar `id: number` a `id: string` en ~35 modelos del frontend sin necesidad real.)

## 8. Plan de fases propuesto

Orden pensado para desbloquear valor rápido y de menor a mayor riesgo/tamaño:

- **✅ Fase 0 — Scaffolding (hecho).** Monorepo Nest (`apps/api-gateway` + `libs/{prisma,common,domains/*}`),
  Prisma con `provider = "sqlite"`, `PrismaService` global, filtro de excepciones, schema completo
  de las ~30 tablas de todos los dominios (con sus relaciones ya fijadas), migración inicial
  aplicada, `GET /api/health` respondiendo. Sin Docker ni servicios externos.
- **✅ Fase 1 — Auth + Users + Roles (hecho).** `POST /api/auth/login` con JWT + bcrypt real (no
  "tonto" como el mock — password sí se valida, 401 ante credenciales inválidas en vez de
  `{ user: null }`; el frontend ya tenía manejo de error en `login-page.ts` para este caso, así
  que no hizo falta tocarlo). CRUD completo de `/api/users` y `GET /api/roles`. Sembrado con los
  mismos 14 roles y 17 usuarios de prueba que hoy usa `users-mock.interceptor.ts` (misma
  contraseña para todos en desarrollo — ver `SEED_USERS_PASSWORD` en `.env.example`). Verificado
  con build limpio + servidor levantado + smoke test real (login, CRUD, 401, 400 de validación).
- **✅ Fase 2 — Facturación (hecho).** Los 6 recursos (`Pedido`, `ListaPrecios` con items
  anidados de verdad vía Prisma, `DocumentoOperativo`, `Prefactura`, `GuiaRemision`, `Aot`) con
  CRUD completo. `Pedido` es la única raíz con dos columnas de texto-JSON (`payload` +
  `historialEstados`), manejadas por la base genérica igual que el resto.
- **✅ Fase 3 — Operaciones — FCR + Pumping (hecho).** `pedidoId` es FK real y `@unique` en ambas
  tablas — verificado en vivo: crear un segundo ticket FCR para un pedido que ya tiene uno da 409,
  no lo permite silenciosamente. Este es exactamente el puente que en el frontend hoy es una
  llamada de función entre interceptors compartiendo memoria (§5) — acá ya es una constraint de
  base de datos de verdad.
- **✅ Fase 4 — Mantenimiento (hecho).** Los 7 recursos con su jerarquía real (`Unidad` →
  `UnitReport`/`VehicleInspection`/`HistorialMantenimiento`, `UnitReport` → `MaintenanceOrder` →
  `SubOrder`). `ConductorPermisos` quedó con CRUD completo aunque el mock solo tenía `GET` — el
  objetivo acá es persistencia real, no solo replicar lo que el mock alcanzó a cubrir.
- **✅ Fase 5 — Inventario (hecho).** `Articulo` + `MovimientoInventario`.
- **✅ Fase 6 — QHSE (hecho).** Los 10 sub-módulos + `DashboardMetas` (única fila de
  configuración, no una colección — su servicio no hereda de la base CRUD genérica a propósito).

  **Cómo se construyeron las fases 2-6 sin escribir el mismo CRUD 24 veces:** una clase base
  `PrismaCrudService` en `libs/common` (findAll/findOne/create/update/remove genéricos +
  serialización automática de las columnas `payload`/`historialEstados` de texto-JSON) — cada
  resource solo declara su `delegate` de Prisma y una etiqueta de 404. Los 2-3 resources con
  lógica propia real (`ListaPrecios` con sus items anidados, `Pedido` con dos columnas JSON en
  vez de una) la sobreescriben explícitamente. Verificado con: build limpio, `tsc --noEmit`
  limpio, servidor levantado y probado en vivo — creación con relaciones FK reales, filtros por
  query param, 409 en violación de `@unique`, 400 en FK inválida, 404 en registro inexistente
  (estos tres traducidos desde los códigos de error de Prisma en el filtro global, no dejados
  como 500 genérico).
- **✅ Fase 7-8 — Corte del frontend + retiro de mocks (hecho, los 8 dominios).**
  `dynadrill-frontend` agregó `proxy.conf.json` (`ng serve --proxy-config` -> `localhost:3000`,
  ya integrado en `npm start`) y ya no registra **ningún** `*-mock.interceptor.ts` — los 8
  archivos se borraron. Se hizo dominio por dominio, en orden de tamaño (Auth/Users/Roles →
  Inventario → Facturación → Operaciones → Mantenimiento → QHSE), verificando cada uno con
  build limpio + los dos procesos corriendo + curl contra `localhost:4200/api/...` (el camino
  real que sigue el navegador vía proxy) antes de pasar al siguiente. `authInterceptor` (el que
  agrega el header `Authorization`) no se tocó — ya era código real.

  **Lo que obligó a ir más allá de CRUD llano en fases 2-6 (se descubrió recién acá, al migrar
  los datos de demo de cada mock):**
  - *Inventario:* `stockActual` se calcula en runtime desde los movimientos (nunca se guarda), y
    una salida que dejaría el stock en negativo se rechaza con 400 — ambos puertos exactos del
    mock.
  - *Facturación:* máquina de estados completa (`cambiarEstado`), `calcularAvance` documental,
    `construirPrefactura` (cruza Reporte de Herramientas × Lista de Precios), guía de remisión
    como prerequisito, generación de AOT desde una prefactura firmada, sync-as2 bidireccional —
    todo en `FacturacionDomainService`, ~15 rutas de acción sobre `/pedidos/:id/...` que no
    existían en el CRUD genérico original.
  - *Operaciones:* ~26 acciones de negocio de FCR (fases, herramientas, bitácora, revisión de
    reportes, cierre) y Pumping (recursos/químicos), reutilizando el aplanado de `payload` de la
    base genérica — y el puente Pedido↔FCR pasó de ser una llamada de función compartiendo
    memoria (mock) a una FK `pedidoId` única de verdad, con conflicto 409 si se intenta duplicar.
  - *Mantenimiento:* cascada de registro de PM (un servicio Tipo B resetea también el contador
    Tipo A), clasificación de una Orden en Sub-órdenes, ciclo de vida completo de una Sub-orden
    (ejecución → revisión → cierre/corrección), y el puente Pumping→Mantenimiento
    (`registrarLlegadaPumping`) que había quedado pendiente en la Fase 3 hasta que este dominio
    existió — verificado en vivo: guardar la llegada de un ticket Pumping crea de verdad un
    `UnitReport` en Mantenimiento.
  - *QHSE:* resultó ser el más simple en lógica pese a ser el más grande en volumen — casi todo
    es GET/POST/PATCH genérico con un código secuencial por prefijo (`DYN-SGI-RE-087-...`,
    `SWA-2026-...`, etc.). Los 4 puntos de integración real: aprobar una Matriz IPERC, bloquear
    la apertura de un PTW sin IPERC aprobada (400), generar un Desecho desde un Derrame contenido
    (enlazado de vuelta), y retroalimentar la Matriz IPERC al cerrar una Investigación con
    lección aprendida.
  - Dos bugs de datos preexistentes en los mocks (no introducidos acá, replicados tal cual):
    Pedido 3 tiene 3 días de Reporte Job sembrados pero 4 esperados según sus fechas
    (`completo: false` aunque su `estado` diga "documentos_completos"), y el `UnitReport` #3130
    referencia `unidadId: 5` (GEN-02) pero su campo `unidad` dice 'PUM-03' — inconsistencia del
    propio seed del mock, no algo que se haya corregido unilateralmente.

## 9. Qué este backend tonto explícitamente NO hace

Para que quede claro el alcance y no se asuma más de lo que es:

- No implementa reglas de negocio nuevas más allá de lo que el mock ya valida (que es casi nada).
- No reemplaza la integración AS2 real (sigue siendo mock, tal como se decidió para el módulo de
  Facturación).
- No trae auditoría, versionado de documentos, ni notificaciones — eso es del backend real.
- No decide permisos finos por rol a nivel de API (el guard de rol sigue siendo del lado
  Angular, `roleGuard`, como hoy).

---

**Estado actual: Fases 0-6 completas** — las 8 tablas de dominio están todas persistidas con CRUD
real (60 endpoints en total, ver Swagger en `/docs`). Lo único que falta del plan original es lo
que nunca fue trabajo de backend: **Fase 7** (cortar el frontend dominio por dominio — agregar
`proxy.conf.json`, apagar cada `*-mock.interceptor.ts`) y **Fase 8** (borrar los mocks migrados).
Ninguna de las dos se hizo todavía porque el frontend sigue 100% en mocks — es una decisión
explícita, no un pendiente técnico.
