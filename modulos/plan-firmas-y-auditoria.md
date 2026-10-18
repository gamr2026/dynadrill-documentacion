# Plan: Firmas y Auditoría (plataforma)

**Schemas:** `firmas`, `auditoria` · **Contenedor:** plataforma (3101) · **Librerías:** `libs/plataforma/firmas` y `libs/plataforma/auditoria` · **Prefijos:** `/api/firmas`, `/api/auditoria` (agréguelos a la lista de la plataforma en el gateway)
**Estado:** por construir (los schemas existen y están vacíos) · **Ola:** 2 (puede empezar antes: no depende de nadie)
**Lea antes:** `00`, `01`, `02` (4.9), `03` (D6).

## 1. Objetivo

- **Auditoría**: rastro **inmutable** de los hechos de negocio y **línea de tiempo** de cada entidad (pedido, ticket, orden...), alimentado por los eventos que todos los módulos ya publican.
- **Firmas**: guardar **firmas como evidencia**, con el hash del documento firmado, para los formatos que la demo firma "con una línea" (usuario + hora): QHSE (IPERC, PTW, STOP, SWA, desechos), conformidades de Pumping/FCR, etc. La validación de PDF firmados electrónicamente (FirmaEC) y de firma manuscrita **ya existe** en `archivos`/`firmas-ocr`: esto es el **registro de evidencia**, no el validador.

## 2. Qué hay hoy

- Auditoría ligera dispersa: `comercial.proceso_historial` (cambios de estado de pedido y otros procesos) y `pumping.ticket_historial`; cada módulo guarda su historial. No hay un registro central.
- Firmas: validación de firma electrónica (`pyHanko`) y lectura de firma manuscrita (OpenCV + Tesseract) en `apps/firmas-ocr` y el módulo `archivos`; tablas `guia_firma_digital` y `prefactura_firma` en comercial para sus propios documentos.
- Privilegios ya definidos: `app_plataforma` tiene `SELECT, INSERT` (sin UPDATE ni DELETE) sobre `auditoria`.

## 3. Auditoría — diseño propuesto

- `evento_auditado` (`id` = id del evento, `tipo`, `version`, `ocurrido_at`, `contenedor`, `sujeto_tipo`, `sujeto_id`, `actor_id` FK a `identidad.usuario` (nulo si es del sistema), `correlacion_id`, `causa_id`): **sin** el cuerpo en JSON; las pocas columnas de negocio que se quieran consultar (código del pedido, número de ticket) como columnas tipadas en una tabla hija `evento_auditado_dato` (`evento_id`, `clave` (catálogo), `valor`) o, si la lista de claves es chica, columnas fijas. Inmutable (sin UPDATE/DELETE, defensa en la base).
- **Consumidor** suscrito a **todos** los eventos (`#`) de todos los contenedores (`handleOnce`).
- **Línea de tiempo**: `GET /api/auditoria/linea-de-tiempo?sujetoTipo=&sujetoId=` y búsqueda por actor, tipo y fechas. Pantalla de consulta (Superadmin y auditoría).
- Retención y volumen: particionar por mes si crece.

## 4. Firmas — diseño propuesto

- `firma` (`id`, `documento_tipo` (enum o catálogo), `documento_id` (uuid, sin FK si es de otro contenedor, D1), `rol_firmante` (catálogo: trabajador, talento humano, supervisor, coordinador HSE...), `firmante_id` FK usuario, `firmada_at` (hora del servidor), `hash_documento` (SHA-256 del documento o del texto firmado), `metodo` enum (`linea` = usuario y hora, `electronica`, `manuscrita`), `archivo_id` FK a `archivos.archivo` (opcional, el PDF firmado), `verificacion` (resultado de `firmas-ocr` si aplica, sin JSON).
- API: `POST /api/firmas` (crea; el firmante es siempre la cuenta autenticada: **nadie firma por otro**), `GET /api/firmas?documentoTipo=&documentoId=`.
- Los módulos la usan por **HTTP interno o por evento** (`<modulo>.<documento>.firmado` → la plataforma registra); **no** comparten tablas. Mientras los módulos no la usen, QHSE guarda su "una línea" en su propia tabla y la migra después (D6).

## 5. Tramos

1. **A1 — Auditoría**: consumidor + tabla + línea de tiempo + pantalla. Es independiente y de valor inmediato.
2. **A2 — Firmas**: modelo, API, integración con `archivos`/`firmas-ocr`, y un cliente (`libs/shared`...) o contrato HTTP para que los módulos la llamen.
3. **A3 — Adopción**: cada módulo (QHSE primero) mueve sus firmas aquí cuando le toque, con la sesión de ese módulo.

## 6. Pruebas

Auditoría: un evento publicado por Pumping aparece en la línea de tiempo del ticket; idempotente; la base rechaza UPDATE/DELETE. Firmas: la hora es del servidor; el firmante es el autenticado; el hash coincide; permisos.

## 7. Puntos de choque

Gateway (`/api/firmas`, `/api/auditoria` en la lista de la plataforma), permisos (bloques `firmas` y `auditoria`), `apps/plataforma/src/app/app.module.ts`, `package.json`, `tsconfig.base.json`. Es el contenedor de la **plataforma**: un cambio aquí obliga a todos a reconstruir; **avise en el registro**.

## 8. Consultas (`documentacion/database/CONSULTAS-PARA-DYNADRILL.md`, sección `## Auditoría y firmas`)

- ¿Qué documentos exigen firma legal vs. "una línea"? ¿Hay requisitos de conservación (años)?
- ¿Quién puede consultar la auditoría?

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

## 9. Encargo de la sesión (18/10/2026)

**Estado:** sin construir (los schemas existen vacíos). **A1 (Auditoría) tiene valor inmediato** porque todos los módulos ya publican eventos; A2 (Firmas) puede ir después o en paralelo.

**Puntos finos**
- **Auditoría suscrita a todo:** el bus pide un `source` por suscripción; suscríbase a cada contenedor productor (`operaciones`, `comercial`, `qhse`, `plataforma`) con el patrón `#` y un `group: 'auditoria'`: la plataforma ya tiene otros consumidores (avisos) de esos orígenes y **sin grupo propio se repartirían los mensajes** (sección 9 de `01-REGLAS-DE-COORDINACION.md`). Idempotente con `handleOnce` (el id del evento es la llave).
- **Sin JSON del evento:** las pocas columnas de negocio consultables (código de pedido, número de ticket, unidad) en columnas tipadas o en la tabla hija del plan; el sujeto (`sujeto_tipo`, `sujeto_id`) viene en el sobre. Inmutable: REVOKE de UPDATE y DELETE y una prueba que lo intente.
- **Línea de tiempo:** una consulta por sujeto (pedido, ticket, orden) y por actor; pantalla de consulta para Superadmin y auditoría. Los historiales propios de cada módulo (`comercial.proceso_historial`, `pumping.ticket_historial`) **se quedan**: este es el registro central, no los reemplaza.
- **Firmas (A2):** `firma` con hash SHA-256 del documento o del texto firmado, hora del servidor, firmante = la cuenta autenticada (nadie firma por otro), método (`linea`, `electronica`, `manuscrita`) y `archivo_id` opcional. Los módulos la usan por HTTP interno o por evento; QHSE será el primer adoptante (D6) con su propia sesión.
- Es el contenedor de la **plataforma** (3101): un cambio aquí obliga a todos a reconstruir; **avise en el registro** y reinicie solo `plataforma` (y el gateway si cambia rutas).

Commit con `scripts/commit-modulo.ps1 -Modulo auditoria` (o `firmas`).
