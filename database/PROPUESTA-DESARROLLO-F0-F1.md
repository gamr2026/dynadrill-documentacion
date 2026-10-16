# Propuesta de desarrollo — F0 (fundaciones) y F1 (login y catálogos)

> Base: documentos *Arquitectura de Backend v1.0* y *Propuesta de Base de Datos v1.0* (DIGITEC, 11/10/2026), adaptados con las decisiones de la revisión del 12/10/2026. Reemplaza, para el backend nuevo, el diseño de 112 tablas / 12 schemas de `ANALISIS-Y-PROPUESTA-BD.md`.

## 1. Decisiones acordadas

| Tema | Decisión |
|---|---|
| Repositorio | Nuevo `dynadrill-platform`, monorepo Nx; `dynadrill-backend` queda como demo (`demo-legacy`) detrás del gateway |
| Contenedores | gateway, plataforma, comercial, operaciones, qhse (worker después) |
| Estructura por módulo | `controllers/`, `services/`, `dto/`, `repositories/`, `middlewares/`, `utils/`, `prisma/`; `index.ts` es la única puerta pública |
| Base de datos | PostgreSQL 17, una BD, un schema por módulo (19 en total), **FK reales hacia las tablas maestras (`catalogos`, `identidad`) y JOIN para obtener los nombres** (ver desviación 48), UUIDv7 generado por la aplicación |
| ORM | Prisma, un `schema.prisma`, un cliente y migraciones por módulo |
| Permisos | 17 roles en tabla `identidad.rol`; matriz `ModuleRoles` en código (`@dyn/authz`) |
| Eventos | RabbitMQ con outbox/inbox en Postgres (equivalente local de Azure Service Bus) |
| Archivos | Azurite (equivalente local de Blob Storage, mismo SDK) |
| Otros equivalentes | ClamAV (antimalware), Mailpit (correo), OpenTelemetry + Jaeger (trazas) |
| Identidad | Opción B del documento (módulo propio): JWT RS256, Argon2id, refresh rotativo |

## 2. Estructura del repositorio

```
dynadrill-platform/
├─ apps/        gateway · plataforma · comercial · operaciones · qhse
├─ libs/
│  ├─ shared/   common · authz · utils · config · messaging · storage · scanner · mail
│  └─ <contenedor>/<modulo>/   controllers · services · dto · repositories · middlewares · utils · prisma · index.ts
├─ infra/       docker-compose · db/init (SQL de schemas y usuarios)
└─ docs/adr/
```

## 3. Stack local (`docker-compose`)

postgres 17 + pgbouncer · rabbitmq · azurite · clamav · mailpit · otel-collector + jaeger · apps.

Cada servicio de Azure queda detrás de un puerto (`FileStoragePort`, `EventBus`, `ScannerPort`, `MailPort`): pasar a Azure es cambiar configuración y agregar el adaptador de Service Bus.

## 4. Etapa 0 — Fundaciones

| # | Entregable |
|---|---|
| 0.1 | Repo Nx, Node 22, TypeScript estricto, ESLint con `enforce-module-boundaries`, Prettier, Husky, commits convencionales |
| 0.2 | `docker-compose` con los servicios del punto 3 |
| 0.3 | SQL de inicialización: 19 schemas, usuarios `app_*`, `dyn_migrator`, `dyn_lectura`, privilegios sin `DELETE` en tablas de negocio |
| 0.4 | `shared/config`: variables de entorno validadas |
| 0.5 | `shared/common`: `@CurrentUser`, `@Roles`, guards, filtro RFC 7807, middlewares de request-id y logging (pino) |
| 0.6 | `shared/utils`: UUIDv7, paginación, fechas UTC, dinero, hashing |
| 0.7 | `shared/messaging`: `EventBus`, `OutboxRelay`, `InboxGuard`, adaptador RabbitMQ |
| 0.8 | `apps/gateway`: JWT, rate-limit, request-id, `/health`, enrutamiento por prefijo con `demo-legacy` por defecto |
| 0.9 | `apps/plataforma` vacío con health checks |

Prueba de cierre: un evento viaja outbox → RabbitMQ → inbox y se ve la traza en Jaeger.

## 5. Etapa 1 — Identidad y catálogos

