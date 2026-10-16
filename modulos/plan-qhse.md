# Plan: QHSE (Calidad, Salud, Seguridad y Ambiente)

**Schema:** `qhse` · **Contenedor:** **qhse (nuevo, puerto 3104)** · **Librería:** `libs/qhse/<subdominio>` o una sola `libs/qhse/seguridad` con submódulos (decida en el primer tramo y déjelo escrito aquí) · **Prefijo HTTP:** `/api/v2/qhse` (reescrito a `/api/qhse` por el gateway; el `/api/qhse` de la demo **sigue en la demo** hasta el corte)
**Estado:** por construir · **Ola:** 1, empezando por el tramo que Pumping necesita (Q1) · **Tamaño:** el más grande de todos (≈ 3.300 líneas de backend y ≈ 10.300 de frontend en la demo)
**Lea antes:** `00`, `01`, `02` (contratos 3, 4.5, 4.6, 4.11), `03` (D1, D6, D7, D10) y `04-REVISION-CONTRA-DEMO-MAIN.md` (hallazgos 4, 9, 12, 13), `documentacion/PLAN-QHSE-PUMPING-NOTIFICACIONES.md` y `documentacion/qhse/QHSE-CAMBIOS-PENDIENTES.md`. **Revisado contra el `main` de la demo (08/10/2026).**

## 1. Objetivo

Construir el módulo QHSE completo del portal nuevo y, **primero**, lo que Pumping necesita para que el Traslado de salida funcione sin el puente temporal: la **entrega de EPI** y la consulta de las **aceptaciones de términos**.

## 2. Qué hay en la demo

| Parte | Dónde |
|---|---|
| Backend (subdominios, todos con `payload` JSON) | `dynadrill-backend/libs/domains/qhse/src/`: `iperc`, `iperc-cobertura`, `ptw`, `stop`, `swa`, `inspecciones`, `desechos`, `derrames`, `emergencias`, `investigaciones`, `epi`, `checklist-equipos` (**reemplazado**, ver abajo), `documentos` (573 líneas: documentos por pedido), `legal`, `aspectos-ambientales`, `objetivos-ambientales`, `dashboard-metas`, `avisos`. En el `main` ya **no** está `checklist-equipos` |
| Frontend (≈ 10.300 líneas) | `features/qhse/`: `iperc`, `ptw`, `stop`, `swa`, `inspecciones`, `desechos`, `derrames`, `emergencias`, `investigaciones`, `epi`, `documentos`, `legal`, `aspectos-ambientales`, `objetivos-ambientales`, `dashboard`, `hubs`, `eventos`, `shared` |
| Formatos y avance | `documentacion/qhse/`: DYN-SGI-RE-008 (tarjeta de observación), **DYN-SGI-RE-032 (registro de entrega de EPI y ropa de trabajo)**, DYN-SGI-RE-034 (investigación de incidentes), DYN-SGI-RE-087 (IPERC); `QHSE-CAMBIOS-PENDIENTES.md` (fases 1–4 y cierre) |
| Plan de integración con Pumping | `documentacion/PLAN-QHSE-PUMPING-NOTIFICACIONES.md` (v2) |
| Spec | `dynadrill-frontend-platform/specs/pumping-terminos-condiciones/SPEC.md` |

## 3. Qué hacen los otros módulos

- **Pumping** (esta sesión) ya espera de QHSE los eventos `qhse.epi.despachada` / `qhse.epi.revertida` (contrato 3) y publica `operaciones.pumping.asignacion_realizada` y `.ticket_creado`, que QHSE consume (contrato 4.6). Las aceptaciones de términos **las guarda Pumping** (`pumping.aceptacion_terminos`); QHSE solo las **consulta**.
- **Flota** es dueña de la inspección de vehículos (la demo mezclaba esto con el "checklist de equipos de QHSE", que ya no existe en el flujo; no lo reconstruya).
- **Firmas y Auditoría** (plataforma) dará el mecanismo de firma-evidencia; hasta entonces use `una línea` (usuario + hora del servidor) guardada en su propia tabla (D6).
- **Reportería** consumirá sus eventos para los KPI de HSE.

