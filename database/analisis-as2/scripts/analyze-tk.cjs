// Análisis de la hoja TK (control de tickets) frente a AS2 y a nuestro catálogo. Solo lectura.
const ExcelJS = require('C:/Users/Digitec/Documents/proyectos/dynadrill/dynadrill-frontend-platform/node_modules/exceljs');
const { DatabaseSync } = require('node:sqlite');
const [tkPath, as2Path, demoDb] = process.argv.slice(2);

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
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(ing|lic|dr|dra|sr|sra|msc|abg|tlgo)\b\.?/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const toks = (s) => norm(s).split(' ').filter((w) => w.length > 1);
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

async function leerHoja(ws, headerRow) {
  const cols = [];
  ws.getRow(headerRow).eachCell({ includeEmpty: true }, (c, i) => (cols[i - 1] = text(c.value).trim()));
  const out = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n <= headerRow) return;
    const o = {};
    cols.forEach((c, i) => c && (o[c] = text(row.getCell(i + 1).value).trim()));
    out.push(o);
  });
  return out;
}

(async () => {
  const tkWb = new ExcelJS.Workbook();
  await tkWb.xlsx.readFile(tkPath);
  const tkAll = await leerHoja(tkWb.getWorksheet('TK'), 3);
  const tk = tkAll.filter((r) => r['Ticket'] || r['OT']);
  console.log(`TK: ${tk.length} tickets con OT/Ticket (de ${tkAll.length} filas leídas)`);
  console.log(`rango de fechas de inicio: ${tk.map((r) => r['Fecha Inicio']).filter(Boolean).sort()[0]} → ${tk.map((r) => r['Fecha Inicio']).filter(Boolean).sort().at(-1)}`);

  // ---- AS2
  const as2 = new ExcelJS.Workbook();
  await as2.xlsx.readFile(as2Path);
  const h = async (n) => leerHoja(as2.getWorksheet(n), 1);
  const empleados = await h('Empleados');
  const usuarios = await h('Usuarios');
  const agentesAs2 = (await h('Agentes Comerciales')).map((a) => a['Agente Comercial']);
  const clientesAs2 = await h('Clientes');
  const db = new DatabaseSync(demoDb, { readOnly: true });
  const personas = db.prepare('select tipo, nombre from personas_contacto').all();
  const catalogo = (t) => personas.filter((p) => p.tipo === t).map((p) => p.nombre);

  // ================= ANALISTAS
  console.log('\n=== ANALISTA (columna de TK)');
  const an = count(tk.filter((r) => r['Analista']), (r) => r['Analista'].trim());
  console.log(`  valores distintos: ${an.length} | tickets sin analista: ${tk.filter((r) => !r['Analista']).length}`);
  const catAn = catalogo('analista_facturacion').map(norm);
  for (const [nombre, n] of an) {
    const t = toks(nombre)[0] ?? '';
    const emps = empleados.filter((e) => toks(e['Nombres']).includes(t));
    const usr = usuarios.filter((u) => toks(u['Nombre(s)']).includes(t));
    const empTxt = emps.map((e) => `${e['Nombres'].split(' ')[0]} ${e['Apellidos'].split(' ')[0]} [${e['Cargo'].trim()}${e['Sucursal'] ? ', ' + e['Sucursal'] : ''}]`).join(' / ');
    console.log(`  ${nombre.padEnd(9)} ${String(n).padStart(4)} tk | catálogo nuestro: ${catAn.includes(norm(nombre)) ? 'sí' : 'NO'} | empleados AS2: ${emps.length ? empTxt : '—'} | usuarios AS2: ${usr.length ? usr.map((u) => `${u['Usuario']}(${(u['Roles'] || 'sin rol').slice(0, 24)})`).join(', ') : '—'}`);
  }

  // ================= REPRESENTANTES
  for (const [col, tipo] of [['Represent. Campo', 'representante_campo'], ['Represent. Quito', 'representante_quito']]) {
    const vals = count(tk.filter((r) => r[col] && !/^n\/?a$/i.test(r[col])), (r) => r[col].trim());
    const cat = catalogo(tipo);
    const catN = new Map(cat.map((c) => [norm(c), c]));
    const enCat = vals.filter(([v]) => catN.has(norm(v)));
    const noCat = vals.filter(([v]) => !catN.has(norm(v)));
    const catSinTk = cat.filter((c) => !vals.some(([v]) => norm(v) === norm(c)));
    console.log(`\n=== ${col.toUpperCase()}`);
    console.log(`  valores distintos en TK: ${vals.length} (vacíos/N-A: ${tk.length - vals.reduce((a, [, n]) => a + n, 0)} tickets)`);
    console.log(`  ya están en nuestro catálogo (${cat.length}): ${enCat.length} | en TK pero NO en el catálogo: ${noCat.length} | en el catálogo pero nunca en TK: ${catSinTk.length}`);
    console.log(`  no están en el catálogo (muestra): ${noCat.slice(0, 10).map(([v, n]) => `${v}(${n})`).join(', ')}`);
  }

  // ================= VÍNCULO REPRESENTANTE ↔ CLIENTE
  console.log('\n=== VÍNCULO representante ↔ cliente (lo que faltaba en el catálogo)');
  const clientes = count(tk, (r) => r['Cliente'].trim());
  console.log(`  clientes distintos en TK: ${clientes.length} →`, clientes.slice(0, 8).map(([c, n]) => `${c}(${n})`).join(', '), clientes.length > 8 ? `… +${clientes.length - 8}` : '');
  for (const [col, etiqueta] of [['Represent. Campo', 'campo'], ['Represent. Quito', 'Quito']]) {
    const mapa = new Map();
    for (const r of tk) {
      const rep = r[col]?.trim();
      if (!rep || /^n\/?a$/i.test(rep)) continue;
      if (!mapa.has(rep)) mapa.set(rep, new Set());
      mapa.get(rep).add(r['Cliente'].trim());
    }
    const unicos = [...mapa.values()].filter((s) => s.size === 1).length;
    const varios = [...mapa.entries()].filter(([, s]) => s.size > 1);
    console.log(`  rep. ${etiqueta}: ${mapa.size} con cliente deducible → un solo cliente: ${unicos} | varios clientes: ${varios.length}${varios.length ? ' (' + varios.slice(0, 3).map(([r, s]) => r + '→' + [...s].join('/')).join('; ') + ')' : ''}`);
  }
  // clientes ↔ analista/agente: ¿hay una asignación estable?
  const porCliente = new Map();
  for (const r of tk) {
    const c = r['Cliente'].trim();
    if (!porCliente.has(c)) porCliente.set(c, { an: new Set(), ag: new Set() });
    if (r['Analista']) porCliente.get(c).an.add(r['Analista'].trim());
    if (r['Dyna_Ventas']) porCliente.get(c).ag.add(r['Dyna_Ventas'].trim());
  }
  console.log(`  analistas por cliente: ${count([...porCliente.values()], (v) => v.an.size).map(([k, v]) => `${k} analista(s)=${v} clientes`).join(' | ')}  → el analista NO está fijo por cliente`);
  console.log(`  agentes por cliente  : ${count([...porCliente.values()], (v) => v.ag.size).map(([k, v]) => `${k} agente(s)=${v} clientes`).join(' | ')}`);

  // ================= AGENTES (Dyna_Ventas) y SUPERVISORES
  const ag = count(tk.filter((r) => r['Dyna_Ventas']), (r) => r['Dyna_Ventas'].trim());
  const catAg = catalogo('agente_comercial');
  console.log(`\n=== DYNA_VENTAS (agente comercial): ${ag.length} distintos`);
  console.log(`  en nuestro catálogo: ${ag.filter(([v]) => catAg.some((c) => norm(c) === norm(v) || subset(c, v))).length} | en la hoja de agentes de AS2: ${ag.filter(([v]) => agentesAs2.some((a) => subset(a, v))).length} | empleados AS2: ${ag.filter(([v]) => empleados.some((e) => subset(`${e['Nombres']} ${e['Apellidos']}`, v))).length}`);
  console.log('  ', ag.slice(0, 12).map(([v, n]) => `${v}(${n})`).join(', '));
  const sup = count(tk.filter((r) => r['Supervisor / Operador']), (r) => r['Supervisor / Operador'].trim());
  console.log(`\n=== SUPERVISOR / OPERADOR: ${sup.length} distintos | coinciden con Empleados AS2: ${sup.filter(([v]) => empleados.some((e) => subset(`${e['Nombres']} ${e['Apellidos']}`, v))).length}`);
  console.log('  ', sup.slice(0, 10).map(([v, n]) => `${v}(${n})`).join(', '));

  // ================= BD
  console.log('\n=== HOJA "BD"');
  const bd = await leerHoja(tkWb.getWorksheet('BD'), 1);
  console.log(`  columnas: ${Object.keys(bd[0] ?? {}).join(' | ')}`);
  for (const c of Object.keys(bd[0] ?? {})) {
    const vals = bd.map((r) => r[c]).filter(Boolean);
    console.log(`  - ${c.padEnd(24)} ${String(vals.length).padStart(3)} valores, ${new Set(vals).size} distintos · ejemplo: ${[...new Set(vals)].slice(0, 4).join(' / ').slice(0, 90)}`);
  }
})().catch((e) => {
  console.error('ERROR', e.stack);
  process.exit(1);
});
