# Registro de cambios compartidos

**Solo se agrega al final.** Una entrada por cambio en un archivo compartido, en un contrato o en algo que afecte a otra sesión. Formato:

`AAAA-MM-DD hh:mm · sesión/módulo · qué cambió · archivo(s) · qué debe saber el resto`

---

- 2026-10-17 · Pumping (sesión principal) · Se crea este directorio de coordinación (`documentacion/modulos`). · documentacion/modulos/* · Lea el README antes de empezar.
- 2026-10-17 · Pumping · Nuevo permiso `pumping.requisitos.puente` (77 permisos). `identidad.integration.spec.ts` ahora espera 77. · libs/shared/authz/src/lib/permissions.ts · Si agrega permisos, actualice ese número y corra `npm run db:seed:identidad`.
- 2026-10-17 · Pumping · Migraciones de normalización (FK reales a `catalogos`, `identidad`, `archivos`; fin de copias de nombre) en comercial, pumping, avisos, catalogos, identidad, archivos, integraciones. · ver `database/INVENTARIO-COPIAS-DE-NOMBRE.md` y la desviación 48 de `PROPUESTA-DESARROLLO-F0-F1.md` · Todo módulo nuevo sigue esa regla (contexto, regla 1).
- 2026-10-17 · Pumping · Traslado de salida: requisitos por paso (`requisito`, `paso_requisito`, `ticket_requisito`), términos, checklist de ingreso, reporte de unidad, asignación emparejada operador–unidad. · libs/operaciones/pumping · Los eventos `flota.inspeccion_vehiculo.*` y `qhse.epi.*` ya tienen consumidor (contrato 3).
- 2026-10-17 · Pumping · El módulo dueño de la inspección de vehículos pasa de `mantenimiento` a **`flota`**: enum `modulo_dueno` renombrado (migración `20261018100000_modulo_dueno_flota`), consumidor y eventos `flota.inspeccion_vehiculo.*`. · libs/operaciones/pumping · Flota debe publicar con `source: 'flota'` (contrato 3).
- 2026-10-17 · Pumping · Las plantillas de avisos se parten por módulo: `libs/plataforma/avisos/src/catalog/plantillas/{tipos,pumping,index}.ts`. · libs/plataforma/avisos · Cada módulo crea `plantillas/<modulo>.ts` y agrega **una línea** en `plantillas/index.ts`; los eventos que avisan se agregan en `consumers/eventos-con-aviso.consumer.ts`.
- 2026-10-17 · Pumping · **Segunda revisión contra el `main` remoto de la demo** (backend 08/10, frontend 07/10): ver `04-REVISION-CONTRA-DEMO-MAIN.md`. En código: el requisito `checklist_ingreso_locacion` pasa a ser salida de `ejecucion_operativa` (migración `20261018110000_alinear_con_demo_main`) y se agregan los requisitos y eventos de **gerenciamiento de viaje** (`flota.gerenciamiento_viaje.aprobado|rechazado`, con `ticketId` y `tipo`). · libs/operaciones/pumping · Flota debe publicar esos eventos (contrato 3). Roles `coordinador_hse` e `ingenieria_ventas_fcr`: siguen retirados (D4).
- 2026-10-16 · Pumping/Comercial · D15(a): `ModuleRoles.catalogosWrite` incluye a Ingeniería de Ventas (altas, ediciones y bajas de bloques, campos, pozos y taladros); permisos `catalogos.ubicacion.*` asignados en la base a `ingenieria_ventas` con historial. · libs/shared/authz/src/lib/module-roles.ts · Aclaración: la rama de inventario real ya estaba fusionada en `main`.
