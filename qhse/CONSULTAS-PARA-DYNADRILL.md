# Consultas para Dynadrill

Dudas de negocio que no se pueden resolver desde el código. Cada módulo anota las suyas en su propia sección (`## <módulo>`); mientras no haya respuesta se avanza con la opción conservadora indicada.

## QHSE

### Q1 — Entrega de EPI y términos y condiciones (16/10/2026)

| # | Consulta | Opción conservadora con la que se avanza | Estado |
|---|---|---|---|
| 1 | **Lista de elementos de EPI y ropa de trabajo** (catálogo del formato DYN-SGI-RE-032). El Excel solo trae la tabla vacía. | Se sembraron 12 elementos habituales (casco, gafas, protector facial, tapones, orejeras, mascarilla o respirador, guantes de nitrilo y de cuero, botas con punta de acero, overol, chaleco reflectivo, arnés). Los de ropa, calzado y guantes exigen talla. QHSE puede ajustar el catálogo (altas y bajas lógicas). | Pendiente |
| 2 | **Columna «Código o cédula»** del formato: ¿es el código del artículo entregado o la cédula del trabajador? El Excel no lo aclara. | La cédula sale del perfil de la cuenta (no se captura). El renglón guarda solo el **código del artículo** (opcional); si está vacío, la hoja imprimible muestra la cédula del trabajador. | Pendiente |
| 3 | **Quién firma la declaración del trabajador** («Firmo y acepto ser responsable…»): el trabajador está presente al recibir el EPI, pero puede no tener una sesión abierta. | La registra Técnico HSE o Gerente HSE como «firma de una línea» (cuenta de quien la registra y hora del servidor); la firma manuscrita queda diferida (D6). Para despachar hacen falta: al menos un elemento, el lugar y esta declaración. | Pendiente |
| 4 | **«Recibe conforme Talento Humano»**: ¿lo firma una cuenta de Talento Humano? Hoy no existe ese rol en el portal. | Lo registra Técnico HSE o Gerente HSE después del despacho (no bloquea nada). Si Dynadrill quiere un rol de Talento Humano, es un cambio global de roles (regla 6). | Pendiente |
| 5 | **Revertir un despacho** hecho por error: ¿lo puede hacer QHSE? Reabre el requisito del ticket en Pumping. | Sí, con motivo obligatorio; queda en el historial de la entrega. | Pendiente |
| 6 | **Validación del texto de Términos y condiciones** (D9): ¿quién lo aprueba (QHSE, Legal, Talento Humano)? | La v1 de la demo es un borrador; se publican versiones nuevas con huella y no se edita una ya aceptada. | Pendiente |
| 7 | **Operadores sin cuenta**: en la demo los operadores no eran cuentas y se capturaba su cédula. En el portal nuevo cada operador es una cuenta (cédula del perfil de AS2). ¿Hay operadores de campo que no estén en AS2? | Se exige cuenta activa para abrir su EPI; sin cuenta no se abre la solicitud. | Pendiente |
