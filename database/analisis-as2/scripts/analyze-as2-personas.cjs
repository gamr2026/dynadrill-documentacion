// Cruce de nuestros contactos (agentes, analistas, representantes) con el maestro de Empresas de AS2.
// Solo lectura. Muestra conteos y muestras mínimas.
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
    .replace(/\b(ing|lic|dr|dra|sr|sra|msc|abg|tlgo|ph d)\b\.?/g, ' ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
/** Palabras ordenadas: tolera el orden "Apellidos Nombres" del ERP frente a "Nombres Apellidos". */
const bag = (s) => norm(s).split(' ').filter((w) => w.length > 1).sort().join(' ');

(async () => {
  const rows = [];
  for (const file of fs.readdirSync(dir).filter((f) => /^empresas_p\d+\.xlsx$/.test(f)).sort()) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(dir, file));
    const ws = wb.worksheets[0];
    const cols = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (cols[i - 1] = text(c.value).trim()));
    for (let r = 2; r <= ws.rowCount; r++) {
      const o = {};
      cols.forEach((c, i) => (o[c] = text(ws.getRow(r).getCell(i + 1).value).trim()));
      if (Object.values(o).some((v) => v)) rows.push(o);
    }
  }
  const db = new DatabaseSync(demoDb, { readOnly: true });
  const personas = db.prepare('select tipo, nombre, cedula from personas_contacto').all();

  const porCedula = new Map();
  const porBolsa = new Map();
  for (const r of rows) {
    const id = r['Identificación'];
    for (const k of [id, id.length === 13 ? id.slice(0, 10) : id]) porCedula.set(k, r);
    for (const n of [r['Nombre Comercial'], r['Nombre Fiscal']]) if (n) porBolsa.set(bag(n), r);
  }

  console.log('=== Cruce de personas de contacto contra AS2 (4.491 filas)');
  for (const tipo of ['representante_campo', 'representante_quito', 'agente_comercial', 'analista_facturacion']) {
    const ps = personas.filter((p) => p.tipo === tipo);
    let porCed = 0, porNom = 0;
    const muestra = [];
    for (const p of ps) {
      const c = p.cedula && (porCedula.get(p.cedula.trim()) ?? porCedula.get(p.cedula.trim().padStart(10, '0')));
      const n = porBolsa.get(bag(p.nombre));
      if (c) { porCed++; if (muestra.length < 2) muestra.push(`${p.nombre} (cédula) → ${c['Categoría']}`); }
      else if (n) { porNom++; if (muestra.length < 3) muestra.push(`${p.nombre} (nombre) → ${n['Categoría']} / ${n['Tipo Empresa']}`); }
    }
    console.log(`  ${tipo.padEnd(21)} ${String(ps.length).padStart(3)} personas | por cédula: ${String(porCed).padStart(2)} | solo por nombre: ${String(porNom).padStart(2)} | sin coincidencia: ${ps.length - porCed - porNom}`);
    for (const m of muestra) console.log(`        · ${m}`);
  }

  console.log('\n=== Categoría "Empleado Asistencial" en AS2');
  const emp = rows.filter((r) => /empleado/i.test(r['Categoría']));
  console.log(`  filas: ${emp.length} | tipo de identificación: ${[...new Set(emp.map((r) => r['Tipo de Identificación']))].join(', ')} | tipo empresa: ${[...new Set(emp.map((r) => r['Tipo Empresa']))].join(', ')}`);
  console.log(`  ¿alguno de los agentes/analistas nuestros está entre ellos (por nombre)? ${personas.filter((p) => ['agente_comercial', 'analista_facturacion'].includes(p.tipo) && emp.some((e) => bag(e['Nombre Comercial']) === bag(p.nombre))).length}`);
  console.log(`  columnas útiles de esas filas: Sucursal=${[...new Set(emp.map((r) => r['Sucursal']))].join('/')} | con Nota=${emp.filter((r) => r['Nota']).length}`);

  console.log('\n=== Campo "Nota" (733 filas con contenido): ¿qué hay?');
  const notas = rows.filter((r) => r['Nota']);
  const tok = new Map();
  for (const r of notas) for (const w of norm(r['Nota']).split(' ')) if (w.length > 3) tok.set(w, (tok.get(w) ?? 0) + 1);
  console.log('  palabras más frecuentes:', [...tok.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([w, n]) => `${w}(${n})`).join(', '));
  console.log(`  notas con teléfono/correo/@: ${notas.filter((r) => /@|\d{7,}/.test(r['Nota'])).length}`);
  const notasDeClientes = rows.filter((r) => r['Cliente'] === 'true' && r['Nota']);
  console.log(`  notas en filas de CLIENTES: ${notasDeClientes.length}`);
  for (const r of notasDeClientes.slice(0, 6)) console.log(`     · ${r['Nombre Comercial'].slice(0, 28).padEnd(28)} → "${r['Nota'].slice(0, 70)}"`);

  console.log('\n=== Datos que AS2 NO trae (clave para el diseño)');
  const cols = Object.keys(rows[0]);
  console.log('  columnas del export:', cols.join(', '));
  console.log('  → sin: teléfono, correo, dirección, contactos/representantes, cargo, ciudad, provincia');
})().catch((e) => {
  console.error('ERROR', e.stack);
  process.exit(1);
});
