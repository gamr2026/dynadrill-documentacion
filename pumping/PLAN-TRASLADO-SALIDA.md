# Pumping: Traslado de salida (fase O4) — mapa del proceso y de la base de datos

Fecha: 17/10/2026. Estado: primer tramo construido y **alineado con el `main` de la demo del 08/10/2026** (ver `modulos/04-REVISION-CONTRA-DEMO-MAIN.md`).

## 1. Fuente y hallazgo importante

La demo tiene dos partes que no están al mismo nivel:

- `dynadrill-frontend-platform` (y sus `specs/`) es **más nuevo**: ya incluye términos y condiciones, inspección de vehículos por unidad y "Mantenimiento fuera del flujo".
- `dynadrill-backend` (la copia local, del 24/09) es **más antiguo**. La referencia correcta es el **`main` remoto** de los dos repos (backend 08/10/2026, frontend 07/10/2026), que ya trae todo lo anterior en el backend.

Se toma como autoridad el `main` remoto. Cambios que afectan el mapa:

1. **El paso `mantenimiento` sale del flujo** (`specs/pumping-mantenimiento-fuera-de-flujo`): el ticket va de `traslado_llegada` a `revision_reportes_llegada` y el mantenimiento queda como tarjeta aparte, sin bloquear. Quedan **10 pasos**.
2. **El checklist QHSE de equipos fue reemplazado por la Inspección de Vehículos** (DYN-SGI-RE-068) por unidad: la hace el Operador y la aprueba el Supervisor en la revisión de salida. El dueño de esa inspección es **Flota** (no Mantenimiento).
3. **Términos y condiciones de uso de equipos** (`specs/pumping-terminos-condiciones`): cada operador asignado debe aceptar la versión vigente antes de salir.
4. **Gerenciamiento de Viaje**: lo solicita el Conductor desde su portal (uno de salida y otro de retorno por ticket). **Sí es una condición del ticket**, pero de pasos posteriores: el de salida aprobado para salir de la revisión de reportes de salida y el de retorno para salir del control de retorno.
5. **El checklist de ingreso a locación (gases y LOTO) se hace al inicio de la ejecución**, no en el traslado de salida (commit del 07/10/2026).

## 2. Qué exige el paso Traslado de salida

Para **salir** de Traslado de salida (hacia Revisión de reportes de salida) deben cumplirse todos estos requisitos:

| Requisito | Ámbito | Quién lo cumple | Dueño del dato |
|---|---|---|---|
| Inspección de vehículos realizada | cada unidad **de Transporte** | Operador asignado a esa unidad | Flota (aún no migrada) |
| EPI despachado | cada operador | QHSE despacha | QHSE (aún no migrado) |
| Términos y condiciones aceptados | cada operador | el propio operador | Pumping |
| Reporte de unidad de salida firmado | cada unidad | Operador asignado a esa unidad | Pumping |

Para **salir de Revisión de reportes de salida** se exige además: **gerenciamiento de viaje de salida aprobado** (Flota) y, para pasar a la ejecución, la **inspección de vehículos aprobada** por el Supervisor por cada unidad. Para **salir de la ejecución**: checklist de ingreso a locación completo. Para **salir del control de retorno**: gerenciamiento de viaje de retorno aprobado.

El Reporte de unidad de salida es la firma final del traslado: solo se puede guardar cuando los demás requisitos del paso están cumplidos (así lo hace la demo).

Pendiente de mapear: el bloqueo por **SWA** (Stop Work Authority de QHSE): en la demo `main` solo bloquea el frontend (D10).

## 3. Cómo se modela (para que cada módulo se conecte sin tocar a los demás)

**Un solo mecanismo de requisitos**, en la base, no en el código:

- `requisito` (catálogo): código, nombre, ámbito (`ticket`, `unidad`, `operador`) y módulo dueño (`pumping`, `qhse`, `flota`).
- `paso_requisito`: qué requisitos se exigen para salir de cada paso.
- `ticket_requisito`: una fila por requisito, ticket y (unidad u operador). Estado `pendiente` o `cumplido`, quién y cuándo, y de dónde vino (`sistema`, `evento` o `manual_temporal`).
- Al salir de Asignación se crean las filas del paso siguiente. Avanzar de paso revisa que no quede ninguna pendiente; si falta algo, responde 409 con la lista legible.

**Quién marca un requisito como cumplido:**

- Los de Pumping (checklist de ingreso, términos, reporte de unidad): el propio servicio de Pumping, al guardar.
- Los de otros módulos: **eventos** que esos módulos publicarán. Pumping ya queda suscrito. Contrato (acordado hoy, a implementar en cada módulo):
  - `qhse.epi.despachada` `{ ticketId, usuarioId }` y `qhse.epi.revertida`
  - `flota.inspeccion_vehiculo.realizada` / `.aprobada` `{ ticketId, vehiculoId }`, y `.anulada` / `.rechazada` para reabrirlas
- **Puente temporal** mientras esos módulos no existan: un endpoint protegido con permiso propio que permite marcar uno de esos requisitos con un motivo obligatorio. Queda registrado como `manual_temporal` (quién, cuándo, motivo). Se retira cuando cada módulo publique sus eventos.

**Asignación:** el operador queda emparejado con su unidad (como en la demo), no solo "operadores" y "unidades" por separado.

**Tablas propias de Pumping en este tramo:**

- `terminos_version` (texto, huella SHA-256, vigente) y `aceptacion_terminos` (ticket, cuenta del operador, versión, hora del servidor; inmutable).
- `ticket_ingreso` (cinco confirmaciones), `ticket_ingreso_gas` (lecturas), `ticket_ingreso_loto` (ítems marcados), con catálogos `gas_limite` y `loto_item` (se llenan en la ejecución).
- `reporte_unidad` (una por ticket y unidad) con `reporte_unidad_hubodometro`, `reporte_unidad_llanta` y `reporte_unidad_inspeccion`; catálogo `inspeccion_item` (chasis, motor, equipo, instrumentación).

Todo con FK a catálogos e identidad, enums de PostgreSQL para valores fijos y sin copias de nombre.

## 4. Orden de trabajo

1. Pumping: asignación emparejada, requisitos, paso `mantenimiento` fuera, términos, checklist de ingreso, reporte de unidad de salida, avisos al supervisor, suscripción a los eventos de QHSE y Mantenimiento, puente temporal.
2. Pantallas del ticket.
3. QHSE (EPI, aceptaciones de términos para consulta) en su propio módulo: publica `qhse.epi.*` y retira el puente para ese requisito.
4. Flota (inspección de vehículos): publica `flota.inspeccion_vehiculo.*` y retira el puente.
5. Traslado de llegada reutiliza `reporte_unidad` (columnas de llegada ya previstas).

## 5. Consultas para Dynadrill

- (Resuelta) La inspección de vehículos aplica solo a unidades de tipo Transporte; el catálogo nuevo de vehículos aún no tiene ese tipo, así que hoy se tratan todas como Transporte hasta que exista Flota.
- ¿El texto de Términos y condiciones v1 ya fue validado por QHSE/Legal? (en la demo es un borrador).
- El bloqueo por SWA: ¿se mantiene en el portal nuevo y desde qué módulo se publica?
