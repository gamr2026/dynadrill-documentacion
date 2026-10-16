// Segunda pasada: resolución combinada de agentes/analistas y comprobación de representantes. Solo lectura.
const ExcelJS = require('C:/Users/Digitec/Documents/proyectos/dynadrill/dynadrill-frontend-platform/node_modules/exceljs');
const { DatabaseSync } = require('node:sqlite');
const [xlsxPath, demoDb] = process.argv.slice(2);

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
const norm = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(ing|lic|dr|dra|sr|sra|msc|abg|tlgo)\b\.?/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const toks = (s) => norm(s).split(' ').filter((w) => w.length > 1);
const subset = (a, b) => {
  const A = toks(a), B = toks(b);
  const [small, big] = A.length <= B.length ? [A, B] : [B, A];
  return small.length >= 2 && small.every((w) => big.includes(w));
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
  const usuarios = hoja('Usuarios');
  const empleados = hoja('Empleados');
  const rubro = hoja('Rubro Empleado');
  const agentesAs2 = hoja('Agentes Comerciales').map((a) => a['Agente Comercial']);

  const db = new DatabaseSync(demoDb, { readOnly: true });
  const P = db.prepare('select tipo, nombre, cedula from personas_contacto').all();
  const agentes = P.filter((p) => p.tipo === 'agente_comercial');
  const analistas = P.filter((p) => p.tipo === 'analista_facturacion');
  const reps = P.filter((p) => p.tipo.startsWith('representante'));

  const personasAs2 = [
    ...usuarios.map((u) => ({ f: 'Usuarios AS2', nombre: `${u['Nombre(s)']} ${u['Apellido(s)']}`, login: u['Usuario'].toLowerCase(), activo: u['Activo'] === 'Sí' })),
    ...empleados.map((e) => ({ f: 'Empleados', nombre: `${e['Nombres']} ${e['Apellidos']}`, cargo: e['Cargo'], activo: true })),
    ...rubro.map((r) => ({ f: 'Rubro Empleado', nombre: `${r['Nombre']} ${r['Apellido(s)']}`, activo: r['Activo'] === 'Sí' })),
    ...agentesAs2.map((n) => ({ f: 'Agentes Comerciales', nombre: n, activo: true })),
  ];
  const fuentes = (p) => {
    const set = new Set();
    for (const x of personasAs2) {
      if (x.login && x.login === p.nombre.toLowerCase().replace(/\s/g, '')) set.add(x.f + ' (login)');
      else if (subset(x.nombre, p.nombre)) set.add(x.f + (x.activo ? '' : ' [inactivo]'));
    }
    return [...set];
  };

  for (const [t, lista] of [['AGENTES COMERCIALES', agentes], ['ANALISTAS DE FACTURACIÓN', analistas]]) {
    const r = lista.map((p) => ({ p, f: fuentes(p) }));
    const con = r.filter((x) => x.f.length);
    console.log(`\n=== ${t} (${lista.length}): resueltos contra CUALQUIER hoja de AS2 (nombre de 2+ palabras o login): ${con.length}`);
    const porFuente = new Map();
    for (const x of con) for (const f of x.f) porFuente.set(f, (porFuente.get(f) ?? 0) + 1);
    console.log('  aparecen en:', [...porFuente.entries()].map(([k, v]) => `${k}=${v}`).join(' | '));
    console.log('  sin resolver:', r.filter((x) => !x.f.length).map((x) => x.p.nombre).join(', '));
  }

  console.log('\n=== Analistas con nombre de una sola palabra: ¿hay un especialista de facturación con ese nombre de pila?');
  for (const a of analistas.filter((p) => toks(p.nombre).length === 1)) {
    const c = empleados.filter((e) => toks(e['Nombres']).includes(toks(a.nombre)[0]) && /factur/i.test(e['Cargo']));
    const u = usuarios.filter((x) => toks(x['Nombre(s)']).includes(toks(a.nombre)[0]));
    console.log(`  "${a.nombre}" → empleados de facturación con ese nombre: ${c.length}${c.length === 1 ? ' (' + c[0]['Cargo'].trim() + ')' : ''} | usuarios AS2 con ese nombre: ${u.length}`);
  }
  const fact = empleados.filter((e) => /factur/i.test(e['Cargo']));
  console.log(`  total de empleados con cargo de facturación: ${fact.length} → ${fact.map((e) => e['Nombres'].split(' ')[0] + ' [' + e['Cargo'].trim() + ']').join(', ')}`);

  console.log('\n=== REPRESENTANTES (89) vs personas de AS2 (usuarios/empleados/rubro) por cédula o nombre');
  const cedAs2 = new Set([...empleados, ...rubro].map((x) => x['Identificación']));
  let c = 0, n = 0;
  for (const r of reps) {
    if (r.cedula && cedAs2.has(r.cedula)) c++;
    else if (personasAs2.some((x) => subset(x.nombre, r.nombre))) n++;
  }
  console.log(`  por cédula: ${c} | por nombre: ${n} (esperado: ~0, son personal del cliente, no de Dynadrill)`);

  console.log('\n=== USUARIOS del portal (24): ¿cuáles son personas reales?');
  const U = db.prepare('select name, email, cedula from users').all();
  const reales = U.filter((u) => (u.cedula && empleados.some((e) => e['Identificación'] === u.cedula)) || personasAs2.some((x) => x.f === 'Empleados' && subset(x.nombre, u.name)));
  console.log(`  reales (en Empleados de AS2): ${reales.length} | de demostración/ficticios: ${U.length - reales.length}`);
  console.log('  reales:', reales.map((u) => u.name).join(', '));
})().catch((e) => {
  console.error('ERROR', e.stack);
  process.exit(1);
});
