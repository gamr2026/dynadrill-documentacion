# BRIEF S2: QHSE-B (Investigación, Legales, Objetivos y Aspectos, Avisos)

## Prompt de arranque

Abra Claude Code en `C:/Users/Digitec/Documents/proyectos/dynadrill-platform-s2` y pegue:

```
Usted es la sesión S2 del plan de sesiones paralelas de Dynadrill. Trabaje SOLO en esta carpeta (rama sesion/s2-qhse-b).
Lea C:/Users/Digitec/Documents/proyectos/documentacion/modulos/sesiones/BRIEF-S2.md y siga sus instrucciones y las reglas de
C:/Users/Digitec/Documents/proyectos/documentacion/modulos/PLAN-SESIONES-PARALELAS.md. Responda en español con «usted». Empiece por la mini-especificación
y el plan de rebanadas de su primer subdominio y espere la aprobación del usuario antes de construir.
```

## Datos de la sesión

- Carpeta de trabajo: `C:/Users/Digitec/Documents/proyectos/dynadrill-platform-s2` · rama: `sesion/s2-qhse-b` · módulo para `commit-modulo.ps1`: `qhse`
- Código principal: `libs/qhse/seguridad`
- Antes de la primera prueba: `npx nx run <proyecto>:prisma-generate` (los clientes generados no se versionan).

## Cómo trabajar (obligatorio)

Lea primero, en este orden: `documentacion/modulos/PLAN-SESIONES-PARALELAS.md` (reglas §4 y §5: son obligatorias), `documentacion/modulos/PENDIENTES-DE-MIGRACION.md` (§0 y la sección de su módulo), `documentacion/modulos/00-CONTEXTO-COMPARTIDO.md` y `01-REGLAS-DE-COORDINACION.md`, y el plan de su módulo. Luego siga el flujo del §4 del plan con las skills instaladas (`using-agent-skills`, `spec-driven-development` corto, `planning-and-task-breakdown`, `incremental-implementation` + `test-driven-development`, `doubt-driven-development` en migraciones, `code-review-and-quality`).

**Primera entrega:** la mini-especificación y el plan de rebanadas de su primer subdominio. **Muéstrela al usuario y espere su aprobación** antes de escribir migraciones o código.

## Alcance (en este orden de prioridad)

1. **Investigación de incidentes** (`Investigacion`, DYN-SGI-RE-034): Near Miss / Leve / Grave / Fatal (plazo de 30 días para Near Miss), 5 Porqués, Ishikawa, acciones correctivas y preventivas. 5 Porqués y causas de Ishikawa como **filas**, no JSON; estados e historia inmutable.
2. **Requisitos legales** (`DocumentoLegalQhse`): registro y vigencia; el documento por el servicio de archivos.
3. **Objetivos ambientales** (`ObjetivoAmbiental`) y **Aspectos ambientales** (`AspectoAmbiental`, matriz de aspectos e impactos), con seguimiento.
4. **Avisos de QHSE**: alertas agregadas (vencimientos de ART, requisitos legales por vencer, inspecciones vencidas, plazos de investigación) resueltas con **reglas y plantillas del módulo de Avisos** de la plataforma, no con un servicio aparte. No incluya el aviso de límite de desechos (es de S1).

## Planes y documentos de referencia

- `documentacion/modulos/plan-qhse.md` y `documentacion/qhse/`.
- Demo: modelos `Investigacion`, `DocumentoLegalQhse`, `ObjetivoAmbiental`, `AspectoAmbiental` en `dynadrill-backend`, y `qhse-avisos-feeder.service` del frontend.

## Reglas específicas de esta sesión

- Todo vive en `libs/qhse/seguridad` (esquema `qhse`), igual que S1: en los archivos compartidos (módulo Nest, índice, `permissions.ts`) solo agregue su bloque al final.
- Migraciones: `2026102411xxxx` en adelante (posteriores a `20261023120000`).
- No toque las tablas de S1 (desechos, derrames, emergencias).
- El dashboard HSE-MASTER-001 (TRIR, LTIR, etc.) queda para la sesión principal cuando S1 y S2 terminen sus tablas: deje documentado qué columnas y eventos necesitará.

## Criterio de «terminado» por subdominio

Migración aplicada en base vacía · semilla de catálogos · API con permisos en `permissions.ts` · eventos por outbox · pruebas de integración en verde (reglas de la base incluidas) · `PENDIENTES-DE-MIGRACION.md` actualizado (hecho / falta / qué necesitará el frontend) · commit con `commit-modulo.ps1`.
