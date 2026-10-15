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
