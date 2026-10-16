// Estructura de AS2_Datos_Extraidos.xlsx (solo lectura). Recibe la ruta del archivo.
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
  console.log(`Hojas: ${wb.worksheets.length}`);
  for (const ws of wb.worksheets) {
    console.log(`\n### hoja "${ws.name}" · ${ws.rowCount} filas · ${ws.columnCount} columnas`);
    const header = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (header[i - 1] = text(c.value)));
    console.log('fila 1 :', header.join(' | ').slice(0, 400));
    for (const n of [2, 3]) {
      if (ws.rowCount < n) break;
      const r = [];
      ws.getRow(n).eachCell({ includeEmpty: true }, (c, i) => (r[i - 1] = text(c.value).slice(0, 28)));
      console.log(`fila ${n}  :`, r.join(' | ').slice(0, 400));
    }
  }
})().catch((e) => {
  console.error('ERROR', e.message);
  process.exit(1);
});
