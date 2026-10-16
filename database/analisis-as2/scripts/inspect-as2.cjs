// Inspección de solo lectura de los Excel exportados de AS2. Recibe la carpeta como argumento.
const ExcelJS = require('C:/Users/Digitec/Documents/proyectos/dynadrill/dynadrill-frontend-platform/node_modules/exceljs');
const path = require('node:path');
const fs = require('node:fs');

const dir = process.argv[2];
const text = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if (v.text) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    if (v instanceof Date) return v.toISOString();
    return JSON.stringify(v);
  }
  return String(v);
};

(async () => {
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.xlsx')).sort()) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(dir, file));
    for (const ws of wb.worksheets) {
      const rows = ws.rowCount;
      const header = [];
      ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (header[i - 1] = text(c.value)));
      console.log(`\n### ${file} · hoja "${ws.name}" · ${rows} filas · ${header.length} columnas`);
      console.log('columnas:', header.join(' | '));
      if (rows > 1) {
        const r2 = [];
        ws.getRow(2).eachCell({ includeEmpty: true }, (c, i) => (r2[i - 1] = text(c.value).slice(0, 40)));
        console.log('fila 2  :', r2.join(' | '));
      }
    }
  }
})().catch((e) => {
  console.error('ERROR', e.message);
  process.exit(1);
});
