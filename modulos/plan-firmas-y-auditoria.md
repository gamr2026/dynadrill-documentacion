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
