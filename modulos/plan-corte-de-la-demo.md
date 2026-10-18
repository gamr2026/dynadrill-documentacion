# Plan: Corte de la demo

**Alcance:** gateway, frontend y datos · **Estado:** por hacer, **módulo por módulo** · **Ola:** 3 (cada módulo se corta cuando esté completo y probado)
**Lea antes:** `00`, `01`, `03` (D5, D11) y `database/PLAN-MIGRACION-PEDIDOS.md` (§7, el corte de Pedidos como modelo).

## 1. Objetivo

Que el frontend deje de hablar con el backend de la demo y todo pase por el backend nuevo, **sin perder datos ni accesos**, y retirar la demo (y el puente de identidad) cuando el último módulo migre.

## 2. Cómo funciona hoy (para entender el corte)

- El **gateway** (`apps/gateway`) decide a qué contenedor va cada prefijo (`routes.ts`). Lo que no está asignado **cae en la demo** (puerto 3300).
- **Puente de identidad**: a la demo se le traduce el token nuevo a uno suyo (HS256, ids numéricos) **solo si el usuario tiene `legacy_id`**. Por eso existen las columnas `legacy_id` en usuarios, roles y catálogos. Se retira cuando el último módulo migre.
- Los prefijos **nuevos** conviven con los viejos: `/api/operaciones/...` (nuevo) frente a `/api/operations/...` (demo); `/api/v2/catalogos` (nuevo, ids UUID) frente a `/api/catalogos` (demo, ids numéricos); `/api/v2/qhse` frente a `/api/qhse`.
- El frontend, en los módulos ya migrados (pedidos de comercial, tickets de Pumping), usa servicios nuevos; los demás siguen con los servicios de la demo.

## 3. Pasos del corte de un módulo (lista de verificación)

1. **Paridad funcional**: el módulo nuevo hace todo lo que hace el de la demo (el plan del módulo lo lista). Una prueba compara la matriz **rol × endpoint** de la demo (`module-roles.ts` y los `@Roles` de cada endpoint) con los permisos nuevos (patrón: `PLAN-MIGRACION-PEDIDOS.md` §7, "prueba de paridad").
2. **Datos**: script `migrate-from-demo.ts` del módulo (patrón: `libs/comercial/pedidos/prisma/migrate-from-demo.ts`): lee `dynadrill-backend/prisma/dynadrill.db` (solo lectura), **desarma los `payload` JSON en tablas**, enlaza por `legacy_id` y es **idempotente**. Si el usuario decide arrancar vacío (D11), solo se migran catálogos.
3. **Frontend**: los servicios del módulo apuntan al prefijo nuevo; los ids pasan de número a UUID (cuidado con rutas y selects); se retiran los mocks e interceptores de la demo; el módulo del frontend queda sin referencias a `/api/<prefijo viejo>`.
4. **Gateway**: se agregan los prefijos de la demo del módulo (`/api/unidades`, `/api/maintenance-orders`, `/api/articulos`, `/api/operations/...`) **al contenedor nuevo** o se retiran, y se corrige `routes.spec.ts`.
5. **Sombra**: un periodo corto con ambos activos y sin tráfico de usuarios al nuevo, comparando resultados.
6. **Corte**: el prefijo viejo pasa al nuevo; se prueba de punta a punta (login, listado, creación, aprobación, avisos).
7. **Limpieza**: se retira del módulo lo transitorio (puentes temporales como `pumping.requisitos.puente` para lo que el módulo ya publica, columnas `legacy_id` que ya no se usan) **con migración** y se anota en el registro.

## 4. Orden sugerido

1. **Comercial / Facturación** (ya tiene todo: falta el corte del prefijo `/api/facturacion` y retirar el permiso `comercial.pedidos.gestionar`, ver `PLAN-MIGRACION-PEDIDOS.md` §7). Consultas pendientes de ese plan: R5, R6, G6–G8 en `facturacion/CONSULTAS-PARA-DYNADRILL.md`.
2. **Catálogos** (cuando el último módulo viejo deje de usar `/api/catalogos` con ids numéricos).
3. **Flota → Mantenimiento → Inventario** (juntos, comparten `Unidad`).
4. **QHSE**.
5. **Pumping y FCR** (tickets), con la migración de las FK de `catalogos.vehiculo` a `flota.unidad` (D2).
6. **Retiro del puente** (`LEGACY_JWT_SECRET`, `legacy_id`) y apagado de la demo.

## 5. Riesgos

- **Ids numéricos → UUID** en el frontend y en datos guardados en el navegador (ver `localStorage`).
- Diferencias entre la copia del backend de la demo y la versión que corre el cliente (D5): validar contra el frontend y las specs.
- Datos de producción de la demo (D11): decisión del usuario.
- Trabajo en curso: un corte no se hace mientras otra sesión modifica el contrato del mismo módulo.

## 6. Quién lo hace

Cada sesión corta **su** módulo (tramo final de su plan). Este documento lo mantiene la sesión principal con la lista de estado:

| Módulo | Paridad | Datos | Frontend | Gateway | Cortado |
|---|---|---|---|---|---|
| Comercial (pedidos) | parcial | n/a | hecho | pendiente | no |
| Catálogos | sí | sí | parcial | pendiente | no |
| Pumping | traslado de salida | n/a | parcial | `/api/operaciones` | no |
| Flota, Mantenimiento, Inventario, QHSE, FCR | — | — | — | — | no |

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

## 7. Estado al 18/10/2026 (sesión principal)

- **Ya en el backend nuevo y con frontend conectado:** Comercial/Pedidos (parcial: falta el corte del prefijo), Inventario (admin y kardex), Pumping (ticket completo en `operations/pumping/tickets-nuevos`, ruta `pedidos`) y Mantenimiento (bandeja, ejecución, cierre y retorno, con ids UUID).
- **Siguen contra la demo:** FCR, QHSE (salvo EPI), Flota (parcial), preventivo, historial e inspecciones de Mantenimiento, el dashboard y los KPI.
- **Lo que hay que retirar al cortar Pumping:** la pantalla vieja del ticket (`pages/ticket-detail-page`, ~2.900 líneas), la lista vieja, el puente `bridgeToMaintenance`, `UnitReportsService.create/update` (`@deprecated`), los puentes temporales de requisitos de Flota y QHSE cuando esos módulos publiquen sus eventos, y la aprobación de la inspección por el Supervisor con el puente.
- **No empiece un corte** hasta que el módulo tenga paridad probada y esté cerrado el trabajo de su sesión.