**`identidad`** (`rol`, `usuario`, `usuario_empleado`, `sesion`): `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `/api/users`, `/api/roles`. JWT RS256 de 15 min con JWKS; Argon2id; bloqueo temporal por intentos; DTOs de salida sin `password_hash`; `switch-role` solo con `DEV_ROLE_SWITCH`. Evento `plataforma.usuario.actualizado.v1`.

**`catalogos`** (`cliente`, `persona_contacto`, `bloque`, `campo`, `pozo`, `taladro`): CRUD paginado en las rutas `/api/catalogos/*`; borrado lógico; evento `plataforma.catalogo.actualizado.v1`.

## 6. Migración desde la demo

Script idempotente SQLite → Postgres: UUIDv7 por cada id entero con correspondencia en `migracion.mapa_id`; orden roles → usuarios → clientes → contactos → bloques/campos/taladros → pozos; informe de diferencias con conteos y registros no resueltos.

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Contrato del frontend (ids numéricos → UUID) | OpenAPI de la demo congelado y pruebas de contrato |
| Dominios legacy con usuarios por id entero | `demo-legacy` resuelve `sub` (UUID) → id entero con `mapa_id` |
| Conexiones a Postgres con un cliente Prisma por módulo | Pools pequeños y PgBouncer desde el inicio |
| Curva de Nx | ADR corto y generador de módulos |

## 8. Orden de trabajo

1. Repo, Nx, lint y compose (0.1–0.3)
2. Libs compartidas (0.4–0.7)
3. Gateway y plataforma vacíos (0.8–0.9) y prueba del evento
4. `identidad` con migración de usuarios
5. `catalogos` con migración de maestros
6. Conmutación en el gateway y prueba con el frontend

## 9. Desviaciones respecto de `dynadrill_propuesta_v1.sql` (para revisión del supervisor)

El documento de BD (cap. 10) exige revisión del supervisor y actualización del diccionario de datos ante
cualquier cambio de modelo. Estas son las diferencias introducidas al implementar el módulo `identidad`
y la infraestructura; ninguna está en el SQL entregado.

| # | Cambio | Dónde | Motivo | Carácter |
|---|---|---|---|---|
| 1 | `identidad.usuario_empleado` → **`usuario_perfil`** | tabla | No toda persona con acceso es empleada; la tabla guarda el perfil (RRHH y datos personales) de quien lo tenga. Decisión del 13/10/2026 | Permanente |
| 2 | Columna **`usuario.tipo_vinculo`** (`empleado` \| `contratista` \| `externo`, default `empleado`, `CHECK`) | `usuario` | Distinguir la clase de persona sin exigir perfil. No confundir con `usuario_perfil.tipo_contrato`. Los valores deben confirmarse con Dynadrill | Permanente |
| 3 | Columnas **`usuario.intentos_fallidos`** y **`usuario.bloqueado_hasta`** | `usuario` | Bloqueo temporal tras intentos fallidos, exigido por el cap. 10.1 de la arquitectura pero ausente del DDL | Permanente |
| 4 | Columnas **`rol.legacy_id`** y **`usuario.legacy_id`** (únicas, nulas) | `rol`, `usuario` | Puente de ids mientras los módulos viejos usen enteros: el gateway traduce el token nuevo al de la demo | **Transitoria** (patrón expand/contract: se elimina al migrar el último módulo) |
| 5 | Índices parciales en `msg_*.outbox` (pendientes y publicados) | `msg_*` | El relay solo lee los pendientes; el índice se mantiene pequeño aunque la tabla crezca | Permanente |
| 6 | Schema **`pgbouncer`** con la función `get_auth` | infraestructura | Autenticación de PgBouncer (`auth_query`) sin mantener una lista de usuarios en el pooler | Solo infraestructura, fuera del modelo de negocio |
| 7 | `CHECK` en `usuario.intentos_fallidos >= 0` | `usuario` | Integridad del contador | Permanente |
| 8 | Tablas **`permiso`**, **`rol_permiso`** y **`rol_permiso_historial`** (RBAC en base de datos) | `identidad` | Decisión del 13/10/2026: los permisos de cada rol dejan de estar fijos en código (`@dyn/authz`, como decía el documento v1.0) y un administrador los edita desde la app. La matriz de la demo sirve de semilla, así que el día uno nadie gana ni pierde acceso | Permanente |
| 9 | Permisos **granulares** por acción: `identidad.usuarios.{ver,crear,editar,inactivar}` e `identidad.roles.{ver,editar_permisos}` (reemplazan a los gruesos `*.administrar`) | catálogo de `permiso` | Un permiso por acción estándar. La baja es lógica, de ahí `inactivar` y no `eliminar`. Cada módulo nuevo nace con su set (`ver`, `crear`, `editar`, `anular`/`inactivar`) más las acciones propias del negocio | Permanente |
| 10 | `DELETE` concedido a `app_plataforma` solo sobre `rol_permiso` y `permiso`; `UPDATE` revocado sobre `rol_permiso_historial` | privilegios | Reemplazar el conjunto de permisos de un rol y retirar permisos obsoletos del catálogo requiere borrar filas. Excepción acotada a la regla "sin DELETE": la bitácora es de solo inserción (ni UPDATE ni DELETE) | Permanente |
| 11 | Columna **`habilitado`** en `catalogos.bloque` y `catalogos.campo` (default `true`) | `catalogos` | El SQL v1 no la traía, pero sin ella no se pueden inactivar: la aplicación no tiene `DELETE` y el documento prohíbe borrar. Se llama `habilitado` (como pozo y taladro) y no `activo` porque `campo` ya tiene `activo_operativo` (activo de Petroecuador, texto) que la API expone como `activo` | Permanente |
| 12 | Columna **`legacy_id`** (única, nula) en las 6 tablas de `catalogos` | `catalogos` | Puente de ids: los módulos viejos referencian clientes, pozos, campos, bloques, taladros y personas por su id numérico en la demo. Misma lógica que en `rol` y `usuario` | **Transitoria** (se elimina al migrar el último módulo) |
| 13 | Permisos de catálogos **solo de escritura** (`catalogos.ubicacion.*`, `catalogos.clientes.*`, `catalogos.personas.*`: crear, editar, inactivar); la lectura es abierta a cualquier usuario autenticado | catálogo de `permiso` | Todos los formularios necesitan estos datos para poblar sus selects. Reemplazan a `catalogos.ubicacion.escribir` y `catalogos.personas.escribir` con traspaso de asignaciones | Permanente |

| 14 | Tablas **`empleado_as2`**, **`empleado_as2_historial`** y **`sincronizacion_as2`**, y columna **`usuario_perfil.empleado_as2_id`** (FK opcional) | `identidad` | Decisión del 13/10/2026: AS2 (el ERP) es la fuente de los datos de los empleados y el portal guarda una copia local de solo lectura para no depender de su disponibilidad. Solo campos de perfil: **nunca** sueldo, discapacidad ni cargas. El historial guarda un registro por campo que cambia, para saber qué cargo o contrato tenía alguien en una fecha. Las bajas se detectan solo por `fecha_salida`; que un empleado falte en la respuesta no lo da de baja, y si AS2 falla la copia no se toca | Permanente |
| 15 | `REVOKE UPDATE` a `app_plataforma` sobre `empleado_as2_historial`, `ejecucion` y `cambio` | privilegios | Bitácoras de solo inserción, como `rol_permiso_historial` | Permanente |
| 16 | Schema **`integraciones`** (el 20.º) con `proveedor`, `autenticacion`, `operacion`, `mapeo_campo`, `ejecucion` y `cambio` | nuevo módulo | Decisión del 13/10/2026: las APIs de terceros (AS2 hoy, otras mañana) se gobiernan desde la base de datos. Un cambio del tercero (ruta, campo, versión) se corrige con una versión nueva de la operación, no desplegando código. Cada `operacion` es versionada (una sola activa, índice parcial), con plantilla de la llamada, paginación y mapeo de campos; la bitácora de llamadas y la de cambios son inmutables. Hoy el motor habla JSON; otros formatos se agregan como un codec sin cambiar el modelo | Permanente |
| 17 | Los **secretos no se guardan en la base de datos**: `autenticacion.secretos` solo tiene el nombre (p. ej. `AS2_PASSWORD`) y un resolvedor lo busca en el entorno (después, Key Vault). Solo se entregan variables con un prefijo permitido (`INTEGRACIONES_SECRET_PREFIXES`, por defecto `AS2_`) | `integraciones` | Una configuración editable desde la app no debe poder leer `DATABASE_URL` ni `JWT_PRIVATE_KEY`. Dar de alta un proveedor con secretos nuevos exige añadir su prefijo al despliegue: es deliberado | Permanente |
| 18 | Permisos nuevos: `identidad.as2.{ver,sincronizar}` e `integraciones.configuracion.{ver,editar,probar}` (por defecto solo Superadmin); el formato válido de un código de permiso admite dígitos (`as2`) | catálogo de `permiso` | Contienen cédulas y pueden redirigir datos hacia un tercero | Permanente |

| 19 | Columna **`usuario.debe_cambiar_clave`** (boolean, por defecto `false`) y claim **`mustChangePassword`** en el JWT | `identidad` | Cuentas con clave provisional (creadas desde AS2 o restablecidas por un administrador): mientras esté pendiente, solo se pueden usar `/auth/change-password`, `/auth/me` y `/auth/logout`; todo lo demás responde 403 `PASSWORD_CHANGE_REQUIRED`, también en el gateway hacia la demo. Al cambiarla se cierran todas las sesiones anteriores | Permanente |
| 20 | Permiso **`identidad.as2.crear_cuentas`**, y los códigos de permiso admiten dígitos (`as2`) | catálogo de `permiso` | Crear cuentas inactivas desde los empleados de AS2 es una acción sensible: solo Superadmin por defecto | Permanente |
| 21 | `usuario.legacy_id` se **traspasa** de las cuentas de simulación retiradas a las cuentas de las personas reales que las usaban (p. ej. Superadmin y las de Mónica Cáceres y Verónica Romero) | `identidad` | Las cuentas de simulación y de rol se inactivaron (no se borran: la demo las referencia y la aplicación no tiene `DELETE`); el id numérico de la demo sigue a la persona real | **Transitoria** (como el resto de `legacy_id`) |

| 22 | Tablas **`comercial.documento`**, **`comercial.secuencia`** y **`comercial.secuencia_emision`** (motor de documentos y secuenciales) | `comercial` | No están en `dynadrill_propuesta_v1.sql`. El correlativo de la demo era "máximo + 1" sin bloqueo (condición de carrera) y compartía numeración con AS2. Cada documento (pedido, prefactura, guía, AOT...) tiene su secuencia con prefijo, longitud, rango y vigencia como en AS2; el número se emite con un `UPDATE ... RETURNING` atómico **dentro de la transacción del documento** (sin duplicados ni saltos si la transacción falla); la bitácora `secuencia_emision` es de solo inserción (privilegio de `UPDATE` solo sobre `estado`, `motivo` y `documento_ref_id`; ni `DELETE`) y su `UNIQUE (secuencia_id, numero)` garantiza que no haya duplicados. El número `PEC-` de AS2 lo asigna AS2 (`emite_portal = false`): el portal solo lo refleja | Permanente |
| 23 | Permisos **`comercial.secuencias.{ver,editar}`** (solo Superadmin por defecto) | catálogo de `permiso` | Ver el detalle de la numeración y anular un número con motivo | Permanente |
| 24 | Motor de estados por proceso: **`comercial.proceso_estado`**, **`proceso_transicion`** y **`proceso_historial`** | `comercial` | No están en `dynadrill_propuesta_v1.sql`. El flujo del pedido (17 estados, 40 pasos) vive en base de datos y se cambia sin desplegar; las precondiciones se nombran en la tabla (`regla`) y se implementan en código. Los pasos manuales exigen permiso y, si se indica, motivo; los automáticos los dispara un evento; forzar un estado es solo de Superadmin con motivo. El historial es de solo inserción (`REVOKE UPDATE`) | Permanente |
| 25 | **`comercial.pedido`**, **`pedido_tipo_servicio`**, **`pedido_subtipo_servicio`**, **`pedido_item`**, **`lista_precios`** y **`lista_precios_item`** | `comercial` | Pedido con ids de catálogo + copia del nombre (los nombres cambian en el catálogo, el pedido conserva lo que se pactó), versión optimista, `CHECK pedido_completo_check` para los estados que no son borrador/anulado, constancia del pedido de AS2 (`as2_*`) y eventos al outbox (`comercial.pedido.*`). Los hijos del pedido tienen `GRANT DELETE` (se reemplazan al editar); la cabecera no. Las listas de precios se migraron desde la demo (6 listas, 5.840 ítems) con `legacy_id` | Permanente (`legacy_id` transitorio) |
| 26 | Permisos **`comercial.pedidos.{editar,anular,rechazar,asignar_analista,forzar_estado}`** e **`integraciones.as2_pedidos.ver`** | catálogo de `permiso` | Se separan las acciones sensibles del pedido; `comercial.pedidos.gestionar` se conserva hasta el corte de la demo. La lectura de pedidos de AS2 es de solo lectura | Permanente (`gestionar` se retira al corte) |
| 27 | Endpoint **`GET /api/directorio/usuarios?ids=`** y claim **`name`** en el token | `plataforma` | `comercial` consulta a plataforma por HTTP (sin leer su base) los nombres de usuarios para copiarlos al pedido | Permanente |
| 28 | Operaciones de **pedidos de AS2** en `integraciones` (`pedidos_pagina`, `pedidos_pagina_estado`, `pedidos_buscar_texto`, `pedidos_ids`, `pedido_por_id`, `lineas_pedido`) y variable `idPedidoDesde` (14305 = pedidos de 2026) | `integraciones` | Los pedidos de AS2 no se copian a nuestra base: se leen por API por páginas de ~10, solo del año, y únicamente se recuerda en memoria (2 min) si un pedido tiene líneas. Los ELABORADO no devuelven líneas por API (consulta pendiente con Asinfo) | Permanente |
| 29 | **Catálogo de servicios normalizado**: `comercial.servicio_linea` → `servicio_tipo` → `servicio_subtipo`, cada tabla con `id` UUID y clave foránea al nivel superior; el pedido guarda `linea_id`, `pedido_tipo_servicio(tipo_id)` y `pedido_subtipo_servicio(tipo_id, subtipo_id)` | `comercial` | La demo tenía línea, tipos y subtipos como listas fijas en el frontend y texto suelto en la base. Un subtipo pertenece a UN tipo (1:n; el mismo nombre puede existir bajo tipos distintos). La FK compuesta `(pedido_id, tipo_id)` impide un subtipo cuyo tipo el pedido no eligió, y la FK `(tipo_id, subtipo_id)` impide un subtipo que no pertenece a su tipo. El subtipo no lleva FK directa a `pedido` (sería redundante). La API sigue usando códigos | Permanente |
| 30 | **`tipo_ot` como catálogo** (`comercial.tipo_ot`, venta/servicio) y **`solicitud_medio` como enum de PostgreSQL** (`verbal`/`escrita`) | `comercial` | Un valor que se elige de una lista es catálogo (con `id`); uno fijo y cerrado es enum de la base, no `CHECK` con texto | Permanente |
| 31 | **`catalogos.zona`, `catalogos.bodega` y `catalogos.condicion_pago`**; `campo.zona_id` (FK). El pedido guarda `zona_id`, `bodega_id`, `condicion_pago_id` **más la copia del nombre**, sin FK entre schemas. Bodega y condición traen `as2_id` | `catalogos`, `comercial` | La demo guardaba zona, bodega y condición como texto suelto (duplicados por mayúsculas, sin catálogo). La zona del pedido es la de su campo (se calcula). Se retiró el "activo operativo" de Petroecuador: no se usa en el negocio. Bodegas (11) y condiciones (5) sembradas con lo que AS2 usa en 2026 (AS2 no expone esas listas por API) | Permanente |
| 32 | **Roles `ingenieria_ventas_fcr` y `coordinador_hse` retirados** (quedan 15). El Gerente HSE conserva los permisos del Coordinador | `identidad` | El primero fue una implementación errónea de la demo; el segundo no existe en el negocio (solo Gerente y Técnico HSE). La migración pasa las cuentas inactivas al rol sucesor y borra los roles con su bitácora de permisos | Permanente |
| 33 | **Módulo `archivos`** (plataforma): schema `archivos` con `modulo_archivo` (permisos de subir/ver, tipos MIME y tamaño por módulo) y `archivo` (huella SHA-256, `blob_key`, enum `escaneo`, baja lógica; registro inmutable). Contenido en Azure Blob (Azurite en local) detrás de `FileStoragePort`; antivirus detrás de `ScannerPort` (ClamAV, falla cerrada) | `archivos` | No guarda archivos en el filesystem como la demo. Los módulos guardan solo el `archivo_id`. Valida permiso, tipo, tamaño y firma del contenido | Permanente |
| 34 | **`comercial.pedido_documento`** (adjuntos del pedido): `archivo_id` + copia de nombre, tipo y tamaño; sin FK al otro schema | `comercial` | Documento referencial opcional del pedido. Solo se adjunta un archivo que subió la misma persona, mientras el pedido es editable (máx. 10) | Permanente |
| 35 | Valores fijos y cerrados como **ENUM de PostgreSQL** (19 columnas en identidad, catálogos, integraciones y comercial) y retiro de las marcas químico/herramienta/movilización del ítem | todos | La demo (y la primera versión del nuevo modelo) usaban texto con `CHECK`. Un valor que se elige de una lista es catálogo con `id`; uno fijo y cerrado del sistema es enum de la base. La marca de movilización se deducía de una palabra de la descripción (mala práctica) y se retiró | Permanente |
| 36 | **Documentos operativos normalizados**: `documento_operativo` (uno por día para el Reporte Job y uno por servicio para el de herramientas), `documento_operativo_actividad`, `documento_operativo_herramienta` y `documento_operativo_uso`, con enums (tipo, origen, estado de uso) | `comercial` | En la demo todo vivía en un `payload` JSON. Llegan de Operaciones (aún sin migrar) por un endpoint; recibir uno con la misma clave lo reemplaza (índice único con `NULLS NOT DISTINCT`). El avance documental (días de Reporte Job, reporte de herramientas según la línea, guía si hay venta) pasa el pedido solo a "documentos completos" por el motor de estados | Permanente |
| 37 | **Prefactura normalizada**: `prefactura` (versiones; una vigente por pedido), `prefactura_item`, `prefactura_advertencia`, `prefactura_firma` y `tasa_impuesto` (IVA y retenciones con vigencia), con enums | `comercial` | La demo guardaba todo en JSON, numeraba por conteo no atómico con el año fijo, borraba la prefactura rechazada al regenerar y no validaba el estado del pedido. Aquí: versión nueva tras un rechazo (se conserva el historial); el número de ticket es el `PRC-` de AS2 y se registra cuando AS2 lo entrega (único entre las vigentes); varias firmas por prefactura (company man del pedido, cliente, Dynadrill) con su archivo; las tasas se guardan en la prefactura; cada paso mueve el pedido por el motor de estados | Permanente |
| 38 | **Catálogos de transporte** `transportista`, `tipo_vehiculo`, `vehiculo` (placa única y normalizada, con `CHECK`) y `chofer` (de un transportista) | `catalogos` | La demo escribía transportista, placa y chofer como texto libre en cada guía, sin lista ni control. Aquí son catálogos con `id` y la guía los referencia por id con una copia del nombre. Se cargan al principio por la pantalla; la lista de AS2 queda como consulta pendiente (`CONSULTAS-PARA-ASINFO.md`) | Permanente |
| 39 | **Guía de remisión** `guia_remision` e `guia_remision_item` (+ catálogo `lugar_despacho` y enums `estado_guia`, `origen_item_guia`), con secuencial propio `003-001-` + 7 dígitos que emite el portal | `comercial` | La guía propone lo que sale físicamente (herramientas del Reporte de Herramientas con su serie y los ítems Material del pedido, sin personal, horas, movilización ni precios) y se edita antes de emitir. El número sale del motor de secuenciales y se puede reasignar con motivo: el anterior queda anulado y nunca se reutiliza (`UNIQUE` en la bitácora). Se puede reemplazar una guía anulada. El PDF firmado se adjunta desde `archivos` (módulo `guia_documento`); la validación criptográfica de la firma electrónica queda para el servicio OCR | Permanente |
| 40 | **Despacho a Bodega como dos marcas del pedido** (`despacho_solicitado_*` y `despacho_realizado_*`, con quién y cuándo) | `comercial` | Facturación solo necesita pedir y saber que Bodega despachó; no se crea un documento de despacho. Los pasos `prefactura_generada` ↔ `por_despachar_bodega` van por el motor de estados. Un `CHECK` impide marcar realizado sin solicitado | Permanente |
| 41 | **Validación de la firma electrónica del PDF firmado** (`guia_remision.firma_electronica_*` y `guia_firma_digital`, con enums `estado_firma_electronica`, `integridad_firma_digital`, `origen_fecha_firma`) | `archivos`, `comercial` | `archivos` expone `POST /api/archivos/:id/verificar-firma-electronica` (solo PDF) hacia el servicio `firmas-ocr` (`/v1/firma-electronica`, pyHanko). Al registrar la guía firmada, `comercial` la valida en segundo plano y guarda el estado global y cada firma (firmante, cédula/RUC, emisor, integridad, vigencia, cadena). Es una ayuda para revisar y nunca bloquea: el servicio no consulta la revocación y solo trae la raíz de ANF, así que las firmas de Security Data, Lazzate y BCE salen como "firmante no verificado" hasta que se carguen sus raíces en `apps/firmas-ocr/raices` | Permanente |
| 42 | **Guía de remisión impresa con `window.print()`** (formato DYN-AFN-RE-013) y autorización del SRI en la secuencia (`secuencia.autorizacion_numero`, con `vigencia_desde/hasta`) | `comercial`, frontend | El PDF generado en el servidor con pdfkit no se parecía al formato: se retiró y la guía se imprime desde una hoja HTML con el mismo mecanismo de los demás formatos (`DocumentoPdfService`). La hoja lleva membrete, serie y número en rojo, autorización, datos de transporte con la descripción del vehículo, ítems sin precios y firmas. También se guarda la lectura de firma manuscrita (`guia_remision.firma_manuscrita*`) y la descripción del vehículo (`vehiculo_descripcion`) | Permanente |
| 43 | **Orden de trabajo (OT) y cierre del pedido**: `orden_trabajo` y `orden_trabajo_item`, catálogos `ciudad_ot` y `firmante_contratista`, marca `lista_precios.requiere_orden_trabajo` con `texto_contrato`, y `pedido.factura_numero` | `comercial` | La demo calculaba el número de la OT por conteo (692 + n), la guardaba en JSON, fijaba al firmante y el texto del contrato en el código y no distinguía a los clientes que no la exigen. Aquí: secuencial propio que no se reinicia (continúa de 947), número `{n}-OPR-{pozo}-{ciudad}-{año de la OT}` único, una OT por pedido, generada solo de la prefactura firmada y solo si el contrato la exige (si no, el pedido pasa directo a control de costos). La firma es física: se anota quién la marcó y el escaneo opcional (`orden_trabajo_documento`). El cierre (control de costos → listo para facturar → facturado con el número de la factura de AS2) va por el motor de estados. La exportación a AS2 entrega las líneas de la prefactura firmada en el formato de la plantilla; las unidades sin código confirmado salen como aviso (consulta C11 a Asinfo) | Permanente |
| 44 | **Pumping: contenedor `operaciones` y schema `pumping`** (`paso`, `paso_rol`, `transicion`, `ticket`, `ticket_tipo_servicio`, `ticket_historial`; enums `macro_estado`, `origen_cambio`) | `operaciones` | La demo guardaba el ticket en un `payload` JSON, los pasos y el historial como texto y el rol responsable fijo en el código (copiado en el frontend). Aquí: pasos, roles y transiciones en tablas, el ticket con la copia normalizada del pedido (id de catálogo + nombre) y el seguimiento en una tabla; el ticket se crea al recibir `comercial.pedido.abierto` (inbox: una sola vez) y no lleva numeración propia: el ticket es la prefactura, así que lleva el número que `comercial` le reservó al pedido al abrirlo (siguiente del secuencial de la prefactura, `pedido.ticket_numero`); la prefactura hereda ese mismo número. Solo existen las transiciones que el módulo ya valida (cada fase agrega las suyas) | Permanente |
| 45 | **Avisos: campanita y correo con la misma regla** (`avisos.plantilla`, `regla_aviso`, `aviso`, `correo_aviso`; enums `tono_aviso`, `estado_correo`) | `plataforma` | La demo calculaba los avisos al leer (sin guardarlos) y no enviaba correos. Aquí un evento de otro contenedor (`operaciones.pumping.ticket_creado`) genera, por cada regla (evento + rol → plantilla), un aviso de la campanita y un correo para cada persona activa con ese rol, con el texto de su cargo. La plantilla (asunto, cuerpo y texto de la campanita) vive en la base de datos; los avisos quedan guardados por persona con su estado de lectura; la bitácora de correos anota a quién habría llegado y a qué dirección salió. **Mientras el proyecto esté en pruebas todo correo sale únicamente a `MAIL_REDIRECT_TO`** (variable obligatoria: sin ella el contenedor no arranca), sin copias, con "[PRUEBA]" en el asunto y la persona real solo como texto informativo. La salida de correo es un puerto (SMTP hoy; en Azure, Communication Services) y los destinatarios los entrega identidad (`UsuariosPorRolService`), no se leen sus tablas | Permanente |
| 46 | **Número de ticket reservado al abrir el pedido** (`pedido.ticket_numero` único y `ticket_emision_id`) | `comercial` | En la demo el ticket (prefactura) recibía su número al generarse; Dynadrill pidió que el ticket lo tenga desde el inicio. Al abrir el pedido por primera vez se toma el siguiente número del secuencial de la prefactura (mayor que el contador del portal, que lo último visto en AS2 y que cualquier número ya registrado; con bloqueo de fila), la prefactura y sus versiones lo heredan, y si el pedido se anula el número queda anulado en la bitácora sin reutilizarse. Los pedidos anteriores quedan sin número (nulo) y siguen con el camino de registrarlo a mano | Permanente |
| 47 | **El código del pedido es el número del pedido de AS2** (`pedido.codigo` = `PEC-NNNNNN`; la serie `PED-` queda solo para los pedidos ya abiertos) | `comercial` | Decisión de Dynadrill del 16/10/2026, que reemplaza la serie propia `PED-` (4317 a 4323). Un pedido que viene de AS2 conserva su número; uno creado en el portal reserva, al abrirse, el siguiente del espejo del secuencial `PEC-` de AS2 (mayor que el contador, que lo último visto en AS2 y que cualquier número registrado; con bloqueo de fila). Al cargar o vincular un pedido de AS2 el espejo avanza hasta su número (`observarAs2`). Si el número ya lo tiene otro pedido del portal, al abrir se informa con un 409. El riesgo de desfase con AS2 queda como consulta C12 | Permanente |
| 48 | **Normalización: FK reales entre schemas hacia las tablas maestras y fin de las copias de nombre** | `comercial`, `pumping`, `avisos` | Se retira la regla "sin FK entre schemas" para `catalogos` e `identidad` (como en `nuevo-portal`: una base, un schema por dominio, FK y JOIN). El pedido, la lista de precios, el documento operativo, el ticket de Pumping, sus personas y unidades, el historial de estados, el aviso y la bitácora de correos guardan solo el id (con FK); el nombre sale del JOIN y ya no se copia. Se eliminan columnas como `cliente_nombre`, `campo_nombre`, `pozo_nombre`, `*_nombre` de responsables y de quien despachó, `zona`, `bodega`, `condicion_pago` (la zona es la del campo), `usuario_nombre`, `placa`/`descripcion` de la unidad y `actor_nombre`; `proceso_historial.actor_id` y las columnas `*_por` pasan a ser FK a `identidad.usuario`. Lo que AS2 trae y no existe en el catálogo propio se conserva como dato de AS2 (`as2_empresa_nombre`, `as2_empresa_identificacion`, `as2_bodega`, `as2_condicion_pago`, `as2_zona`). Se conserva la copia solo en documentos emitidos (guía, orden de trabajo, prefactura firmada). Los módulos leen las maestras con un usuario de solo lectura: `SELECT` en las tablas de catálogo y, de `identidad.usuario`, solo `id, nombre, email, activo` (más `rol_id` en Pumping). Los modelos de Prisma de las maestras son espejos de solo lectura dentro de cada módulo. Los eventos entre contenedores llevan ids; quien necesita el nombre lo obtiene del catálogo. Pendientes: FK de `created_by`/`updated_by` en todas las tablas y de `archivo_id` hacia `archivos.archivo` | Permanente |

Además, en `identidad.usuario.password_hash` conviven hashes **Argon2id** (los nuevos) y **bcrypt** (heredados de
la demo); estos últimos se reemplazan en el primer login correcto de cada usuario.

> Análisis complementario de los datos de AS2 (personas, clientes y representantes): ver `ANALISIS-AS2-PERSONAS-Y-CLIENTES.md`.

## 10. Integración con AS2 (API REST) — hecho el 13/10/2026

El API REST de AS2 (`/AS2/rest`, OpenAPI en `/rest/openapi.json`, JWT por `POST /v2/usuarios/login`) permite leer empleados y usuarios sin depender de Excel. Se probó en solo lectura:

| Consulta | Resultado |
|---|---|
| `POST /v2/catalogors/empleado` (consulta genérica: se piden los campos, filtro `idOrganizacion` obligatorio, máx. 1.000 filas) | 162 empleados; 97 activos (sin `fechaSalida`) |
| `POST /v2/usuarios` | 87 usuarios; 62 con correo (39 de Dynadrill, casi todos `nombre.apellido@dynadrill.com.ec`) |

**Cómo quedó construido**

- Módulo **`integraciones`** (`libs/plataforma/integraciones`): motor genérico que ejecuta una *operación* registrada en la base de datos (URL, autenticación, plantilla de la llamada con `{{param.x}}`, `{{var.x}}`, `{{secreto.x}}`, `{{pagina.x}}`, paginación, mapeo de campos con transformaciones). Reintentos ante 5xx, renovación de token una vez, bitácora inmutable. El motor no sabe nada de AS2.
- Gobierno desde la app (API, por ahora sin pantalla): crear una **versión** nueva de una operación → **probarla** (devuelve solo conteos y nombres de campos, nunca datos) → **activarla**; volver atrás es activar la anterior. Todo cambio queda en `integraciones.cambio`. `POST /api/integraciones/proveedores/:codigo/operaciones/:operacion/versiones`, `POST /api/integraciones/operaciones/:id/{probar,activar}`.
- **`identidad`** consume el motor mediante un puerto (`As2Port`) y un adaptador; la sincronización (`POST /api/as2/sincronizar`, o programada con `AS2_SYNC_INTERVAL_MINUTES`) mantiene `empleado_as2` con historial y enlaza los perfiles existentes por cédula. `AS2_SYNC_INACTIVAR_BAJAS=true` (apagado por defecto) inactiva las cuentas de quienes ya salieron.
- La configuración inicial de AS2 se siembra con `npm run db:seed:integraciones` (usa `AS2_BASE_URL`; los secretos `AS2_USER` y `AS2_PASSWORD` se leen del entorno, no se guardan).

**Cuentas reales de empleados (13/10/2026)**

- Se usa el correo que trae AS2, tal cual (también los personales: gmail, outlook, hotmail); **no se inventan correos**. Sin correo en AS2 no se crea cuenta: 70 de 98 empleados activos quedan pendientes hasta que RRHH entregue el correo o AS2 lo registre (la siguiente sincronización lo recoge).
- `POST /api/as2/crear-cuentas` (permiso `identidad.as2.crear_cuentas`): por defecto solo **simula**; `simular: false` crea, y `cedulas` limita a ciertas personas. Las cuentas nacen **inactivas**, con el rol sugerido por el cargo (borrador) y el cambio de clave obligatorio pendiente. Un administrador revisa el rol y las activa.
- **Clave provisional:** iniciales de todos los nombres y apellidos + `123*` (ej. `ARGS123*`). Es fácil de adivinar a propósito; por eso no se activa una cuenta hasta el momento de entregarla, y el primer ingreso obliga a elegir otra (`POST /api/auth/change-password`; pantalla `/cambiar-clave` en el frontend; el gateway no deja pasar tokens con cambio pendiente hacia la demo).
- Duplicados: si ya existe un usuario del portal con nombre parecido y otro correo (p. ej. cuentas de rol como `facturacion@`), no se crea y se informa como conflicto.
- **Primera corrida real:** 162 empleados copiados (98 activos), 26 cuentas creadas (inactivas), 2 conflictos por duplicado (Mónica Cáceres y Verónica Romero). 14 de las 26 tienen un cargo no reconocido y quedaron con el rol básico `operador`: **revisar el rol antes de activar**.

**Decisiones del 14/10/2026**

- La sincronización con AS2 corre cada 24 h (`AS2_SYNC_INTERVAL_MINUTES=1440`) y **una baja en AS2 inactiva la cuenta del portal** (`AS2_SYNC_INACTIVAR_BAJAS=true`).
- Los 70 empleados activos sin correo en AS2 quedan pendientes de conseguir su correo; no se les crea cuenta.
- La revisión de las 8 cuentas con rol de relleno (`operador`) se hace durante las pruebas de flujo.
- La demo desaparece de a poco, con prueba y error. El siguiente módulo a migrar es **Pedidos** (contenedor `comercial`); la coexistencia de los catálogos con la demo se resuelve ahí. Plan en `PLAN-MIGRACION-PEDIDOS.md`.
- La seguridad de la conexión con AS2 (cuenta de solo lectura, HTTPS/VPN) y la rotación de credenciales expuestas quedan fuera de alcance por ahora.

**Consultas para Asinfo:** las dudas sobre AS2 que solo ellos pueden resolver se registran en `documentacion/integracion-as2/CONSULTAS-PARA-ASINFO.md`, que sirve de orden del día para la sesión con ellos.

**Pendiente**

1. Cuenta de servicio de **solo lectura** en AS2 (hoy se usa `Digitec`, que ve nómina) y **HTTPS o VPN**: el API va por HTTP sin cifrar.
2. Correr la primera sincronización real y revisar el resultado antes de crear cuentas.
3. Pantalla de administración de integraciones (hoy solo API).
4. Crear las cuentas reales de los empleados (`nombre.apellido@dynadrill.com.ec`), con cambio de clave obligatorio en el primer ingreso, rol por persona validado por RRHH y puente `legacy_id` con la demo.
5. Reconciliar las secciones 1 a 8 de este documento con el diseño real (siguen describiendo el diseño original).
