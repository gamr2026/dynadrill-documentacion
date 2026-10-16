// Busca a los 8 responsables conocidos en AS2 y en las cuentas del portal. Solo lectura; no imprime cédulas ni teléfonos.
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
const k = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const palabras = (s) => k(s).split(' ').filter((w) => w.length > 2);

const conocidos = [
  { nombre: 'Juan Carlos Santamaria', rol: 'Coordinador del Proyecto' },
  { nombre: 'Cesar Saeteros', rol: 'Jefe de Base Pumping' },
  { nombre: 'Franklin Pinkay', rol: 'Supervisor FCR', alias: ['pincay'] },
  { nombre: 'Monica Caceres', rol: 'Jefe Facturación' },
  { nombre: 'Edwin Culqui', rol: 'Jefe QHSE' },
  { nombre: 'José Ávila', rol: 'Jefe de mantenimiento' },
  { nombre: 'Francisco León', rol: 'Marketing' },
  { nombre: 'Stefano', rol: 'Responsable S2A' },
];

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
  const emp = leer('Empleados').map((e) => ({ ...e, _n: `${e['Nombres']} ${e['Apellidos']}` }));
  const usr = leer('Usuarios').map((u) => ({ ...u, _n: `${u['Nombre(s)']} ${u['Apellido(s)']}` }));
  const agt = leer('Agentes Comerciales').map((a) => ({ _n: a['Agente Comercial'] }));
  const rub = leer('Rubro Empleado').map((r) => ({ ...r, _n: `${r['Nombre']} ${r['Apellido(s)']}` }));
  const db = new DatabaseSync(demoDb, { readOnly: true });
  const cuentas = db.prepare('select u.id, u.name, u.email, u.status, r.code from users u join roles r on r.id = u.roleId').all();

  // ¿contiene todas las palabras (o alias) del nombre buscado?
  const coincide = (nombreAs2, c) => {
    const A = palabras(nombreAs2);
    const B = [...palabras(c.nombre), ...(c.alias ?? [])];
    const apellido = B.length > 1 ? B.slice(-1)[0] : null;
    if (B.length === 1) return A.includes(B[0]); // un solo nombre (ej. Stefano)
    const nombre1 = B[0];
    return A.includes(nombre1) && (A.includes(apellido) || (c.alias ?? []).some((a) => A.includes(a)));
  };

  for (const c of conocidos) {
    console.log(`\n■ ${c.nombre} — "${c.rol}"`);
    const e = emp.filter((x) => coincide(x._n, c));
    const u = usr.filter((x) => coincide(x._n, c));
    const a = agt.filter((x) => coincide(x._n, c));
    const r = rub.filter((x) => coincide(x._n, c));
    const p = cuentas.filter((x) => coincide(x.name, c) || coincide(x.email.split('@')[0].replace(/[._]/g, ' '), c));
    console.log(e.length ? e.map((x) => `  Empleados AS2     : ${x._n} · cargo "${x['Cargo'].trim()}" · ${x['Departamento']} · ${x['Sucursal']} · ingreso ${x['Fecha Ingreso']} · contrato ${x['Tipo Contrato']}`).join('\n') : '  Empleados AS2     : — (no aparece)');
    console.log(u.length ? u.map((x) => `  Usuario AS2       : ${x['Usuario']} (${x._n}) · activo ${x['Activo']} · roles AS2: ${x['Roles'] || 'sin rol'}`).join('\n') : '  Usuario AS2       : —');
    if (a.length) console.log(a.map((x) => `  Agente Comercial  : ${x._n}`).join('\n'));
    if (!e.length && r.length) console.log(r.map((x) => `  Rubro Empleado    : ${x._n} · ${x['Activo'] === 'Sí' ? 'activo' : 'INACTIVO'}`).join('\n'));
    console.log(p.length ? p.map((x) => `  Cuenta del portal : #${x.id} ${x.name} <${x.email}> rol ${x.code} ${x.status ? 'activa' : 'inactiva'}`).join('\n') : '  Cuenta del portal : — (no tiene cuenta propia)');
  }

  // Cuentas de simulación que hoy cubren cada rol que pidieron
  console.log('\n■ Cuentas de simulación de los roles clave (las que habría que reemplazar por la persona real)');
  for (const code of ['jefe_base', 'supervisor_pumping', 'supervisor', 'supervisor_operaciones_fcr', 'facturacion', 'gerente_hse', 'coordinador_hse', 'jefe_mantenimiento', 'ingenieria_ventas']) {
    console.log(`  ${code.padEnd(27)} ${cuentas.filter((x) => x.code === code).map((x) => `#${x.id} ${x.name} <${x.email}>`).join(' | ')}`);
  }
})().catch((e) => {
  console.error('ERROR', e.stack);
  process.exit(1);
});
