# Análisis de datos de AS2: personas, clientes y representantes

> Fecha: 13/10/2026. Objetivo: usar la información extraída de AS2 (el ERP de Dynadrill) y del control de tickets para rediseñar `persona_contacto` y `cliente` y para preparar las cuentas reales de los empleados. Es un análisis de **solo lectura**: no se modificó ningún archivo ni base de datos. No contiene cédulas, teléfonos ni correos; los scripts que lo produjeron están en `analisis-as2/scripts/`.

## 1. Fuentes analizadas

| Archivo | Contenido | Utilidad |
|---|---|---|
| `Downloads/info gente dynadrill/empresas_p1..p9.xlsx` | Maestro de Empresas de AS2: 4.491 filas (clientes y proveedores) | Enriquecer `cliente` |
| `Downloads/info gente dynadrill/listaDescuentos*.xlsx` | Dos listas de descuentos (`GENERAL`, `NORMAL`) sin valores | Solo indica que AS2 maneja descuentos por producto |
| `Downloads/AS2_Datos_Extraidos.xlsx` | 7 hojas: Agentes Comerciales (21), Usuarios (84), Empleados (96), Rubro Empleado (162), Clientes (62), Bodegas (11), Secuencias (79) | Personas internas, clientes y catálogos de AS2 |
| `documentacion/facturacion/Secuencial Tk Control EXP 2025201 - 2026.xlsx` | Hoja `TK` (660 tickets, 1/1/2026 a 26/8/2026) y hoja `BD` (listas de representantes) | Origen de los contactos y vínculo cliente ↔ representante |
| `dynadrill-backend/prisma/dynadrill.db` | Datos actuales de la demo (SQLite) | Línea base contra la que se compara |

## 2. Resumen de hallazgos

1. **Los 61 clientes de la demo existen en AS2** (100 % por identificación). AS2 aporta datos que hoy no tenemos: código AS2, categoría, tipo de persona, crédito, retención y agente asignado.
2. **Los representantes de campo y de Quito no existen en AS2.** Su única fuente es el control de tickets (`TK`/`BD`), y nuestro catálogo está **incompleto**: de 166 Company Man de `BD` solo se importaron 59.
3. **Cada representante de campo aparece con un solo cliente** en los tickets (154 de 154), de modo que el vínculo con el cliente se puede reconstruir.
4. **Analistas, agentes y supervisores son empleados de AS2.** El catálogo actual de analistas sale tal cual de la columna `Analista` de `TK`.
5. **De los 24 usuarios del portal, solo 6 son personas reales.** Los otros 18 son cuentas de simulación de un rol.
6. **Decisión de negocio (13/10/2026):** cada empleado tendrá su cuenta real y se retiran las cuentas de simulación. Por eso **no hace falta una tabla `persona_interna`**: basta `usuario` + `usuario_perfil`.

## 3. Clientes

- AS2 tiene 62 clientes (flag `Cliente = true`, de 4.491 filas: el resto son 4.465 proveedores). **61 ya están en el portal**; falta 1.
- Datos nuevos por cliente: **código AS2** (difiere de la identificación en 253 filas, por ejemplo 10 dígitos frente a un RUC de 13), **categoría** (`CLIENTE` 20, `CLIENTE-PROVEEDOR` 26...), **tipo de persona** (natural o jurídica), banderas cliente/proveedor/entidad pública, **crédito máximo/disponible/utilizado** (46 clientes con crédito), emite retención, sucursal (todos COCA), tipo de cliente y morosidad.
- **EP Petroecuador** tiene **un solo registro** en AS2 (RUC 1768153530001, entidad pública). Las tres variantes de nombre de los pedidos son texto libre del portal, y de ahí vino el bug de la prefactura en $0.
- Solo **9 de 62** clientes tienen agente comercial asignado (Ruiz Jumbo Carlos Javier 5, Yépez Ruiz Carla Fernanda 4).
- Calidad: 53 RUC, 4 cédulas, 4 pasaportes de largo variable (5 a 10 dígitos) y mezcla de empresas con personas naturales.
- El campo `Nota` casi no sirve (561 de 733 dicen "CLIENTE CREADO EN PUNTO DE VENTA"). AS2 no trae teléfono, correo ni dirección.

