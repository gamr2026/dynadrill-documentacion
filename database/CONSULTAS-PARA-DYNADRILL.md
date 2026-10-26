# Consultas para Dynadrill: base de datos y plataforma

Cada módulo escribe en su propia sección. Mientras no haya respuesta se sigue con la opción conservadora indicada.

## Auditoría y firmas

1. **¿Cuántos años debe conservarse el registro de auditoría?** El registro es inmutable y crece con cada evento de negocio. Hoy se conserva todo y no hay particionado ni depuración. Con la respuesta se decide si se particiona por mes y qué se archiva.
2. **¿Qué documentos exigen firma legal (electrónica o manuscrita) y cuáles bastan con «una línea» (usuario y hora)?** Define el método de la evidencia de firma. Hoy cada módulo guarda su firma de una línea.
3. **¿Quién, además del Superadmin, debe poder consultar la auditoría?** Hoy el permiso `auditoria.eventos.ver` es solo del Superadmin y se puede asignar a otros roles desde la pantalla de Roles. El usuario del proyecto confirmó esa opción el 22/10/2026; falta saber si Dynadrill quiere un rol de auditor.
