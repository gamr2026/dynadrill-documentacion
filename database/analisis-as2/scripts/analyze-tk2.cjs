// Segunda pasada sobre TK: supervisores, hoja BD, representantes por cliente y variantes de escritura. Solo lectura.
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
/** Clave de comparación: sin tildes, sin títulos, sin signos, en minúsculas, palabras ordenadas. */
const key = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(ing|lic|dr|dra|sr|sra|msc|abg|tlgo)\b\.?/g, ' ').replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 1).sort().join(' ');
const toks = (s) => key(s).split(' ').filter(Boolean);
const subset = (a, b) => {
  const A = toks(a), B = toks(b);
  const [s, big] = A.length <= B.length ? [A, B] : [B, A];
  return s.length >= 2 && s.every((w) => big.includes(w));
};

async function leer(ws, headerRow) {
  const cols = [];
  ws.getRow(headerRow).eachCell({ includeEmpty: true }, (c, i) => (cols[i - 1] = text(c.value).replace(/\s+/g, ' ').trim()));
  const out = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n <= headerRow) return;
    const o = {};
    cols.forEach((c, i) => c && (o[c] = text(row.getCell(i + 1).value).trim()));
    out.push(o);
  });
  return { cols, rows: out };
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(tkPath);
  const { cols, rows: all } = await leer(wb.getWorksheet('TK'), 3);
  const tk = all.filter((r) => r['Ticket'] || r['OT']);
  const colSup = cols.find((c) => /supervisor/i.test(c));
  const colRepC = cols.find((c) => /campo/i.test(c));
  const colRepQ = cols.find((c) => /quito/i.test(c));
  console.log(`columnas detectadas → supervisor: "${colSup}" | campo: "${colRepC}" | quito: "${colRepQ}"`);

  const as2 = new ExcelJS.Workbook();
  await as2.xlsx.readFile(as2Path);
  const emp = (await leer(as2.getWorksheet('Empleados'), 1)).rows;
  const usr = (await leer(as2.getWorksheet('Usuarios'), 1)).rows;
  const rubro = (await leer(as2.getWorksheet('Rubro Empleado'), 1)).rows;
  const db = new DatabaseSync(demoDb, { readOnly: true });
  const persona = (t) => db.prepare('select nombre, cedula from personas_contacto where tipo = ?').all(t);

  // ---------- supervisores / operadores
  const sup = new Map();
  for (const r of tk) if (r[colSup]) sup.set(r[colSup].trim(), (sup.get(r[colSup].trim()) ?? 0) + 1);
  const supEmp = [...sup.keys()].filter((v) => emp.some((e) => subset(`${e['Nombres']} ${e['Apellidos']}`, v)));
  const supRub = [...sup.keys()].filter((v) => !supEmp.includes(v) && rubro.some((e) => subset(`${e['Nombre']} ${e['Apellido(s)']}`, v)));
  console.log(`\n=== SUPERVISOR / OPERADOR: ${sup.size} distintos | son empleados de AS2: ${supEmp.length} | solo en Rubro (exempleados): ${supRub.length} | sin coincidencia: ${sup.size - supEmp.length - supRub.length}`);
  const cargos = new Map();
  for (const v of supEmp) { const e = emp.find((x) => subset(`${x['Nombres']} ${x['Apellidos']}`, v)); cargos.set(e['Cargo'].trim(), (cargos.get(e['Cargo'].trim()) ?? 0) + 1); }
  console.log('  cargos de los que coinciden:', [...cargos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k}(${n})`).join(', '));
  console.log('  sin coincidencia (muestra):', [...sup.keys()].filter((v) => !supEmp.includes(v) && !supRub.includes(v)).slice(0, 8).join(', '));

  // ---------- hoja BD vs catálogo vs TK
  const bd = (await leer(wb.getWorksheet('BD'), 1)).rows;
  const bdCompany = bd.map((r) => r['company']).filter(Boolean);
  const bdQuito = bd.map((r) => r['aprobador Quito']).filter(Boolean);
  const catC = persona('representante_campo');
  const catQ = persona('representante_quito');
  const tkC = new Set(tk.map((r) => r[colRepC]).filter((v) => v && !/^n\/?a$/i.test(v)).map((v) => v.trim()));
  const tkQ = new Set(tk.map((r) => r[colRepQ]).filter((v) => v && !/^n\/?a$/i.test(v)).map((v) => v.trim()));
  const inKey = (arr, v) => arr.some((x) => key(x) === key(v));
  console.log('\n=== HOJA BD: ¿de dónde salió nuestro catálogo?');
  console.log(`  BD.company (Company Man): ${bdCompany.length} | nuestro catálogo de campo: ${catC.length} → ${bdCompany.filter((v) => catC.some((c) => key(c.nombre) === key(v))).length} de BD están en el catálogo; ${catC.filter((c) => !inKey(bdCompany, c.nombre)).length} del catálogo NO están en BD`);
  console.log(`  BD.company que aparecen en TK: ${bdCompany.filter((v) => [...tkC].some((t) => key(t) === key(v))).length}/${bdCompany.length} | en TK pero NO en BD: ${[...tkC].filter((t) => !inKey(bdCompany, t)).length}`);
  console.log(`  BD.aprobador Quito: ${bdQuito.length} | nuestro catálogo Quito: ${catQ.length} → en común: ${bdQuito.filter((v) => inKey(catQ.map((c) => c.nombre), v)).length} | en TK pero NO en BD: ${[...tkQ].filter((t) => !inKey(bdQuito, t)).length}`);
  console.log(`  ⇒ nuestras cédulas (${catC.filter((c) => c.cedula).length}) existen solo para el catálogo antiguo; BD y TK traen ${[...new Set([...bdCompany, ...tkC].map(key))].length} company men distintos sin cédula`);

  // ---------- variantes de escritura
  const variantes = (setVals, titulo) => {
    const grupos = new Map();
    for (const v of setVals) { const k = key(v); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(v); }
    const dup = [...grupos.values()].filter((g) => g.length > 1);
    console.log(`  ${titulo}: ${setVals.size} valores crudos → ${grupos.size} personas distintas tras normalizar (${dup.length} con variantes: ${dup.slice(0, 4).map((g) => g.join(' ≈ ')).join('; ')})`);
  };
  console.log('\n=== VARIANTES de escritura en TK (mismo nombre, distinta forma)');
  variantes(tkC, 'representante de campo');
  variantes(tkQ, 'representante Quito ');
  variantes(new Set(tk.map((r) => r['Dyna_Ventas']).filter(Boolean).map((v) => v.trim())), 'agente comercial     ');
  variantes(new Set(tk.map((r) => r['Cliente']).filter(Boolean).map((v) => v.trim())), 'cliente              ');

  // ---------- representantes por cliente
  const porCliente = new Map();
  for (const r of tk) {
    const c = (r['Cliente'] || '(sin cliente)').trim();
    if (!porCliente.has(c)) porCliente.set(c, { n: 0, campo: new Set(), quito: new Set() });
    const o = porCliente.get(c);
    o.n++;
    if (r[colRepC] && !/^n\/?a$/i.test(r[colRepC])) o.campo.add(key(r[colRepC]));
    if (r[colRepQ] && !/^n\/?a$/i.test(r[colRepQ])) o.quito.add(key(r[colRepQ]));
  }
  console.log('\n=== REPRESENTANTES POR CLIENTE (personas distintas, ya normalizadas)');
  for (const [c, o] of [...porCliente.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${c.padEnd(26)} ${String(o.n).padStart(4)} tickets | campo: ${String(o.campo.size).padStart(3)} | Quito: ${String(o.quito.size).padStart(3)}`);
  }

  // ---------- Hermes / Iván
  console.log('\n=== CASOS A VALIDAR');
  const hermes = tk.filter((r) => r['Analista'] === 'Hermes');
  console.log(`  Hermes: ${hermes.length} tickets, meses ${[...new Set(hermes.map((r) => r['MES']))].join(', ')}, clientes ${[...new Set(hermes.map((r) => r['Cliente']))].join('/')} · AS2: Hermes Páez, cargo "Operador de Fluidos" (no es de facturación)`);
  const ivan = tk.filter((r) => r['Analista'] === 'Iván');
  const ivanRub = rubro.filter((r) => key(r['Nombre']).split(' ').includes('ivan'));
  console.log(`  Iván: ${ivan.length} tickets, meses ${[...new Set(ivan.map((r) => r['MES']))].join(', ')} · AS2: usuario IVAN CASANOVA (Asistente Contable); en Rubro Empleado hay ${ivanRub.length} con ese nombre (${ivanRub.map((r) => (r['Apellido(s)'] || '').split(' ')[0] + ' ' + (r['Activo'] === 'Sí' ? 'activo' : 'inactivo')).join(', ')})`);
  const porMes = {};
  for (const r of tk) if (r['Analista']) { const k = r['MES'] || '?'; (porMes[k] ??= new Set()).add(r['Analista']); }
  console.log('  analistas activos por mes:', Object.entries(porMes).sort().map(([m, s]) => `${m}: ${[...s].join('/')}`).join(' | '));
})().catch((e) => {
  console.error('ERROR', e.stack);
  process.exit(1);
});
