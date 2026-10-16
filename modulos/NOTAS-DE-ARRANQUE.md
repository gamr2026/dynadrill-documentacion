# Notas de arranque (texto listo para pegar al abrir cada sesión)

Pegue el bloque **común** y después el bloque del módulo. Cambie la lista de "otras sesiones" según las que estén abiertas.

---

## Bloque común

```
Usted construye UN módulo del backend nuevo de Dynadrill (monorepo C:\Users\Digitec\Documents\proyectos\dynadrill-platform) y de su frontend (C:\Users\Digitec\Documents\proyectos\dynadrill\dynadrill-frontend-platform). Hay otras sesiones construyendo otros módulos AL MISMO TIEMPO, en la misma máquina, el mismo repositorio y la misma base de datos de desarrollo.

Antes de escribir código, lea en este orden, en C:\Users\Digitec\Documents\proyectos\documentacion\modulos\:
1. README.md
2. 00-CONTEXTO-COMPARTIDO.md  (arquitectura y reglas que no se negocian)
3. 01-REGLAS-DE-COORDINACION.md  (archivos compartidos, bloqueos, registro de cambios)
4. 02-CONTRATOS-ENTRE-MODULOS.md  (eventos y APIs que unen los módulos)
5. 03-DECISIONES-PENDIENTES.md
6. 04-REVISION-CONTRA-DEMO-MAIN.md  (la referencia de la demo es el main REMOTO de los dos repos, no las carpetas locales, que están desactualizadas)
7. el plan de su módulo (abajo)

Reglas de oro: (a) no modifique código de otro módulo; (b) base de datos normalizada: FK a catálogos, enums de PostgreSQL, cero JSON, cero copias de nombre; (c) responda siempre en español con "usted"; (d) no haga commits ni suba nada sin que el usuario lo pida; (e) nunca imprima tokens, claves ni .env; (f) una sola verificación pesada (nx, ng build, ng test) a la vez en toda la máquina: use el bloqueo de .bloqueos\; (g) la demo es de solo lectura y su referencia es el MAIN REMOTO de dynadrill-backend y dynadrill-frontend en GitHub (clónelo en una carpeta temporal para leerlo; las carpetas locales están desactualizadas); (h) todos los correos de prueba salen solo a gustavo_morales@digitec.com.ec; (i) las dudas de negocio se anotan como consultas y usted avanza con la opción conservadora; (j) cada vez que cambie un archivo compartido o un contrato, agregue una entrada a REGISTRO-DE-CAMBIOS-COMPARTIDOS.md.

Módulo de referencia para copiar patrones: libs/operaciones/pumping (y libs/comercial/pedidos). Entregue por tramos: migración aplicada, semilla, pruebas de integración con base real, lint y build, pantalla funcionando, contenedor reiniciado, plan actualizado y mensaje final con lo que quedó, lo que falta y las decisiones que necesita del usuario.
```

## Por módulo

### Flota
```
Su módulo es FLOTA. Lea plan-flota.md. Otras sesiones: Mantenimiento (depende de usted), QHSE, Inventario y la sesión principal de Pumping (usted le publica los eventos flota.inspeccion_vehiculo.* del contrato 3). Empiece por el tramo F1 (unidades y lecturas).
```

### Mantenimiento
```
Su módulo es MANTENIMIENTO. Lea plan-mantenimiento.md y plan-flota.md. Otras sesiones: Flota (dueña de la unidad y de sus lecturas: usted usa su servicio, no escribe sus tablas), QHSE, Inventario y Pumping (publica el reporte de unidad de llegada, contrato 4.2). Empiece por el diseño y el tramo M1 mientras Flota termina F1.
```

### QHSE
```
Su módulo es QHSE. Lea plan-qhse.md y documentacion\PLAN-QHSE-PUMPING-NOTIFICACIONES.md. Otras sesiones: Flota, Mantenimiento, Inventario y la sesión principal de Pumping (espera de usted los eventos qhse.epi.* del contrato 3; las aceptaciones de términos las guarda Pumping). Usted crea el contenedor qhse (puerto 3104) y cambia el prefijo del gateway a /api/v2/qhse. Empiece por el tramo Q1 (contenedor, EPI y consulta de términos).
```

### Inventario
```
Su módulo es INVENTARIO. Lea plan-inventario.md. Otras sesiones: Flota, Mantenimiento, QHSE y Pumping (usará su servicio de salidas de químicos, contrato 4.1; no duplique datos de la unidad, son de Flota). Empiece por el tramo I1 (catálogo y kardex inmutable).
```

### FCR (Ola 2)
```
Su módulo es FCR. Lea plan-fcr.md. Necesita Inventario, Flota y el primer tramo de QHSE ya construidos. Use libs/operaciones/pumping como referencia, sin modificarlo.
```

### Firmas y Auditoría (Ola 2)
```
Su módulo es FIRMAS Y AUDITORÍA (contenedor plataforma). Lea plan-firmas-y-auditoria.md. Un cambio en la plataforma obliga a todas las demás sesiones a reconstruir: avise en el registro. Empiece por el tramo A1 (auditoría).
```

### Reportería y Dashboard (Ola 3)
```
Su módulo es REPORTERÍA Y DASHBOARD (contenedor worker). Lea plan-reporting-dashboard.md. Consume eventos de todos; no le pida a otros módulos que cambien: pida lo que falte por el registro.
```

---

## Una nota para el usuario

- Abra primero las sesiones de la **Ola 1** (Flota+Mantenimiento, QHSE, Inventario). Mantenga abierta esta sesión de Pumping: ella mantiene los contratos y retira el puente temporal cada vez que un módulo publica sus eventos.
- Si una sesión necesita algo de otra y no es urgente, que lo escriba en el registro: no hace falta que usted las comunique en vivo.
- Cuando el usuario autorice commits, conviene una rama o *worktree* por módulo (regla 7 de coordinación).
