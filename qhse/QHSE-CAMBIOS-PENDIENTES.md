# QHSE — Cambios pendientes

**Proyecto:** Dynadrill · **Fecha:** 24 de agosto de 2026 · **Rama:** `feature/module-qhse` (`dynadrill-frontend`)

Checklist de avance real del módulo QHSE. Fases 1-3 completas y subidas a `feature/module-qhse`. Ver `QHSE-PLAN-DESARROLLO.md` para el detalle completo de cada fase.

## ✅ Fase 1 — Cimientos: IPERC + PTW (HSE-PLAN-001, HSE-SITIO-001)

- [x] Matriz IPERC (DYN-SGI-RE-087): 4 fases (preparación, identificación/evaluación inicial, controles/reevaluación, documentación/aprobación), matriz de riesgo 5x5 (`dynadrill-risk-matrix`, nuevo componente en `dynadrill-ui@0.13.1`).
- [x] PTW / Recibimiento de Sitio (HSE-SITIO-001): 6 fases (Gabinete → Ingreso → Verificaciones → Formalización → Ejecución → Gestión documental), monitoreo de gases H2S/LEL/O2/CO contra límites del proceso, checklist LOTO, firmas de PTW y Actas.
- [x] Integración automática: un PTW solo puede abrirse desde una Matriz IPERC ya aprobada (bloqueado con 400 en el mock si no lo está).
- [x] Rol Supervisor con acceso a PTW (firma PTW y Actas) sin acceso a IPERC, según HSE-SITIO-001.
- [x] `ng build` limpio, commit + push.

**Pendiente de esta fase:** prueba manual en navegador de punta a punta (aprobar IPERC → abrir PTW → recorrer las 6 fases hasta cerrarlo). No se pudo automatizar — requiere que alguien la corra en el navegador.

## ✅ Fase 2 — Control operativo diario (HSE-SEGUIMIENTO-001/002/003)

- [x] Inspecciones de campo: eslinga de cable / detector de gas / vehículo-grúa, checklist de criterios de rechazo por tipo, bump test para detectores de gas, vigencia trimestral, cuarentena automática si algún criterio falla.
- [x] Tarjetas STOP: acto/condición insegura, 8 categorías, observador obligatorio/observado opcional (con "Anónimo"), foto, dashboard de tendencias (Pareto por categoría).
- [x] Stop Work Authority: activación → cadena de notificación (Supervisor/Coordinador HSE/Gerente HSE) → evaluación riesgo real/falsa alarma (bloqueada hasta notificar a los 3 roles) → checklist de reanudación → reconocimiento "Héroe de Seguridad". Política de cero represalias visible en banner.
- [x] Acceso rápido "Reportar" en el header — STOP, SWA e Inspección disponibles para cualquier usuario autenticado, sin pasar por el `roleGuard` de QHSE.

**Pendiente de esta fase:** ninguno conocido — falta solo prueba manual.

## ✅ Fase 3 — Ambiental (HSE-AMBIENTAL-001/002)

- [x] Gestión de Desechos: clasificación Peligroso/No Peligroso con características CRETIB, contenedor por código de color, límite de almacenamiento 12 meses (AM 142) con KPI de próximos a vencer, Manifiesto Único (verificación de licencia SUIA del gestor + 3 firmas), certificado de disposición final con plazo de 30 días.
- [x] Control y Respuesta a Derrames: alerta por volumen/ubicación, checklist de contención de 5 minutos, notificación obligatoria a MAE cuando aplica, integración "derrame en suelo → genera desecho peligroso" con un clic.
- [x] "Reportar" gana las 2 acciones que faltaban — ya cubre las 5 acciones universales del plan de desarrollo (STOP, SWA, Inspección, Desecho, Derrame).

**Pendiente de esta fase / a validar:**
- [ ] **Bandas de volumen de derrame** (menor/moderado/mayor) son un supuesto propio (< 1 barril / 1-10 / > 10) — HSE-AMBIENTAL-002 no fija los umbrales exactos. Confirmar con QHSE los valores oficiales y ajustar `derrame.model.ts`.
- [ ] Prueba manual de punta a punta (registrar desecho → manifiesto → 3 firmas → certificado; activar derrame → contención → notificar MAE → generar desecho → cerrar).

## ⬜ Fase 4 — Emergencias e investigación (HSE-TRIAGE-001, 002)

- [ ] **Plan de emergencias / MEDEVAC**: activación con cronómetro, nivel 1-3, conteo de personal (locación/evacuados/faltantes), triage médico por color, signos vitales, notificación a hospital, Reporte Flash (plazo 2 horas).
- [ ] **Investigación de incidentes**: clasificación Near Miss/Leve/Grave/Fatal (plazo 30 días para Near Miss), Técnica de los 5 Porqués, factores Ishikawa, tabla de acciones correctivas/preventivas, cierre que retroalimenta la Matriz IPERC como lección aprendida.
- [ ] Conectar las integraciones que quedaron como banner informativo en Fase 3: derrame "mayor" debería activar Emergencia Mayor automáticamente (hoy solo avisa que hay que escalar manualmente).
- [ ] Evaluar si el botón de emergencia entra también al acceso rápido "Reportar" del header (la documentación lo asigna a "Cualquier Trabajador — Detector Inicial", igual que STOP/SWA/Derrame).

## ⬜ Cierre del módulo

- [ ] **Dashboard integrado HSE-MASTER-001**: KPIs (TRIR, LTIR, días sin LTI, ratio Near Miss:Incidente, % PTW a tiempo, desechos kg/mes) y tabla de sitios/PTW con semáforo de cumplimiento. Se construye al final, cuando Fases 2-4 ya generan datos reales.

## Decisiones diferidas (no bloqueantes, quedan anotadas para más adelante)

- [ ] Firma electrónica con captura manuscrita (hoy es "una línea": usuario + timestamp, igual en IPERC/PTW/STOP/SWA/Desechos).
- [ ] Offline-first (hoy el módulo es solo-online, igual que Mantenimiento y Pumping).
- [ ] Backend real de QHSE — reemplazar `qhse-mock.interceptor.ts` cuando exista `/api/qhse/...` de verdad.
- [ ] Fotografías (STOP) y certificados (Desechos) hoy solo guardan el nombre del archivo — no hay almacenamiento ni preview reales (mismo patrón mock que el resto del sistema).
- [ ] Decidir si Supervisor debería tener también acceso de solo-vista a las bandejas de STOP/SWA/Inspecciones/Desechos/Derrames (hoy solo entra a PTW dentro de QHSE, más las bandejas de Mantenimiento que ya tenía).