## 4. Decisiones de arquitectura que usted debe cerrar al empezar

1. **Cree el contenedor** `apps/qhse` copiando `apps/operaciones` (puerto 3104, usuario `app_qhse`, schemas `qhse` y `msg_qhse`, que ya existen en `infra/db/init`). Agregue `QHSE_URL` al gateway (la variable ya existe), a `scripts/levantar-local.ps1` y al script de reinicio. Anótelo en el registro (D7).
2. **Gateway:** `qhse` hoy apunta a `/api/qhse`, que es **todo** el QHSE de la demo. Cámbielo a `['/api/v2/qhse']` con reescritura a `/api/qhse` (como `v2/catalogos`) y corrija `routes.spec.ts`. Así el QHSE de la demo sigue funcionando hasta el corte.
3. **Roles:** `tecnico_hse` y `gerente_hse` (el rol `coordinador_hse` fue retirado a propósito: D4; el Gerente HSE conserva sus permisos). `withAdmins(...)` incluye Superadmin y Jefe de Base. La demo `main` incluye a `coordinador_hse` en `qhse`, `ipercApprove` y otras matrices: en la plataforma esos permisos son del Gerente HSE. **El Supervisor NO entra a los controllers de QHSE** (pedido del cliente); lo que sube o descarga el Supervisor cuelga de los endpoints del ticket.
4. **Archivos** (documentos QHSE, fotos, certificados): módulo `archivos`, un `modulo_archivo` por tipo. **FK** `archivo_id` a `archivos.archivo`.
5. **Acceso a datos de otro contenedor** (ticket, pedido): `uuid` **sin FK** + validación por evento (D1). A las maestras (`catalogos`, `identidad`, `archivos`) sí con FK, con `GRANT SELECT` mínimo para `app_qhse` (ver la migración `20261017120000_normalizar_con_fk` de comercial como modelo).

## 5. Tramos (haga uno a la vez y publique su estado)

### Q1 — Contenedor + EPI + consulta de términos (lo que Pumping necesita)
- Contenedor `qhse`, módulo base, salud, gateway `v2`.
- **EPI (DYN-SGI-RE-032)**: solicitud (la genera el equipo operativo para **cada operador** del ticket, o QHSE la abre al consumir la asignación), aprobación o rechazo (con motivo), despacho. Estados: `solicitado`, `aprobado`, `despachado`, `rechazado`. Una cabecera por entrega (lugar, **trabajador = FK a `identidad.usuario`** —no por nombre como la demo—, ticket, estado, quién y cuándo aprobó/rechazó/despachó) y **renglones** (elemento EPI, cantidad, talla, código o cédula, si recibió capacitación, observaciones, fecha de entrega) con un **catálogo `epi_elemento`**; dos firmas ("una línea"): la del trabajador y la de Talento Humano.
- **Publica** `qhse.epi.despachada` / `qhse.epi.revertida` (contrato 3); **consume** `operaciones.pumping.asignacion_realizada`. Retire el puente temporal para ese requisito **avisándole a la sesión de Pumping** por el registro.
- **Consulta de aceptaciones de términos** (historial por operador): lee `pumping.aceptacion_terminos` por HTTP o evento (hoy Pumping es del contenedor `operaciones`: acuerde con la sesión de Pumping si expone un endpoint de consulta). Verlo es del Técnico y el Gerente HSE y de los Supervisores de Pumping (permiso `pumpingTerminosHistorial` en la demo). La **cédula** sale del perfil de la cuenta del operador (JOIN), no se captura.
- Hoja imprimible de la entrega de EPI y de la constancia de términos (`window.print()`).