## 4. Representantes de campo y de Quito

| | Catálogo actual | `BD` | `TK` (2026) |
|---|---|---|---|
| Representante de campo (Company Man) | 59 (con cédula) | 166 | 154 crudos, 144 personas |
| Representante de Quito | 30 | 30 | 53 crudos, 48 personas |

- El catálogo de campo es un subconjunto de `BD`: **faltan 107**. Además, 70 nombres de `TK` no están ni en `BD`. Sumando `BD` y `TK` hay unos **229 representantes de campo** y unos **55 de Quito**.
- Las 59 cédulas existen solo para el catálogo antiguo. No hay cédula, teléfono ni correo para los demás, ni en AS2 ni en `TK`.
- **Vínculo con el cliente:** representante de campo, 154 de 154 con un solo cliente; Quito, 51 de 53 (excepciones: Lorena Zapata y Amanda Castillo, con dos).

| Cliente | Tickets | Rep. campo | Rep. Quito |
|---|---|---|---|
| EP Petroecuador | 595 | 112 | 31 |
| Schlumberger | 18 | 11 | 9 |
| Wayraenergy | 16 | 9 | 3 |
| Servicios Pañaturi | 11 | 3 | 3 |
| Ecuaservoil, Gente Oil, Petrobell, Baker Hughes, PCR Ecuador, Incopet | 1 a 5 cada uno | 1 a 4 | 0 a 1 |

- **Variantes de escritura** que hay que normalizar: `Ing.` presente o ausente, tildes y mayúsculas (`Ivan Minda` y `Ing. Ivan Minda`). Los títulos deben guardarse aparte del nombre.
- **Límites:** `TK` cubre ocho meses y solo 11 de los 61 clientes. Los 107 Company Man de `BD` que no aparecen en `TK` quedan sin cliente deducible. Los nombres de cliente en `TK` son cortos y hay que mapearlos a su RUC.

## 5. Analistas, agentes comerciales y supervisores

**Analistas** (columna `Analista` de `TK`, 9 valores = los 9 de nuestro catálogo):

| Analista | Tickets | Persona en AS2 | Cargo | Sucursal |
|---|---|---|---|---|
| Ilda | 221 | Ilda Zambrano | Especialista de Facturación I | Coca |
| Elsa | 210 | Elsa Villalta | Especialista de Facturación I | Coca |
| Irvin | 153 | Irvin Coral | Especialista de Facturación I | Quito |
| Mónica | 28 | Mónica Cáceres | Jefe de Pre Facturación | Quito |
| Ricardo + RIcardo | 20 | Ricardo Vallejo | Especialista de Facturación III | Coca |
| Hermes | 8 | Hermes Páez | **Operador de Fluidos** (anomalía) | Coca |
| Iván | 5 | Iván Casanova | Solo usuario AS2, no está en Empleados | — |
| n/a | 8 | — | — | — |

- Otros 7 tickets no tienen analista. `Ricardo` y `RIcardo` son la misma persona.
- **Hermes e Iván deben validarse con Facturación y RRHH.**
- El analista **no está fijo por cliente**: varía por ticket (en EP Petroecuador intervinieron 9). Es un atributo del ticket o de la prefactura.

**Agentes comerciales** (`Dyna_Ventas`): 13 valores crudos son 11 personas (Carlos Ortiz, Nilo Morales, Verónica Romero, Ángel Martínez, Carlos Ruiz, Darío Saeteros, Carla Yépez, July Ana Masache, Carlos Castro, Víctor Bastidas...). Nueve están en la hoja de agentes de AS2. De los 25 agentes del catálogo actual, 23 se resuelven contra AS2 (usuarios, empleados o exempleados), pero con nombres cortos o logins (`Mcaceres`, `Narvaezoru`). Tampoco están fijos por cliente.

