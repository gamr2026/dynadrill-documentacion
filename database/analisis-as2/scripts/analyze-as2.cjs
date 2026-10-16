// Análisis de solo lectura del maestro de Empresas de AS2 y cruce con clientes_catalogo de la demo.
// Imprime agregados; evita volcar datos personales de personas naturales.
const ExcelJS = require('C:/Users/Digitec/Documents/proyectos/dynadrill/dynadrill-frontend-platform/node_modules/exceljs');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dir = process.argv[2];
const demoDb = process.argv[3];

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
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(s a|sa|cia|ltda|c a|ca|compania|de|del|la|el|y|ep)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const count = (arr, f) => {
  const m = new Map();
  for (const x of arr) m.set(f(x), (m.get(f(x)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const show = (title, entries, n = 12) => {
  console.log(`\n${title}`);
  for (const [k, v] of entries.slice(0, n)) console.log(`  ${String(k === '' ? '(vacío)' : k).padEnd(38)} ${v}`);
  if (entries.length > n) console.log(`  … y ${entries.length - n} valores más`);
};

(async () => {
  const rows = [];
  let cols = [];
  for (const file of fs.readdirSync(dir).filter((f) => /^empresas_p\d+\.xlsx$/.test(f)).sort()) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(dir, file));
    const ws = wb.worksheets[0];
    cols = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (cols[i - 1] = text(c.value).trim()));
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const o = { _file: file };
      cols.forEach((c, i) => (o[c] = text(row.getCell(i + 1).value).trim()));
      if (Object.values(o).slice(1).some((v) => v !== '')) rows.push(o);
    }
  }
  console.log(`FILAS TOTALES leídas de las 9 páginas: ${rows.length}`);
  console.log(`Nº mínimo/máximo: ${Math.min(...rows.map((r) => +r['Nº']))} / ${Math.max(...rows.map((r) => +r['Nº']))}`);

  const esCliente = (r) => r['Cliente'] === 'true';
  const esProv = (r) => r['Proveedor'] === 'true';
  console.log(`\nRoles: cliente=${rows.filter(esCliente).length} | proveedor=${rows.filter(esProv).length} | ambos=${rows.filter((r) => esCliente(r) && esProv(r)).length} | ninguno=${rows.filter((r) => !esCliente(r) && !esProv(r)).length} | entidad pública=${rows.filter((r) => r['Entidad Pública'] === 'true').length}`);
  show('Tipo de identificación', count(rows, (r) => r['Tipo de Identificación']));
  show('Tipo de empresa (persona jurídica/natural)', count(rows, (r) => r['Tipo Empresa']));
  show('Categoría', count(rows, (r) => r['Categoría']), 15);
  show('Sucursal', count(rows, (r) => r['Sucursal']), 10);
  show('Emite retención', count(rows, (r) => r['Emite retención']));
  console.log(`\nCon Crédito Máximo > 0: ${rows.filter((r) => parseFloat(r['Crédito Máximo']) > 0).length} | con Crédito Utilizado > 0: ${rows.filter((r) => parseFloat(r['Crédito Utilizado']) > 0).length} | con Código Alterno: ${rows.filter((r) => r['Código Alterno']).length} | con Nota: ${rows.filter((r) => r['Nota']).length}`);

  console.log('\nCALIDAD DE IDENTIFICACIÓN');
  show('  largo de Identificación por tipo', count(rows, (r) => `${r['Tipo de Identificación']} · ${r['Identificación'].trim().length}`), 12);
  const ids = count(rows, (r) => r['Identificación'].trim());
  console.log(`  identificaciones repetidas: ${ids.filter(([, n]) => n > 1).length} (no se imprimen los valores: pueden ser cédulas de personas naturales)`);
  console.log(`  con espacios al inicio/fin en Código o Identificación: ${rows.filter((r) => /^\s|\s$/.test(r['Código']) || /^\s|\s$/.test(r['Identificación'])).length} (los valores ya se limpiaron al leer)`);
  console.log(`  Código distinto de Identificación: ${rows.filter((r) => r['Código'] !== r['Identificación']).length}`);

  // ----- cruce con la demo
  const db = new DatabaseSync(demoDb, { readOnly: true });
  const nuestros = db.prepare('select id, tipoIdentificacion t, identificacion i, nombreComercial c, nombreFiscal f from clientes_catalogo').all();
  const porId = new Map();
  for (const r of rows) {
    const id = r['Identificación'].trim();
    if (!porId.has(id)) porId.set(id, []);
    porId.get(id).push(r);
    const id10 = id.length === 13 ? id.slice(0, 10) : id; // un RUC de persona natural = cédula + 001
    if (id10 !== id) {
      if (!porId.has('~' + id10)) porId.set('~' + id10, []);
      porId.get('~' + id10).push(r);
    }
  }
  const porNombre = new Map();
  for (const r of rows) for (const n of [r['Nombre Comercial'], r['Nombre Fiscal']]) if (n) porNombre.set(norm(n), r);

  let porIdOk = 0, porNombreOk = 0, ninguno = [];
  const detalle = [];
  for (const c of nuestros) {
    const id = c.i.trim();
    const hit = porId.get(id) ?? porId.get('~' + id);
    if (hit) { porIdOk++; detalle.push({ c, via: 'identificación', r: hit[0] }); continue; }
    const h2 = porNombre.get(norm(c.c)) ?? porNombre.get(norm(c.f ?? ''));
    if (h2) { porNombreOk++; detalle.push({ c, via: 'nombre', r: h2 }); continue; }
    ninguno.push(c);
  }
  console.log(`\n=== CRUCE con nuestros ${nuestros.length} clientes de la demo`);
  console.log(`  encontrados por identificación: ${porIdOk} | solo por nombre: ${porNombreOk} | sin coincidencia: ${ninguno.length}`);
  const empresas = detalle.filter((d) => d.r['Tipo Empresa'] === 'Jurídica' || d.c.t === 'Ruc' && d.c.i.length === 13);
  console.log('\n  Coincidencias (solo empresas; nuestro nombre → AS2: rol/categoría/crédito/sucursal):');
  for (const d of detalle.filter((x) => x.r['Tipo Empresa'] === 'Jurídica').slice(0, 14)) {
    console.log(`   · ${d.c.c.slice(0, 32).padEnd(32)} → ${d.r['Nombre Fiscal'].slice(0, 30).padEnd(30)} | cli=${d.r['Cliente']} prov=${d.r['Proveedor']} pub=${d.r['Entidad Pública']} | ${d.r['Categoría'] || '-'} | créd.máx=${d.r['Crédito Máximo'] || '-'} | suc=${d.r['Sucursal'] || '-'} | vía ${d.via}`);
  }
  console.log('\n  Sin coincidencia en AS2 (empresas; nombre, tipo, largo):');
  for (const c of ninguno.filter((c) => c.t === 'Ruc').slice(0, 12)) console.log(`   · ${c.c.slice(0, 40).padEnd(40)} ${c.t} ${c.i.length}`);
  console.log(`   (más ${ninguno.filter((c) => c.t !== 'Ruc').length} de tipo cédula/pasaporte sin coincidir)`);

  // EP Petroecuador y variantes en AS2
  console.log('\n=== EP PETROECUADOR en AS2 (variantes del mismo cliente)');
  for (const r of rows.filter((r) => /petroecuador|hidrocarburos del ecuador/i.test(r['Nombre Comercial'] + ' ' + r['Nombre Fiscal']))) {
    console.log(`   · Nº ${r['Nº']} | ${r['Tipo de Identificación']} ${r['Identificación']} | ${r['Nombre Comercial'].slice(0, 45)} | cli=${r['Cliente']} pub=${r['Entidad Pública']} | suc=${r['Sucursal'] || '-'}`);
  }

  // universo de CLIENTES de AS2
  const cli = rows.filter(esCliente);
  console.log(`\n=== Universo de CLIENTES de AS2 (flag Cliente=true): ${cli.length}`);
  show('  por categoría', count(cli, (r) => r['Categoría']), 10);
  show('  por sucursal', count(cli, (r) => r['Sucursal']), 10);
  console.log(`  entidades públicas entre los clientes: ${cli.filter((r) => r['Entidad Pública'] === 'true').length}`);
  const yaEnPortal = cli.filter((r) => nuestros.some((c) => c.i.trim() === r['Identificación'].trim() || norm(c.c) === norm(r['Nombre Comercial'])));
  console.log(`  clientes de AS2 que YA están en nuestro portal: ${yaEnPortal.length}; los que faltan: ${cli.length - yaEnPortal.length}`);
  const raros = cli.filter((r) => r['Crédito Máximo'] && parseFloat(r['Crédito Máximo']) > 0);
  console.log(`  clientes con crédito asignado: ${raros.length}`);

  // listas de descuentos
  console.log('\n=== LISTAS DE DESCUENTOS');
  for (const f of ['listaDescuentosGeneral.xlsx', 'listaDescuentosNormal.xlsx']) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(dir, f));
    const ws = wb.worksheets[0];
    const out = [];
    ws.eachRow((row) => { const a = []; row.eachCell({ includeEmpty: true }, (c) => a.push(text(c.value))); out.push(a.join(' | ')); });
    console.log(`  ${f}:`); out.forEach((l) => console.log(`     ${l}`));
  }
  const g = fs.readFileSync(path.join(dir, 'listaDescuentosGeneral.xlsx'));
  const n = fs.readFileSync(path.join(dir, 'listaDescuentosNormal.xlsx'));
  console.log(`  ¿los dos archivos son byte a byte idénticos?: ${Buffer.compare(g, n) === 0}`);
})().catch((e) => {
  console.error('ERROR', e.stack);
  process.exit(1);
});
