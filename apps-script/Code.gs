/**
 * Productividad por Mesa · Retrabajo
 * Servicio web (Google Apps Script) que guarda y consulta las capturas en esta hoja de Google Sheets.
 *
 * Instalación: ver README.md, sección "1. Google Sheets + Apps Script".
 *
 * Propiedades del script (Configuración del proyecto > Propiedades del script):
 *   WRITE_KEY  (opcional) clave que debe coincidir con WRITE_KEY de config.js para guardar capturas.
 *   ADMIN_KEY  (recomendada) clave que se pide en el historial para eliminar capturas.
 *              Si no existe, nadie puede eliminar desde la página.
 */

var SHEET_CAP = 'Capturas';
var SHEET_CAT = 'Catalogos';
var HEAD = ['docId', 'fecha', 'turno', 'almacen', 'mesa', 'marca', 'tipo', 'piezas', 'personas', 'capturista', 'ts'];
var ALMACENES = ['C4', 'C5'];

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function capSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_CAP);
  if (!sh) {
    sh = ss.insertSheet(SHEET_CAP);
    sh.getRange('B:E').setNumberFormat('@'); // fecha, turno, almacén y mesa como texto
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEAD.length).setFontWeight('bold');
  }
  return sh;
}

function catSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_CAT);
  if (!sh) {
    sh = ss.insertSheet(SHEET_CAT);
    sh.appendRow(['tipos', 'marcas']);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 2).setFontWeight('bold');
  }
  return sh;
}

function text_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v === null || v === undefined ? '' : v);
}

function readRows_() {
  var sh = capSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, HEAD.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i];
    if (!v[0]) continue;
    out.push({
      docId: text_(v[0]), fecha: text_(v[1]), turno: text_(v[2]), almacen: text_(v[3]), mesa: text_(v[4]),
      marca: text_(v[5]), tipo: text_(v[6]), piezas: Number(v[7]) || 0, personas: Number(v[8]) || 0,
      capturista: text_(v[9]), ts: Number(v[10]) || 0
    });
  }
  return out;
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.action === 'list') {
      var all = readRows_();
      var rows = all.filter(function (r) { return (!p.from || r.fecha >= p.from) && (!p.to || r.fecha <= p.to); });
      return json_({ rows: rows, total: all.length });
    }
    if (p.action === 'get') {
      var rows2 = readRows_().filter(function (r) { return r.fecha === p.fecha && r.turno === String(p.turno); });
      return json_({ rows: rows2 });
    }
    if (p.action === 'catalogs') {
      var sh = catSheet_();
      var last = sh.getLastRow();
      var tipos = [], marcas = [];
      if (last >= 2) {
        var v = sh.getRange(2, 1, last - 1, 2).getValues();
        for (var i = 0; i < v.length; i++) {
          if (v[i][0]) tipos.push(String(v[i][0]));
          if (v[i][1]) marcas.push(String(v[i][1]));
        }
      }
      return json_({ tipos: tipos, marcas: marcas });
    }
    return json_({ ok: true, servicio: 'Productividad por Mesa' });
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  }
}

function clean_(v, max) {
  return String(v === null || v === undefined ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().substring(0, max || 60);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var body = JSON.parse(e.postData.contents);
    var props = PropertiesService.getScriptProperties();
    var writeKey = props.getProperty('WRITE_KEY');
    if (writeKey && body.key !== writeKey) return json_({ error: 'Clave de captura incorrecta' });

    if (body.action === 'save') return json_(save_(body));
    if (body.action === 'delete') {
      var adminKey = props.getProperty('ADMIN_KEY');
      if (!adminKey) return json_({ error: 'ADMIN_KEY no está configurada en el script' });
      if (body.adminKey !== adminKey) return json_({ error: 'Clave de administrador incorrecta' });
      return json_({ ok: true, borradas: deleteDoc_(clean_(body.docId, 80)) });
    }
    if (body.action === 'catalogs') return json_(saveCatalogs_(body));
    return json_({ error: 'Acción desconocida' });
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function deleteDoc_(docId) {
  var sh = capSheet_();
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  var n = 0;
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === docId) { sh.deleteRow(i + 2); n++; }
  }
  return n;
}

function save_(b) {
  var fecha = clean_(b.fecha, 10), turno = clean_(b.turno, 1), almacen = clean_(b.almacen, 2);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Fecha inválida');
  if (['1', '2', '3'].indexOf(turno) < 0) throw new Error('Turno inválido');
  if (ALMACENES.indexOf(almacen) < 0) throw new Error('Almacén inválido');
  if (!b.rows || !b.rows.length || b.rows.length > 6) throw new Error('Debe haber de 1 a 6 mesas');
  var docId = fecha + '_T' + turno + '_' + almacen;
  var ts = Date.now(), who = clean_(b.capturista, 40), seen = {}, out = [];
  for (var i = 0; i < b.rows.length; i++) {
    var r = b.rows[i];
    var mesa = Number(r.mesa), piezas = Number(r.piezas), personas = Number(r.personas);
    if (!(mesa >= 1 && mesa <= 6) || seen[mesa]) throw new Error('Mesa inválida o repetida');
    if (!(piezas > 0 && piezas === Math.floor(piezas))) throw new Error('Piezas inválidas en mesa ' + mesa);
    if (!(personas >= 1 && personas <= 50 && personas === Math.floor(personas))) throw new Error('Personas inválidas en mesa ' + mesa);
    var marca = clean_(r.marca), tipo = clean_(r.tipo);
    if (!marca || !tipo) throw new Error('Falta marca o tipo en mesa ' + mesa);
    seen[mesa] = true;
    out.push([docId, fecha, turno, almacen, String(mesa), marca, tipo, piezas, personas, who, ts]);
  }
  deleteDoc_(docId); // reemplaza la captura anterior del mismo turno y almacén
  var sh = capSheet_();
  sh.getRange(sh.getLastRow() + 1, 1, out.length, HEAD.length).setValues(out);
  return { ok: true, docId: docId, mesas: out.length };
}

function saveCatalogs_(b) {
  var tipos = (b.tipos || []).map(function (x) { return clean_(x, 40); }).filter(String).slice(0, 100);
  var marcas = (b.marcas || []).map(function (x) { return clean_(x, 30); }).filter(String).slice(0, 100);
  var sh = catSheet_();
  var last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, 2).clearContent();
  var n = Math.max(tipos.length, marcas.length);
  if (n) {
    var rows = [];
    for (var i = 0; i < n; i++) rows.push([tipos[i] || '', marcas[i] || '']);
    sh.getRange(2, 1, n, 2).setValues(rows);
  }
  return { ok: true };
}