**Supervisor/Operador asignado:** 59 personas, de las cuales **50 son empleados de AS2** (Especialista de Campo, Operador CTU, Auxiliar de Operaciones, Ingeniero Trainee...), 6 son exempleados y 3 no se encuentran (`CONSULTOR`, Omar Sanabria, Jeferson Vaca).

## 6. Empleados de AS2

La hoja `Empleados` (96, todos activos, sin fecha de salida) contiene casi exactamente los campos de `usuario_perfil`: identificación, nacionalidad, apellidos y nombres, cargo, departamento, área, fecha de ingreso, tipo de contrato, sucursal, discapacidad, cargas, categoría, centro de costo y activo.

- Departamentos: Operaciones 78, Administrativo 12, Ventas 6. Sucursales: Coca 78, Quito 18. Contratos: por obra 49, productivo continuo 47. Hay 47 cargos distintos.
- `Rubro Empleado` (162) es un superconjunto: los 96 activos más 66 inactivos (exempleados).
- `Usuarios` de AS2 (84) aporta login, género, estado y roles de AS2 (Contador General 25, Asistente Contable 23, Administrador 11...). **Esos roles no equivalen a los 17 del portal.**
- AS2 **no trae correo ni teléfono** de ningún empleado.

## 7. Cuentas reales de los empleados

### Los 8 responsables conocidos