### Q2 — Control operativo diario (HSE-SEGUIMIENTO-001/002/003)
- **SWA (Stop Work Authority)**: activación, cadena de notificación (Supervisor, Coordinador HSE, Gerente HSE), evaluación riesgo real / falsa alarma (bloqueada hasta notificar a los tres roles), checklist de reinicio. **Publica** `qhse.swa.activado|cerrado` con `ticketId` (contrato 4.5, bloquea reportes en Pumping/FCR, D10).
- **STOP** (tarjeta de observación DYN-SGI-RE-008): acto o condición insegura, 8 categorías, observador obligatorio y observado opcional ("Anónimo"), foto, tendencias (Pareto).
- **Inspecciones de campo** (eslinga de cable, detector de gas, vehículo-grúa): checklist de criterios de rechazo por tipo, *bump test*, vigencia trimestral, cuarentena. Una inspección de vehículo-grúa rechazada puede originar un reporte de unidad para Mantenimiento (evento).
- **"Reportar"**: acceso rápido (STOP, SWA, inspección, desecho, derrame) para cualquier usuario autenticado, fuera del guard de QHSE.

### Q3 — IPERC y PTW (HSE-PLAN-001, HSE-SITIO-001)
- **IPERC** (DYN-SGI-RE-087): 4 fases, matriz de riesgo 5×5, cobertura por línea de servicio (qué actividades de la matriz maestra exige cada línea: `iperc-cobertura`). Un PTW solo se abre desde un IPERC **aprobado**.
- **PTW**: fases Gabinete → Ingreso → Verificaciones → Formalización → Ejecución → Gestión documental; un PTW por día de operación y pedido; el "PT" del día. **El PTW ya no pide el Acta de Entrega** (el ticket sí la pide al cerrar) y el último paso pasó de «Cierre del PTW» a **«Aprobación del PTW»** (es una aprobación de QHSE); el certificado se ve en vista de impresión. **El checklist de ingreso y verificaciones (gases, LOTO) no es del PTW**: lo llena el equipo operativo en Pumping **al inicio de la ejecución** (ya construido). La "formalización de ejecución" (el Company Man aprobó) la confirma el Supervisor en el ticket, también al inicio de la ejecución.
- **Publica** `qhse.ptw.abierto|firmado|cerrado`.
- **Documentos por pedido**: formato de recepción, **ART** (vigencia legal de **15 días**, aviso 3 días antes; puede haber varios por pedido), **PT**, **SFI** (formato de seguridad de ingreso) y el **Acta de Entrega de Locación (DYN-PMP-RE-027)**, que **sube el Supervisor al finalizar el ticket** (una por pedido; **el ticket no se cierra sin ella**, contrato 4.11). El **Carnet de Vacunas ya no se carga ni se exige** (el cliente lo retiró). QHSE ve y sube **ART y PT también de los tickets FCR**. Una tabla `documento_pedido` con tipo (enum: `formato_recepcion`, `art`, `pt`, `sfi`, `formato_entrega`), referencia, `archivo_id` (FK), `vigente_hasta`. Avisos "calculados": pedido sin formato de recepción, personal asignado sin SFI, PTW sin PT hoy, ART por vencer/vencido.

### Q4 — Ambiental (HSE-AMBIENTAL-001/002)
- **Desechos**: peligroso/no peligroso con características CRETIB, contenedor por color, **límite de almacenamiento de 12 meses** (AM 142), manifiesto y tres firmas, certificado.
- **Derrames**: alerta por volumen y ubicación (los umbrales de las bandas son un supuesto de la demo: **consulta**), checklist de contención de 5 minutos, notificación obligatoria al MAE, **derrame en suelo genera un desecho**, derrame mayor escala a emergencia.

### Q5 — Emergencias e investigación (HSE-TRIAGE-001/002)
- **Plan de emergencias / MEDEVAC**: activación con cronómetro, nivel 1–3, conteo de personal (locación, evacuados, faltantes), triage médico por color, signos vitales, notificación a hospital.
- **Investigación de incidentes** (DYN-SGI-RE-034): clasificación *Near Miss* / Leve / Grave / Fatal (plazo de 30 días para *Near Miss*), 5 Porqués, Ishikawa, acciones correctivas y preventivas.

