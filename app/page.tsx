```javascript
// ============================================================================
// V2 · EMISIÓN COMPLETA DESDE LAS VISTAS (Factura A y Factura B)
// Cada comprobante termina FINALIZADO = CAE + Vto CAE + PDF + registro (+ mail si hay destinatario).
// Si algo falla después del CAE queda PARCIAL y se completa con V2_COMPLETAR_PENDIENTES().
// Hoja de control: Emisiones_V2 (en ARCA_Modulo_Fiscal_DB).
// ============================================================================
var V2REG_HOJA = 'Emisiones_V2';
var V2REG_HEAD = ['FechaHora','Tipo','Origen','OperacionID','FechaFiscal','PtoVta','CbteTipo','NroComprobante','CAE','VtoCAE',
  'DocTipo','DocNro','Cliente','Email','ImpNeto','ImpIVA','ImpTotal','PdfId','PdfUrl','MailEstado','Estado','Falta','Detalle'];

function V2REG_hoja_() {
  V2PAGOS_exigirDbProduccion_();
  var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ARCA_DB_ID'));
  var sh = ss.getSheetByName(V2REG_HOJA) || ss.insertSheet(V2REG_HOJA);
  if (sh.getLastRow() === 0) { sh.appendRow(V2REG_HEAD); sh.setFrozenRows(1); }
  return sh;
}

// Evalúa si quedó finalizada y devuelve {estado, falta[]}
function V2REG_evaluar_(r) {
  var falta = [];
  if (!r.cae) falta.push('CAE');
  if (!r.vto) falta.push('VTO_CAE');
  if (!r.pdfId) falta.push('PDF');
  if (r.email && r.mail !== 'ENVIADO') falta.push('MAIL');
  if (!r.cae) return { estado: 'ERROR_SIN_CAE', falta: falta };   // no emitida: no cuenta como pendiente
  return { estado: falta.length ? 'PARCIAL' : 'FINALIZADA', falta: falta };
}

function V2REG_registrar_(r) {
  var ev = V2REG_evaluar_(r);
  V2REG_hoja_().appendRow([new Date(), r.tipo, r.origen, r.operacionId, r.fecha, r.ptoVta, r.cbteTipo, r.nro, r.cae, r.vto,
    r.docTipo, r.docNro, r.cliente || '', r.email || '', r.neto, r.iva, r.total, r.pdfId || '', r.pdfUrl || '',
    r.mail || '', ev.estado, ev.falta.join(','), r.detalle || '']);
  return ev;
}

// ---------------------------------------------------------------------------
// ESTADO PARA LAS VISTAS
// ---------------------------------------------------------------------------
function V2_UI_estado() {
  var p = PropertiesService.getScriptProperties(), out = { ok:true };
  try { V2PAGOS_exigirDbProduccion_(); out.db = 'OK'; } catch (e) { out.db = String(e.message || e); }
  out.emision = ARCA_API_emisionHabilitada_() && String(p.getProperty('ARCA_UI_EMISION_HABILITADA') || '').toUpperCase() === 'SI';
  out.pin = !!p.getProperty('ARCA_UI_PIN');
  out.cuit = /^\d{11}$/.test(String(p.getProperty('ARCA_CUIT_EMISOR') || ''));
  out.mail = V2MAIL_cfg_();
  out.servicio = ARCA_UI_ping();                        // despierta Render antes de emitir
  try { out.ultimaB = GETNET2608_ultimaEmisionARCA(); } catch (e) { out.ultimaB = { error:String(e.message || e) }; }
  try { out.ultimaA = FACTURAA_UI_ultimaFacturaA(); } catch (e) { out.ultimaA = { error:String(e.message || e) }; }
  try { out.emisor = FACTURAA_UI_cargarEmisor(); } catch (e) {}
  out.pendientes = V2_contarPendientes_();
  return out;
}

// ---------------------------------------------------------------------------
// FACTURA B · desde el texto del CSV (el servidor parsea: mismo lector que el informe)
// ---------------------------------------------------------------------------
function V2B_parsear_(texto) {
  texto = String(texto || '').replace(/^﻿/, '');
  var l1 = texto.split(/\r?\n/)[0] || '';
  var sep = (l1.split(';').length > l1.split(',').length) ? ';' : ',';
  var data = Utilities.parseCsv(texto, sep);
  return { headers: data[0] || [], rows: data.slice(1).filter(function(x){ return x.join('').trim(); }) };
}

function V2B_previsualizar(texto, opts) {
  opts = opts || {};
  var d = V2B_parsear_(texto);
  var r = V2PAGOS_previsualizar({ headers:d.headers, rows:d.rows, fechaOrigen:opts.fechaOrigen || '',
    permitirOtraFechaOrigen: !!opts.permitirOtraFecha,
    config:{ ptoVta:Number(opts.ptoVta || 9), fechaFacturacion:opts.fechaFiscal } });
  var cuadre = { filas:r.resumen.filas, aFacturar:0, yaFacturadas:0, excluidas:0 };
  r.items.forEach(function(x){
    if (x.ok) cuadre.aFacturar++;
    else if (x.errores.some(function(e){ return /^YA_FACTURADA/.test(e); })) cuadre.yaFacturadas++;
    else cuadre.excluidas++;
  });
  cuadre.cierra = (cuadre.aFacturar + cuadre.yaFacturadas + cuadre.excluidas) === cuadre.filas;
  r.cuadre = cuadre;
  return r;
}

// Emite un tramo (máx 20) de las operaciones seleccionadas. La vista llama en tramos hasta terminar.
function V2B_emitirTramo(texto, opts, ids, pin) {
  opts = opts || {};
  ids = (ids || []).slice(0, 20);
  if (!ids.length) throw new Error('NO_HAY_FILAS_SELECCIONADAS');
  var d = V2B_parsear_(texto);
  var payload = { headers:d.headers, rows:d.rows, fechaOrigen:opts.fechaOrigen || '',
    permitirOtraFechaOrigen: !!opts.permitirOtraFecha, incluirOperacionIds: ids,
    config:{ ptoVta:Number(opts.ptoVta || 9), fechaFacturacion:opts.fechaFiscal } };
  var previa = V2PAGOS_previsualizar(payload);
  var porId = {}; previa.items.forEach(function(x){ porId[x.operacionId] = x; });
  var res = V2PAGOS_emitir(payload, pin);
  res.resultados.forEach(function(row){
    var x = porId[row.operacionId] || {}, c = x.comprobante || {}, a = row.resultado || {};
    var ev = V2REG_registrar_({ tipo:'B', origen:res.origen, operacionId:row.operacionId, fecha:GETNET2608_fechaIso_(c.cbteFch),
      ptoVta:c.ptoVta, cbteTipo:6, nro:a.comprobanteNumero || '', cae:a.cae || '', vto:a.caeVencimiento || '',
      docTipo:c.docTipo, docNro:c.docNro, cliente:x.cliente, email:x.email, neto:c.impNeto, iva:c.impIVA, total:c.impTotal,
      pdfId:row.pdfId, pdfUrl:row.pdfUrl, mail: row.mail && row.mail.enviado ? 'ENVIADO' : (row.mail && row.mail.motivo || ''),
      detalle: row.error || '' });
    row.nro = a.comprobanteNumero || ''; row.cae = a.cae || ''; row.vto = a.caeVencimiento || '';
    row.total = c.impTotal; row.estadoFinal = row.ok ? ev.estado : 'ERROR'; row.falta = ev.falta;
  });
  return res;
}

// ---------------------------------------------------------------------------
// FACTURA A
// ---------------------------------------------------------------------------
function V2A_datos_(d) {
  d = d || {};
  var total = Number(d.impTotal || 0), neto = Number(d.impNeto || 0);
  if (total > 0 && !(neto > 0)) { neto = Math.round(total / 1.21 * 100) / 100; }
  if (neto > 0 && !(total > 0)) { total = Math.round(neto * 1.21 * 100) / 100; }
  d.impNeto = neto; d.impIVA = Math.round((total - neto) * 100) / 100; d.impTotal = total;
  return d;
}
function V2A_previsualizar(d) { return FACTURAA_UI_previsualizar(V2A_datos_(d)); }

function V2A_emitir(d, pin) {
  d = V2A_datos_(d);
  var r = FACTURAA_UI_emitir(d, pin, 'CONFIRMO FACTURA A');
  var n = FACTURAA_normalizar_(d), c = n.comprobante;
  var ev = V2REG_registrar_({ tipo:'A', origen:'MANUAL', operacionId:r.operacionId, fecha:GETNET2608_fechaIso_(c.cbteFch),
    ptoVta:c.ptoVta, cbteTipo:1, nro:r.nroComprobante, cae:r.cae, vto:r.caeVencimiento, docTipo:80, docNro:c.docNro,
    cliente:n.receptor.razonSocial, email:n.receptor.email, neto:c.impNeto, iva:c.impIVA, total:c.impTotal,
    pdfId:r.pdfId, pdfUrl:r.pdfUrl, mail: r.mail && r.mail.enviado ? 'ENVIADO' : (r.mail && r.mail.motivo || ''), detalle:'' });
  r.estadoFinal = ev.estado; r.falta = ev.falta;
  return r;
}

// ---------------------------------------------------------------------------
// COMPLETAR PENDIENTES (PDF / mail faltante de comprobantes con CAE). Nunca emite.
// ---------------------------------------------------------------------------
function V2_contarPendientes_() {
  try {
    var sh = V2REG_hoja_(), last = sh.getLastRow(); if (last < 2) return 0;
    var col = V2REG_HEAD.indexOf('Estado') + 1;
    return sh.getRange(2, col, last - 1, 1).getValues().filter(function(v){ return v[0] === 'PARCIAL'; }).length;
  } catch (e) { return -1; }
}

function V2_COMPLETAR_PENDIENTES() {
  var sh = V2REG_hoja_(), last = sh.getLastRow(), out = [];
  if (last < 2) return out;
  var vals = sh.getRange(2, 1, last - 1, V2REG_HEAD.length).getValues(), H = {};
  V2REG_HEAD.forEach(function(h, i){ H[h] = i; });
  vals.forEach(function(v, i) {
    if (v[H.Estado] !== 'PARCIAL' || !v[H.CAE]) return;
    var fila = i + 2, r = { cae:String(v[H.CAE]), vto:String(v[H.VtoCAE] || ''), email:String(v[H.Email] || ''),
      pdfId:String(v[H.PdfId] || ''), pdfUrl:String(v[H.PdfUrl] || ''), mail:String(v[H.MailEstado] || '') };
    var c = { ptoVta:Number(v[H.PtoVta]), cbteTipo:Number(v[H.CbteTipo]), docTipo:Number(v[H.DocTipo]), docNro:Number(v[H.DocNro]),
      impNeto:Number(v[H.ImpNeto]), impIVA:Number(v[H.ImpIVA]), impTotal:Number(v[H.ImpTotal]),
      cbteFch:(v[H.FechaFiscal] instanceof Date ? Utilities.formatDate(v[H.FechaFiscal], 'America/Argentina/Buenos_Aires', 'yyyyMMdd') : String(v[H.FechaFiscal]).replace(/\D/g, '').slice(0, 8)), condicionIVAReceptor: v[H.Tipo] === 'A' ? 1 : 5 };
    if (v[H.VtoCAE] instanceof Date) r.vto = Utilities.formatDate(v[H.VtoCAE], 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
    var res = { comprobanteNumero:v[H.NroComprobante], cae:r.cae, caeVencimiento:r.vto };
    try {
      var blob;
      if (!r.pdfId) {
        var pdf = v[H.Tipo] === 'A'
          ? FACTURAA_generarPdf_({ comprobante:c, receptor:{ razonSocial:v[H.Cliente], cuit:String(c.docNro), email:r.email } }, res)
          : GETNET2608_generarPdf_({ comprobante:c, cliente:v[H.Cliente], documento:c.docNro || '' }, res, {});
        if (v[H.Tipo] === 'B') pdf.file.setName('Factura_B_PV' + c.ptoVta + '_' + res.comprobanteNumero + '_' + v[H.Origen] + '.pdf');
        r.pdfId = pdf.file.getId(); r.pdfUrl = pdf.file.getUrl(); blob = pdf.file.getBlob();
      } else { blob = DriveApp.getFileById(r.pdfId).getBlob(); }
      if (r.email && r.mail !== 'ENVIADO') {
        var m = V2MAIL_enviarFactura_(v[H.Tipo], r.email, blob, { cae:r.cae, vto:r.vto, ptoVta:c.ptoVta, nro:res.comprobanteNumero, total:c.impTotal });
        r.mail = m.enviado ? 'ENVIADO' : (m.motivo || 'NO_ENVIADO');
      }
      var ev = V2REG_evaluar_(r);
      sh.getRange(fila, H.PdfId + 1, 1, 5).setValues([[r.pdfId, r.pdfUrl, r.mail, ev.estado, ev.falta.join(',')]]);
      out.push({ fila:fila, nro:res.comprobanteNumero, estado:ev.estado, falta:ev.falta });
    } catch (e) { out.push({ fila:fila, nro:res.comprobanteNumero, error:String(e.message || e) }); }
  });
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}


function V2_FIX_EMISOR_CONFIG() {
  var p = PropertiesService.getScriptProperties();
  var cfg = {
    razonSocial: 'PINO LEE ANN',
    nombre: 'PINO LEE ANN',
    domicilio: 'San Martin 2566, Villa Gdor. Galvez, Santa Fe',
    direccion: 'San Martin 2566, Villa Gdor. Galvez, Santa Fe',
    localidad: 'Villa Gobernador Gálvez',
    provincia: 'Santa Fe',
    codigoPostal: '2124',
    emailDestino: 'detodounpoquitosanmartin@gmail.com',
    nombreRemitente: 'De Todo Un Poquito San Martín'
  };
  p.setProperty('FACTURAA_EMISOR_CONFIG', JSON.stringify(cfg));
  return { ok: true, guardado: p.getProperty('FACTURAA_EMISOR_CONFIG') };
}
// =====================================================
// ENDPOINTS PARA VERCEL
// Pega esto al final de tu V2_Emision.gs o Router.gs
// =====================================================

/**
 * ENDPOINT PÚBLICO - Expone el script para llamadas desde Vercel
 */
function doGet(e) {
  const action = e.parameter.action;

  try {
    if (action === 'getHistorial') {
      return getHistorial(e);
    } else if (action === 'getConfig') {
      return getConfig(e);
    } else if (action === 'health') {
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    return error('Acción no reconocida: ' + action);
  } catch (err) {
    return error('Error en doGet: ' + err.toString());
  }
}

/**
 * ENDPOINT PÚBLICO - Para emisiones y acciones POST
 */
function doPost(e) {
  const postData = JSON.parse(e.postData.contents);
  const action = postData.action;

  try {
    if (action === 'emitir') {
      return emitirComprobante(postData);
    } else if (action === 'generarPDF') {
      return generarPDFBajodemanda(postData);
    } else if (action === 'cargarCSV') {
      return cargarCSVPasarela(postData);
    }

    return error('Acción POST no reconocida');
  } catch (err) {
    return error('Error en doPost: ' + err.toString());
  }
}

/**
 * GET: Obtener historial de comprobantes
 */
function getHistorial(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const ARCA_DB_ID = props.getProperty('ARCA_DB_ID');

    if (!ARCA_DB_ID) {
      return error('ARCA_DB_ID no configurado');
    }

    const ss = SpreadsheetApp.openById(ARCA_DB_ID);
    const hoja = ss.getSheetByName('Operaciones_ARCA');

    if (!hoja) {
      return error('Hoja Operaciones_ARCA no encontrada');
    }

    const data = hoja.getDataRange().getValues();
    const headers = data[0];
    const filas = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i];
      });
      return obj;
    });

    return success({ comprobantes: filas, total: filas.length });
  } catch (err) {
    return error('Error cargando historial: ' + err.toString());
  }
}

/**
 * GET: Obtener configuración (sin exponer datos sensibles)
 */
function getConfig(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    return success({
      cuit: props.getProperty('ARCA_CUIT_EMISOR'),
      email: 'detodounpoquitosanmartin@gmail.com',
      apiStatus: 'active'
    });
  } catch (err) {
    return error('Error cargando config: ' + err.toString());
  }
}

/**
 * POST: Emitir comprobante desde Vercel
 */
function emitirComprobante(postData) {
  try {
    const tipo = postData.tipo; // 'factura_a', 'factura_b', 'nc_a', 'nc_b', 'nd_a', 'nd_b'
    const datos = postData.datos; // objeto con datos del comprobante

    // VALIDAR
    if (!tipo || !datos) {
      return error('Parámetros incompletos');
    }

    // EMITIR según tipo
    let resultado;
    switch(tipo) {
      case 'factura_a':
        resultado = EMISION_FACTURA_A(datos);
        break;
      case 'factura_b':
        resultado = EMISION_FACTURA_B(datos);
        break;
      case 'nc_a':
        resultado = EMISION_NOTA_CREDITO_A(datos);
        break;
      case 'nc_b':
        resultado = EMISION_NOTA_CREDITO_B(datos);
        break;
      case 'nd_a':
        resultado = EMISION_NOTA_DEBITO_A(datos);
        break;
      case 'nd_b':
        resultado = EMISION_NOTA_DEBITO_B(datos);
        break;
      default:
        return error('Tipo de comprobante no válido');
    }

    return success({ resultado: resultado });
  } catch (err) {
    return error('Error emitiendo comprobante: ' + err.toString());
  }
}

/**
 * POST: Generar PDF bajo demanda
 */
function generarPDFBajodemanda(postData) {
  try {
    const cae = postData.cae; // CAE del comprobante a generar PDF
    const tipo = postData.tipo; // tipo de comprobante

    if (!cae || !tipo) {
      return error('CAE y tipo requeridos');
    }

    // GENERAR PDF - usa tu función existente
    const pdfUrl = GENERAR_PDF_POR_CAE(cae, tipo);

    return success({ pdf: pdfUrl, cae: cae });
  } catch (err) {
    return error('Error generando PDF: ' + err.toString());
  }
}

/**
 * POST: Cargar CSV desde pasarela (Clover, MP, GetNet)
 */
function cargarCSVPasarela(postData) {
  try {
    const pasarela = postData.pasarela; // 'clover', 'mercadopago', 'getnet'
    const csvContent = postData.csvContent; // contenido CSV

    if (!pasarela || !csvContent) {
      return error('Pasarela y CSV requeridos');
    }

    // PROCESAR según pasarela
    let resultado;
    switch(pasarela) {
      case 'mercadopago':
        resultado = PROCESAR_CSV_MERCADOPAGO(csvContent);
        break;
      case 'clover':
        resultado = PROCESAR_CSV_CLOVER(csvContent);
        break;
      case 'getnet':
        resultado = PROCESAR_CSV_GETNET(csvContent);
        break;
      default:
        return error('Pasarela no válida');
    }

    return success({ resultado: resultado });
  } catch (err) {
    return error('Error cargando CSV: ' + err.toString());
  }
}

// =====================================================
// FUNCIONES HELPER
// =====================================================

function success(data) {
  return ContentService.createTextOutput(
    JSON.stringify({ success: true, data: data })
  ).setMimeType(ContentService.MimeType.JSON);
}

function error(message) {
  return ContentService.createTextOutput(
    JSON.stringify({ success: false, error: message })
  ).setMimeType(ContentService.MimeType.JSON);
}

// =====================================================
// STUBS - Reemplaza con tus funciones reales
// =====================================================

function EMISION_FACTURA_A(datos) {
  // TODO: Implementar con tu lógica real de V2_Emision.gs
  return { status: 'emitido', cae: '20261014001' };
}

function EMISION_FACTURA_B(datos) {
  return { status: 'emitido', cae: '20261014002' };
}

function EMISION_NOTA_CREDITO_A(datos) {
  return { status: 'emitido', cae: '20261014003' };
}

function EMISION_NOTA_CREDITO_B(datos) {
  return { status: 'emitido', cae: '20261014004' };
}

function EMISION_NOTA_DEBITO_A(datos) {
  return { status: 'emitido', cae: '20261014005' };
}

function EMISION_NOTA_DEBITO_B(datos) {
  return { status: 'emitido', cae: '20261014006' };
}

function GENERAR_PDF_POR_CAE(cae, tipo) {
  // TODO: Implementar con tu lógica real
  return 'https://ejemplo.com/pdf/' + cae + '.pdf';
}

function PROCESAR_CSV_MERCADOPAGO(csv) {
  // TODO: Implementar con tu lógica real
  return { procesados: 5, errores: 0 };
}

function PROCESAR_CSV_CLOVER(csv) {
  return { procesados: 3, errores: 0 };
}

function PROCESAR_CSV_GETNET(csv) {
  return { procesados: 2, errores: 1 };
}
```