| Persona | Rol indicado | Qué dice AS2 | Cuenta de simulación a reemplazar | Rol del portal |
|---|---|---|---|---|
| César Vinicio Saeteros Andrade | Jefe de Base Pumping | Empleado `JEFE DE BASE`, usuario `SAETEROSACV` | #1 `admin@`, #8 `jefebase@` | `jefe_base` |
| Mónica Elizabeth Cáceres Vásquez | Jefe Facturación | `JEFE DE PRE FACTURACIÓN`, usuario `MCACERES` | Ya tiene cuenta real (#16) | `facturacion` |
| Edwin Javier Culqui Guananga | Jefe QHSE | `GERENTE DE QHSE` | Ya tiene cuenta real (#21) | `gerente_hse` |
| José Antonio Ávila Loor | Jefe de mantenimiento | `TÉCNICO DE MANTENIMIENTO`, usuario `JOSE AVILA` | #4 `jefe.mantenimiento@` | `jefe_mantenimiento` |
| Franklin Alfonso Pincay Zambrano | Supervisor FCR | `JEFE DE TALLER`, usuario `FRANK PINCAY` | #19 o #2/#9 | `supervisor_operaciones_fcr` o `supervisor` (por definir) |
| Stefano Adrián Egas Coello | Responsable S2A | `TÉCNICO TIC`, usuario AS2 **Administrador** | #15 `superadmin@` | `superadmin` |
| Juan Carlos Santamaría Lema | Coordinador del Proyecto | No está en Empleados; usuario AS2 activo; inactivo en Rubro | ninguna | Sin equivalente (`tipo_vinculo` externo o contratista) |
| Francisco León | Marketing | No aparece en AS2 | ninguna | Sin equivalente |

**Discrepancias:** los cargos de AS2 de Pincay, Ávila y Culqui no coinciden con su función real. El rol del portal debe confirmarse persona por persona, no deducirse del cargo.

### Borrador de rol por cargo (aproximado, a validar)

| Rol del portal | Personas | Cargos de AS2 |
|---|---|---|
| `operador` | ~35 (+7 especialistas de campo ambiguos) | Operadores CTU, fluidos, cementación, auxiliar de operaciones, ingenieros trainee |
| `operador_fcr` | 7 | Operadores Fishing, especialistas de campo FCR |
| `operador_mantenimiento` | 9 | Mecánicos, soldadores, técnico de mantenimiento |
| `ingenieria_ventas` | 7 | Ingenieros de ventas, representante de ventas |
| `facturacion` | 6 | Especialistas y jefe de facturación |
| `bodeguero` | 4 | Bodegueros, despachador, auxiliar de base |
| `tecnico_hse` / `gerente_hse` | 3 / 1 | QHSE |
| `jefe_base` | 1 | César Saeteros |
| **Sin rol claro** | **~15** | Contadores, compras, talento humano, TIC, asistentes administrativos, laboratorio |

### Lo que falta para crear las ~96 cuentas

1. **Correos:** AS2 no los trae. Las cuentas reales actuales usan el patrón inicial + apellido (`eculqui@`, `despejo@`, `cherrera@`, `hchiriboga@`), que se puede proponer para que RRHH lo corrija.
2. **Rol por persona**, confirmado por RRHH o el jefe de área.
3. **Decisión sobre el personal administrativo** (~15 sin rol operativo): si reciben cuenta y con qué permisos.
4. **Cambio de clave obligatorio en el primer ingreso**: **no existe todavía** (falta un campo y un endpoint). La alternativa es Microsoft Entra ID, opción A del documento de arquitectura.
5. **Puente con los módulos viejos:** las cuentas reales nuevas no tienen `legacy_id`, así que la demo las rechazaría. Opciones: reutilizar las cuentas de simulación (cambiando correo, nombre y cédula, conservan su `legacy_id`) o crear filas espejo en la demo. La demo solo tiene 10 registros que apuntan a usuarios (subórdenes de los mecánicos de prueba), datos descartables.

## 8. Implicaciones de diseño

1. **`cliente`** se enriquece desde AS2: `codigo_as2`, `categoria`, `tipo_persona`, `es_entidad_publica`, `es_proveedor`, `credito_maximo`, `emite_retencion` y `origen` (`as2` o `portal`). Los datos de crédito son de solo lectura, con fecha de sincronización, porque se calculan en AS2. Importar **solo** los 62 clientes, no el maestro completo.
2. **`contacto_cliente`** (representantes de campo y de Quito) se reconstruye desde `TK` y `BD`: ~285 personas con `cliente_id` deducido, nombre normalizado, título aparte y cédula solo para los 59 antiguos. Los 107 sin cliente deducible quedan con `cliente_id` vacío. Teléfono, correo y cargo se capturan en el portal.
3. **Analista, agente comercial y supervisor se guardan por ticket o pedido**, referenciando `usuario` (cuentas reales), no por cliente.
4. **`usuario_perfil`** se puebla desde `Empleados` para quienes tengan cuenta. No importar a los 66 exempleados; si un ticket histórico menciona a alguien que ya no está, guardar su nombre como texto.
5. **Clave de cruce:** código AS2 o cédula para empleados; identificación (nunca el nombre) para clientes; nombre normalizado más cliente para representantes.
6. **Bodegas (11) y Secuencias (79)** de AS2 alimentan los módulos de Inventario y de numeración de documentos.

## 9. Precauciones

- **Datos personales (LOPDP).** `Empleados` contiene cédulas, discapacidad y cargas familiares. Cargar solo a quienes tendrán cuenta y restringir el acceso.
- **Coincidencias por nombre.** Los cruces con AS2 son aproximados; 15 de los agentes son coincidencias parciales. Hermes e Iván son hipótesis a confirmar.
- **Vigencia.** Los archivos son instantáneas de septiembre y octubre de 2026.

## 10. Cómo se reproduce

Los scripts están en `analisis-as2/scripts/` (Node, solo lectura). Dependen de rutas absolutas de esta máquina y de la librería `exceljs` del frontend; ajustar las rutas al ejecutarlos en otro entorno.

| Script | Qué hace |
|---|---|
| `inspect-as2.cjs`, `analyze-as2.cjs`, `analyze-as2-personas.cjs` | Maestro de Empresas: estructura, calidad y cruce con clientes y contactos |
| `inspect-datos.cjs`, `analyze-datos.cjs`, `analyze-datos2.cjs` | `AS2_Datos_Extraidos.xlsx` frente a contactos y usuarios |
| `inspect-tk.cjs`, `analyze-tk.cjs`, `analyze-tk2.cjs` | Control de tickets: analistas, representantes y su vínculo con el cliente |
| `analyze-cuentas.cjs`, `lookup-conocidos.cjs` | Cargos frente a roles del portal y búsqueda de los 8 responsables |