### Q6 — Cierre: legal, objetivos, aspectos, dashboard
- **Legal** (requisitos legales), **objetivos ambientales**, **aspectos ambientales**, **metas del dashboard** y el **dashboard HSE-MASTER-001** (TRIR, LTIR, días sin LTI, ratio *Near Miss*:incidente, % PTW a tiempo, desechos kg/mes). Los KPI salen de `reporting` (plan de Reportería); aquí solo las metas configurables.

## 6. Modelo de datos: principios para todos los subdominios

- Enums de PostgreSQL para estados y valores fijos de formatos regulados (niveles de emergencia 1–3, clasificación de incidente, color de contenedor CRETIB, fases del PTW, categoría STOP, tipo de inspección).
- Catálogos como tablas (elementos de EPI, categorías STOP, tipos de inspección y sus criterios de rechazo, residuos y características CRETIB, preguntas y niveles de la matriz de riesgo).
- Listas anidadas (ítems de una entrega de EPI, controles de un IPERC, lecturas de gas, acciones correctivas) en **tablas hijas**, nunca JSON.
- Personas: FK a `identidad.usuario`. Observador "anónimo": columna booleana, sin guardar un texto "Anónimo".
- Referencias a pedido y ticket: `uuid` sin FK (otro contenedor, D1) + validación por evento al crear.

## 7. API y permisos

`/api/v2/qhse/{epi,swa,stop,inspecciones,iperc,ptw,documentos,desechos,derrames,emergencias,investigaciones,legal,...}`. Permisos en un bloque `qhse` de `permissions.ts` (hoy solo hay `qhse.general.gestionar`, `qhse.iperc.aprobar`, `qhse.eventos.reportar`): defina ver/crear/aprobar por subdominio. **Los endpoints de "reportar" usan `@AnyAuthenticated()`** (cualquier usuario autenticado).

## 8. Pantallas

Las de `features/qhse/*`, con los servicios apuntando a `/api/v2/qhse`. El frontend ya trae `qhse-avisos-feeder.service.ts` (campanita): migre su fuente a los avisos de la plataforma y retire los cálculos por consulta cuando sea posible. Hojas imprimibles: EPI, constancia de términos, PTW, IPERC, manifiesto de desechos, informe de investigación.

## 9. Pruebas

Por tramo: integración con base real (estados y transiciones, permisos por rol, que el Supervisor **no** entre, eventos del contrato, idempotencia del consumidor, vigencia del ART a 15 días, límite de 12 meses de desechos, bloqueo "notificar a los tres roles" de la SWA).

## 10. Consultas para Dynadrill (`documentacion/qhse/CONSULTAS-PARA-DYNADRILL.md`, sección `## QHSE`)

- Valores oficiales de las bandas de volumen de derrame (la demo supone < 1 / 1–10 / > 10 barriles).
- ¿Quién valida el texto de Términos y condiciones? (D9)
- ¿Se mantiene el bloqueo por SWA? (D10; en la demo `main` solo bloquea el frontend) ¿El PTW bloquea la ejecución o solo avisa (el ART vencido hoy solo avisa)?
- ¿Se conservan los datos de QHSE de la demo? (D11)

## 11. Puntos de choque

`permissions.ts` (bloque `qhse`), `routes.ts` del gateway (su prefijo), `apps/qhse/**` (suyo), `levantar-local.ps1`, `package.json`, `tsconfig.base.json`, plantillas de avisos (`plantillas/qhse.ts`). **No** toque `libs/operaciones/**`.

## 12. Preguntas abiertas entre módulos

_(Pumping: ¿expone un endpoint de consulta de aceptaciones de términos o lo consume QHSE por evento? · Flota: ¿quién abre el caso de inspección de vehículos cuando una inspección QHSE de vehículo-grúa se rechaza?)_
