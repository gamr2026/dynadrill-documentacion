// ¿Qué implica dar cuenta real a cada empleado? Cargos de AS2 vs roles del portal y cuentas de prueba. Solo lectura.
const ExcelJS = require('C:/Users/Digitec/Documents/proyectos/dynadrill/dynadrill-frontend-platform/node_modules/exceljs');
const { DatabaseSync } = require('node:sqlite');
const [as2Path, demoDb] = process.argv.slice(2);

const text = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if (v.text) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    return JSON.stringify(v);
  }
  return String(v);
};
const sinTilde = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(as2Path);
  const leer = (n) => {
    const ws = wb.getWorksheet(n);
    const cols = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (cols[i - 1] = text(c.value).trim()));
    const out = [];
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      if (r === 1) return;
      const o = {};
      cols.forEach((c, i) => c && (o[c] = text(row.getCell(i + 1).value).trim()));
      out.push(o);
    });
    return out;
  };
  const emp = leer('Empleados');
  const usr = leer('Usuarios');

  console.log('=== CARGOS de los 96 empleados (todos), con departamento y sucursal');
  const cargos = new Map();
  for (const e of emp) {
    const k = e['Cargo'].replace(/\s+/g, ' ').trim();
    const o = cargos.get(k) ?? { n: 0, dep: new Set(), suc: new Set() };
    o.n++; o.dep.add(e['Departamento']); o.suc.add(e['Sucursal']);
    cargos.set(k, o);
  }
  for (const [k, o] of [...cargos.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${String(o.n).padStart(2)}  ${k.padEnd(46)} ${[...o.dep].join('/')} · ${[...o.suc].join('/')}`);
  }

  console.log('\n=== Direcciones y mandos (jefes, supervisores, gerentes, coordinadores)');
  for (const e of emp.filter((x) => /jefe|supervis|gerent|coordin|director|lider/i.test(x['Cargo']))) {
    console.log(`  ${(e['Nombres'] + ' ' + e['Apellidos']).padEnd(40)} ${e['Cargo'].trim()} [${e['Departamento']}, ${e['Sucursal']}]`);
  }

  console.log('\n=== Saeteros en AS2');
  for (const e of emp.filter((x) => /saeteros/i.test(x['Apellidos']))) console.log(`  EMPLEADO: ${e['Nombres']} ${e['Apellidos']} · ${e['Cargo'].trim()} [${e['Departamento']}, ${e['Sucursal']}]`);
  for (const u of usr.filter((x) => /saeteros/i.test(x['Apellido(s)']))) console.log(`  USUARIO AS2: ${u['Usuario']} · ${u['Nombre(s)']} ${u['Apellido(s)']} · roles: ${u['Roles'] || '-'}`);

  console.log('\n=== Empleados que son usuarios de AS2 (por nombre y apellido) vs los que no');
  const enAs2 = emp.filter((e) => usr.some((u) => sinTilde(u['Apellido(s)']).split(' ')[0] === sinTilde(e['Apellidos']).split(' ')[0] && sinTilde(u['Nombre(s)']).split(' ')[0] === sinTilde(e['Nombres']).split(' ')[0]));
  console.log(`  empleados con usuario en AS2: ${enAs2.length}/${emp.length} | sin usuario en AS2: ${emp.length - enAs2.length}`);

  console.log('\n=== Datos que NO trae AS2 y se necesitan para crear cuentas');
  console.log('  columnas de Empleados :', Object.keys(emp[0]).join(', '));
  console.log('  columnas de Usuarios  :', Object.keys(usr[0]).join(', '));
  console.log('  → no hay correo electrónico ni teléfono de ningún empleado');

  // cuentas actuales del portal (demo)
  const db = new DatabaseSync(demoDb, { readOnly: true });
  const u = db.prepare('select u.id, u.name, u.email, u.status, r.code from users u join roles r on r.id = u.roleId order by u.id').all();
  console.log('\n=== Cuentas actuales del portal (24) y qué rol simulan');
  for (const x of u) {
    const real = emp.find((e) => sinTilde(e['Apellidos']).split(' ')[0] === sinTilde(x.name).split(' ').slice(-1)[0] && sinTilde(e['Nombres']).split(' ')[0] === sinTilde(x.name).split(' ')[0]);
    console.log(`  #${String(x.id).padStart(2)} ${x.name.padEnd(20)} ${x.email.padEnd(38)} ${x.code.padEnd(26)} ${x.status ? 'activa ' : 'INACTIVA'} ${real ? '→ persona real en AS2' : '→ cuenta de simulación'}`);
  }

  // cuántas cuentas por rol de portal se necesitarían, si el cargo se mapea
  console.log('\n=== Referencias en datos de la demo a cuentas de prueba (por qué no conviene simplemente borrarlas)');
  for (const [t, c] of [['sub_orders', 'assignedUserId'], ['maintenance_orders', 'id']]) {
    try { console.log(`  ${t}: ${db.prepare(`select count(*) n from ${t}`).get().n} filas`); } catch { /* tabla distinta */ }
  }
  const tablas = db.prepare("select name from sqlite_master where type='table' and name not like 'sqlite%'").all().map((t) => t.name);
  let refs = 0;
  for (const t of tablas) {
    const cols = db.prepare(`pragma table_info(${t})`).all().map((c) => c.name);
    if (cols.some((c) => /userid|usuarioid|assigneduser|solicitante/i.test(c))) { const n = db.prepare(`select count(*) n from ${t}`).get().n; if (n) { console.log(`  ${t}: ${n} filas con referencia a usuario (${cols.filter((c) => /userid|usuarioid|assigneduser|solicitante/i.test(c)).join(', ')})`); refs += n; } }
  }
  console.log(`  total filas de la demo que apuntan a un usuario: ${refs}`);
})().catch((e) => {
  console.error('ERROR', e.stack);
  process.exit(1);
});
