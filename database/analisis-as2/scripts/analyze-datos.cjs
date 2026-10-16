// Cruce de AS2_Datos_Extraidos.xlsx con los contactos y usuarios de la demo. Solo lectura.
// Imprime agregados y muestras mínimas (nunca cédulas).
const ExcelJS = require('C:/Users/Digitec/Documents/proyectos/dynadrill/dynadrill-frontend-platform/node_modules/exceljs');
const { DatabaseSync } = require('node:sqlite');

const [xlsxPath, demoDb] = process.argv.slice(2);

const text = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if (v.text) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return JSON.stringify(v);
  }
  return String(v);
};
const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(ing|lic|dr|dra|sr|sra|msc|abg|tlgo)\b\.?/g, ' ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const toks = (s) => norm(s).split(' ').filter((w) => w.length > 1);
const bag = (s) => toks(s).sort().join(' ');
/** Todas las palabras del nombre más corto están en el más largo (mín. 2 palabras): tolera 2º nombre/apellido. */
const subset = (a, b) => {
  const A = toks(a), B = toks(b);
  const [small, big] = A.length <= B.length ? [A, B] : [B, A];
  return small.length >= 2 && small.every((w) => big.includes(w));
};
const count = (arr, f) => {
  const m = new Map();
  for (const x of arr) m.set(f(x), (m.get(f(x)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const show = (t, e, n = 10) => {
  console.log(`\n  ${t}`);
  for (const [k, v] of e.slice(0, n)) console.log(`    ${String(k === '' ? '(vacío)' : k).padEnd(44)} ${v}`);
  if (e.length > n) console.log(`    … y ${e.length - n} más`);
};

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const hoja = (name) => {
    const ws = wb.getWorksheet(name);
    const cols = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (cols[i - 1] = text(c.value).trim()));
    const out = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const o = {};
      cols.forEach((c, i) => (o[c] = text(ws.getRow(r).getCell(i + 1).value).trim()));
      if (Object.values(o).some((v) => v)) out.push(o);
    }
    return out;
  };
  const agentesAs2 = hoja('Agentes Comerciales');
  const clientes = hoja('Clientes');
  const usuariosAs2 = hoja('Usuarios');
  const empleados = hoja('Empleados');
  const rubro = hoja('Rubro Empleado');
  const bodegas = hoja('Bodegas');
  const secuencias = hoja('Secuencias');

  const db = new DatabaseSync(demoDb, { readOnly: true });
  const personas = db.prepare('select tipo, nombre, cedula from personas_contacto').all();
  const usuariosPortal = db.prepare('select id, name, username, email, cedula, cargo, departamento, fechaIngreso, tipoContrato from users').all();
  const agentes = personas.filter((p) => p.tipo === 'agente_comercial');
  const analistas = personas.filter((p) => p.tipo === 'analista_facturacion');

  console.log(`FILAS: agentes=${agentesAs2.length} bodegas=${bodegas.length} secuencias=${secuencias.length} clientes=${clientes.length} usuariosAS2=${usuariosAs2.length} empleados=${empleados.length} rubroEmpleado=${rubro.length}`);

  // ---------------- A. Agentes comerciales
  console.log('\n=== A. AGENTES COMERCIALES de AS2 (' + agentesAs2.length + ') vs nuestros 25');
  const nombresAgAs2 = agentesAs2.map((a) => a['Agente Comercial']);
  let exa = 0, par = 0; const sin = [];
  for (const a of agentes) {
    if (nombresAgAs2.some((n) => bag(n) === bag(a.nombre))) exa++;
    else if (nombresAgAs2.some((n) => subset(n, a.nombre))) par++;
    else sin.push(a.nombre);
  }
  console.log(`  coincidencia exacta: ${exa} | parcial (2º nombre/apellido): ${par} | sin coincidencia: ${sin.length}`);
  console.log('  nuestros agentes que NO están en AS2:', sin.join(', '));
  const faltantes = nombresAgAs2.filter((n) => !agentes.some((a) => bag(n) === bag(a.nombre) || subset(n, a.nombre)));
  console.log(`  agentes de AS2 que NO tenemos en el portal (${faltantes.length}):`, faltantes.slice(0, 12).join(' · '));

  // ---------------- B. Usuarios AS2
  console.log('\n=== B. USUARIOS de AS2 (' + usuariosAs2.length + ')');
  show('por rol', count(usuariosAs2.flatMap((u) => (u['Roles'] || '(sin rol)').split(',').map((x) => x.trim())), (x) => x), 12);
  console.log(`  activos: ${usuariosAs2.filter((u) => u['Activo'] === 'Sí').length} | bloqueados: ${usuariosAs2.filter((u) => u['Bloqueado'] === 'Sí').length} | con género: ${usuariosAs2.filter((u) => u['Género']).length}`);
  const loginsAs2 = new Map(usuariosAs2.map((u) => [u['Usuario'].toLowerCase(), u]));
  const resolver = (p) => {
    const login = loginsAs2.get(p.nombre.toLowerCase().replace(/\s/g, ''));
    if (login) return ['usuario AS2 (login)', login];
    const full = usuariosAs2.find((u) => bag(`${u['Nombre(s)']} ${u['Apellido(s)']}`) === bag(p.nombre));
    if (full) return ['usuario AS2 (nombre)', full];
    const par = usuariosAs2.filter((u) => subset(`${u['Nombre(s)']} ${u['Apellido(s)']}`, p.nombre));
    if (par.length === 1) return ['usuario AS2 (parcial)', par[0]];
    return [par.length > 1 ? `ambiguo (${par.length})` : 'sin coincidencia', null];
  };
  for (const [titulo, lista] of [['agentes comerciales', agentes], ['analistas de facturación', analistas]]) {
    const r = count(lista, (p) => resolver(p)[0]);
    console.log(`  ${titulo} (${lista.length}) →`, r.map(([k, v]) => `${k}: ${v}`).join(' | '));
  }
  const rolesDeAgentes = count(agentes.map((p) => resolver(p)[1]).filter(Boolean), (u) => u['Roles'] || '(sin rol)');
  console.log('  roles de AS2 de los agentes que se encontraron:', rolesDeAgentes.map(([k, v]) => `${k}=${v}`).join(', '));

  // ---------------- C. Empleados
  console.log('\n=== C. EMPLEADOS de AS2 (' + empleados.length + '): los campos de RRHH de nuestro usuario_perfil');
  console.log('  columnas:', Object.keys(empleados[0]).join(', '));
  show('departamento', count(empleados, (e) => e['Departamento']), 8);
  show('cargo (agregado)', count(empleados, (e) => e['Cargo'].replace(/\s+/g, ' ').trim()), 12);
  show('tipo de contrato', count(empleados, (e) => e['Tipo Contrato']), 6);
  show('sucursal', count(empleados, (e) => e['Sucursal']), 4);
  console.log(`  activos: ${empleados.filter((e) => e['Activo'] === 'Sí').length} | con fecha de salida: ${empleados.filter((e) => e['Fecha Salida']).length} | con discapacidad: ${empleados.filter((e) => e['Tipo Discapacidad']).length} | cargas > 0: ${empleados.filter((e) => +e['Cargas Activas'] > 0).length} | con centro de costo: ${empleados.filter((e) => e['Centro de Costo']).length}`);
  const empPorCedula = new Map(empleados.map((e) => [e['Identificación'], e]));
  const empPorNombre = empleados.map((e) => ({ e, nombre: `${e['Nombres']} ${e['Apellidos']}` }));
  console.log('\n  --- cruce con los 24 USUARIOS del portal');
  let uCed = 0, uNom = 0;
  const sinMatchU = [];
  for (const u of usuariosPortal) {
    if (u.cedula && empPorCedula.has(u.cedula)) uCed++;
    else if (empPorNombre.some((x) => bag(x.nombre) === bag(u.name) || subset(x.nombre, u.name))) uNom++;
    else sinMatchU.push(u.name);
  }
  console.log(`  por cédula: ${uCed} | por nombre: ${uNom} | sin coincidencia: ${sinMatchU.length} → ${sinMatchU.join(', ')}`);
  console.log(`  usuarios del portal que ya traen datos de RRHH: ${usuariosPortal.filter((u) => u.cedula || u.cargo).length}`);
  console.log('\n  --- cruce de agentes/analistas con EMPLEADOS');
  for (const [titulo, lista] of [['agentes', agentes], ['analistas', analistas]]) {
    const m = lista.filter((p) => empPorNombre.some((x) => bag(x.nombre) === bag(p.nombre) || subset(x.nombre, p.nombre)));
    console.log(`  ${titulo}: ${m.length}/${lista.length} aparecen como empleados`);
  }
  console.log('  cargos de los analistas de facturación encontrados:', analistas.map((p) => empPorNombre.find((x) => subset(x.nombre, p.nombre)))
    .filter(Boolean).map((x) => x.e['Cargo'].trim()).join(' · ') || '(ninguno)');

  // ---------------- D. Clientes
  console.log('\n=== D. CLIENTES de AS2 (' + clientes.length + '): columnas nuevas frente al otro export');
  console.log('  columnas:', Object.keys(clientes[0]).join(', '));
  const conAgente = clientes.filter((c) => c['Agente Comercial']);
  console.log(`  clientes con Agente Comercial asignado: ${conAgente.length}/${clientes.length}`);
  show('  agente comercial → n° de clientes', count(conAgente, (c) => c['Agente Comercial']), 10);
  show('tipo de cliente', count(clientes, (c) => c['Tipo Cliente']), 5);
  console.log(`  bloqueados: ${clientes.filter((c) => c['Cliente Bloqueado'] === 'Sí').length} | con crédito máximo>0: ${clientes.filter((c) => +c['Crédito Máximo'] > 0).length} | con saldo anticipo≠0: ${clientes.filter((c) => +c['Saldo Anticipo'] !== 0).length} | con morosidad>0: ${clientes.filter((c) => +c['% Morosidad'] > 0).length}`);
  const agentesDeClientes = [...new Set(conAgente.map((c) => c['Agente Comercial']))];
  console.log(`  agentes distintos asignados a clientes: ${agentesDeClientes.length} (¿están en la hoja de Agentes? ${agentesDeClientes.filter((n) => nombresAgAs2.some((x) => bag(x) === bag(n))).length}/${agentesDeClientes.length})`);
  const nuestros = db.prepare('select identificacion i from clientes_catalogo').all().map((r) => r.i.trim());
  console.log(`  los clientes de esta hoja que ya están en nuestro portal (por identificación): ${clientes.filter((c) => nuestros.includes(c['Identificación'].trim())).length}/${clientes.length}`);

  // ---------------- E. Rubro empleado
  console.log('\n=== E. RUBRO EMPLEADO (' + rubro.length + ') vs EMPLEADOS (' + empleados.length + ')');
  const enEmpleados = rubro.filter((r) => empPorCedula.has(r['Identificación']));
  console.log(`  coinciden por cédula con Empleados: ${enEmpleados.length} | solo en Rubro: ${rubro.length - enEmpleados.length} | activos en Rubro: ${rubro.filter((r) => r['Activo'] === 'Sí').length}`);

  // ---------------- F. Bodegas y secuencias
  console.log('\n=== F. BODEGAS (' + bodegas.length + ')');
  console.log('  ' + bodegas.map((b) => b['Bodega']).join(' · '));
  console.log('\n=== SECUENCIAS (' + secuencias.length + '): numeración de documentos de AS2');
  show('prefijos (muestra)', count(secuencias, (s) => `${s['Prefijo']} → ${s['Nombre']}`), 14);
})().catch((e) => {
  console.error('ERROR', e.stack);
  process.exit(1);
});
