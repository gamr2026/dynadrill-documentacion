# Módulos por construir — planes para sesiones en paralelo

Fecha: 17/10/2026. Este directorio existe para que **varias sesiones (agentes) construyan módulos distintos del backend nuevo a la vez** sin pisarse y sabiendo qué hacen las demás.

## Para continuar el trabajo en otra sesión

Lea primero **`PLAN-CIERRE-FRONTEND.md`** (qué falta del frontend, el método para mantener la fidelidad con la demo, el inventario de pantallas por migrar, los pendientes de la base y el corte) y luego `PLAN-CIERRE-MODELADO.md` y `FRONTEND-PARIDAD-VISUAL.md`. Los scripts de apoyo están en `../herramientas-frontend/`.

## Cómo se usa

1. Cada sesión recibe **un módulo**. Antes de escribir una línea lee, en este orden:
   1. `00-CONTEXTO-COMPARTIDO.md` (cómo está construido todo y las reglas que no se negocian).
   2. `01-REGLAS-DE-COORDINACION.md` (qué archivos son compartidos, cómo se avisa, cómo se verifica).
   3. `02-CONTRATOS-ENTRE-MODULOS.md` (los eventos y APIs que unen un módulo con otro).
   4. `03-DECISIONES-PENDIENTES.md` (lo que solo el equipo de Dynadrill puede decidir).
   5. `04-REVISION-CONTRA-DEMO-MAIN.md` (cómo difiere el `main` de la demo de hoy de lo que se sabía; **la referencia es el `main` remoto**).
   6. `plan-<su módulo>.md`.
2. Quien trabaja un módulo **no modifica el código de otro módulo**. Si necesita algo de otro, lo pide en el registro (`REGISTRO-DE-CAMBIOS-COMPARTIDOS.md`) o lo consume por el contrato.
3. Al terminar un tramo, cada sesión actualiza el estado de su plan y agrega una entrada al registro.
4. `NOTAS-DE-ARRANQUE.md` trae el texto listo para pegar al abrir cada sesión.

## Mapa de módulos

| # | Módulo | Schema / contenedor | Plan | Depende de | Lo necesitan |
|---|---|---|---|---|---|
| — | Pedidos (ciclo comercial) | `comercial` / comercial | **Hecho** (ver `database/PLAN-MIGRACION-PEDIDOS.md`) | catálogos, identidad | Pumping, FCR |
| — | Plataforma (identidad, catálogos, archivos, avisos, integración AS2) | varios / plataforma | **Hecho** | — | todos |
| — | Pumping hasta el traslado de salida | `pumping` / operaciones | **En curso** (esta sesión) | comercial | QHSE, Flota, Mantenimiento |
| 1 | **Flota** (unidades, conductores, inspección de vehículos, gerenciamiento de viaje) | `flota` / operaciones | `plan-flota.md` | catálogos, identidad | Pumping, Mantenimiento, FCR |
| 2 | **Mantenimiento** | `mantenimiento` / operaciones | `plan-mantenimiento.md` | Flota | Pumping, FCR |
| 3 | **QHSE** | `qhse` / **contenedor nuevo `qhse`** | `plan-qhse.md` | catálogos, identidad, archivos | Pumping, FCR |
| 4 | **Inventario** | `inventario` / operaciones | `plan-inventario.md` | catálogos, AS2 | Pumping, FCR, comercial |
| 5 | **FCR** (Fishing, Completion & Remedial) | `fcr` / operaciones | `plan-fcr.md` | comercial, Inventario, Flota, QHSE | comercial |
| 6 | **Pumping restante** (asignación con químicos, reporte diario, revisión, ejecución, llegada cierre) | `pumping` / operaciones | `plan-pumping-restante.md` | Inventario, QHSE, Flota, Mantenimiento | comercial |
| 7 | **Firmas y Auditoría** | `firmas`, `auditoria` / plataforma | `plan-firmas-y-auditoria.md` | — | QHSE, todos |
| 8 | **Reportería y Dashboard** (contenedor `worker`) | `reporting` / worker | `plan-reporting-dashboard.md` | eventos de todos | gerencia |
| 9 | **Corte de la demo** | gateway y frontend | `plan-corte-de-la-demo.md` | cada módulo | — |
| 10 | **Ajustes a Pedidos (comercial)** según el `main` de la demo (prefactura desde el ticket, corrección del Reporte Job, movilización, MSDS) | `comercial` / comercial | `plan-comercial-ajustes.md` | — | Pumping, FCR |

## Olas recomendadas (qué conviene hacer en paralelo)

**Ola 1 — en paralelo, no dependen entre sí**
- Sesión A: **Flota** y luego **Mantenimiento**.
- Sesión B: **QHSE**, empezando por el tramo que Pumping necesita (EPI y consulta de términos).
- Sesión C (si hay una tercera): **Inventario**.
- Esta sesión: Pumping.

**Ola 2 — cuando Flota, Inventario y el primer tramo de QHSE existan**
- **FCR** (es el más grande de operaciones), **Pumping restante**, **Ajustes a Pedidos** y **Firmas y Auditoría**.

**Ola 3**
- **Reportería y Dashboard**, y el **Corte de la demo** módulo por módulo.

## Lo que probablemente se le estaba escapando

Además de QHSE, Mantenimiento e Inventario, el análisis de la demo y de los esquemas ya previstos en la base muestra:

- **Flota**: tiene su propio schema previsto; la demo lo mezcla con Mantenimiento. Es prerrequisito de Mantenimiento y de Pumping.
- **FCR**: el módulo operativo más grande (≈ 7.700 líneas entre backend y frontend de la demo).
- **Pumping restante**: faltan químicos, reporte diario, ejecución, llegada, cambio de ítems y cierre.
- **Firmas y Auditoría**: dos schemas previstos (`firmas`, `auditoria`) que nadie ha tocado.
- **Reportería (worker)**: indicadores y dashboard; el contenedor `worker` y el schema `reporting` están previstos y vacíos.
- **Portal del Conductor**: vive dentro de Flota (gerenciamiento de viaje, tareas).
- **Corte de la demo**: retirar el puente al backend viejo módulo por módulo.
- **Documentos impresos (formatos)**: cada módulo trae sus hojas con `window.print()`; van en el plan de cada uno.
- **Diferido a propósito** (no está en ninguna ola): firma manuscrita electrónica de QHSE, modo sin conexión.
