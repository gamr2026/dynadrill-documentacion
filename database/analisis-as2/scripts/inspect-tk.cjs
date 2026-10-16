// Estructura del control de tickets (solo lectura). Recibe la ruta del archivo.
const ExcelJS = require('C:/Users/Digitec/Documents/proyectos/dynadrill/dynadrill-frontend-platform/node_modules/exceljs');

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

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(process.argv[2]);
  console.log(`Hojas (${wb.worksheets.length}):`);
  for (const ws of wb.worksheets) console.log(`  - "${ws.name}" · ${ws.rowCount} filas × ${ws.columnCount} columnas`);
  const ws = wb.getWorksheet('TK');
  if (!ws) return console.log('NO existe la hoja TK');

  // ¿en qué fila están los encabezados? (primeras 8 filas, con contenido)
  for (let r = 1; r <= 6; r++) {
    const v = [];
    ws.getRow(r).eachCell({ includeEmpty: true }, (c, i) => (v[i - 1] = text(c.value).slice(0, 22)));
    console.log(`\nfila ${r}: ${v.filter(Boolean).length} celdas con dato`);
    console.log('  ' + v.map((x, i) => `[${i + 1}]${x}`).join(' | ').slice(0, 900));
  }
})().catch((e) => {
  console.error('ERROR', e.message);
  process.exit(1);
});
