# BRIEF S1: QHSE-A (Desechos, Derrames, Emergencias)

## Prompt de arranque

Abra Claude Code en `C:/Users/Digitec/Documents/proyectos/dynadrill-platform-s1` y pegue:

```
Usted es la sesión S1 del plan de sesiones paralelas de Dynadrill. Trabaje SOLO en esta carpeta (rama sesion/s1-qhse-a).
Lea C:/Users/Digitec/Documents/proyectos/documentacion/modulos/sesiones/BRIEF-S1.md y siga sus instrucciones y las reglas de
C:/Users/Digitec/Documents/proyectos/documentacion/modulos/PLAN-SESIONES-PARALELAS.md. Responda en español con «usted». Empiece por la mini-especificación
y el plan de rebanadas de su primer subdominio y espere la aprobación del usuario antes de construir.
```

## Datos de la sesión

- Carpeta de trabajo: `C:/Users/Digitec/Documents/proyectos/dynadrill-platform-s1` · rama: `sesion/s1-qhse-a` · módulo para `commit-modulo.ps1`: `qhse`
- Código principal: `libs/qhse/seguridad`
- Antes de la primera prueba: `npx nx run <proyecto>:prisma-generate` (los clientes generados no se versionan).

## Cómo trabajar (obligatorio)

Lea primero, en este orden: `documentacion/modulos/PLAN-SESIONES-PARALELAS.md` (reglas §4 y §5: son obligatorias), `documentacion/modulos/PENDIENTES-DE-MIGRACION.md` (§0 y la sección de su módulo), `documentacion/modulos/00-CONTEXTO-COMPARTIDO.md` y `01-REGLAS-DE-COORDINACION.md`, y el plan de su módulo. Luego siga el flujo del §4 del plan con las skills instaladas (`using-agent-skills`, `spec-driven-development` corto, `planning-and-task-breakdown`, `incremental-implementation` + `test-driven-development`, `doubt-driven-development` en migraciones, `code-review-and-quality`).

**Primera entrega:** la mini-especificación y el plan de rebanadas de su primer subdominio. **Muéstrela al usuario y espere su aprobación** antes de escribir migraciones o código.

## Alcance (en este orden de prioridad)

1. **Desechos** (`Desecho`): peligroso / no peligroso con características CRETIB, contenedor por color, **límite de almacenamiento de 12 meses** (AM 142), manifiesto con tres firmas, certificado. Catálogos de característica, contenedor y estado como tablas; firmas en tabla inmutable; usar el OCR de firmas cuando se cargue el documento firmado (D6).
2. **Derrames** (`DerrameEvento`): alerta por volumen y ubicación, checklist de contención de 5 minutos, notificación obligatoria al MAE; un derrame en suelo **genera un desecho** (mismo esquema `qhse`: FK real). **Los umbrales de las bandas son un supuesto de la demo: modélelos como datos configurables (tabla de bandas) y deje los valores marcados «por confirmar con Dynadrill»; no los dé por definitivos.**
3. **Emergencias / MEDEVAC** (`EmergenciaEvento`): activación con cronómetro, nivel 1–3, conteo de personal (locación, evacuados, faltantes), triage médico por color, signos vitales, notificación a hospital; vínculo SWA ↔ emergencia.

## Planes y documentos de referencia

- `documentacion/modulos/plan-qhse.md` (tramos Q4, Q5 y Q6) y `documentacion/qhse/` (documentos de origen).
- Demo de referencia: modelos `Desecho`, `DerrameEvento` y `EmergenciaEvento` en `dynadrill-backend`, y las pantallas en `dynadrill/dynadrill-frontend/src/app/features/qhse`.

## Reglas específicas de esta sesión

- Todo vive en `libs/qhse/seguridad` (esquema `qhse`); API bajo `/api/v2/qhse`; eventos con prefijo `qhse.`.
- Migraciones con marca de tiempo posterior a `20261023120000` (la última): use `2026102410xxxx` en adelante.
- Plantillas de avisos (límite de desechos próximo, notificación al MAE pendiente) mediante el módulo de Avisos de la plataforma, no un servicio aparte.
- No toque las tablas de S2 (investigaciones, legales, objetivos, aspectos). S2 trabaja en la misma lib: en los archivos compartidos (módulo Nest, índice, `permissions.ts`) solo agregue su bloque al final.

## Criterio de «terminado» por subdominio

Migración aplicada en base vacía · semilla de catálogos · API con permisos en `permissions.ts` · eventos por outbox · pruebas de integración en verde (reglas de la base incluidas) · `PENDIENTES-DE-MIGRACION.md` actualizado (hecho / falta / qué necesitará el frontend) · commit con `commit-modulo.ps1`.
