// EPIC_A.A4: Helper para renderizar templates EJS en tests de vistas

const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

/**
 * Renderiza una vista EJS con datos mock para tests unitarios de vistas
 * @param {string} viewName - Nombre del archivo EJS (ej: 'feed/index')
 * @param {object} data - Datos para pasar al template
 * @returns {string} HTML renderizado
 */
function renderTemplate(viewName, data = {}) {
  const templatePath = path.join(__dirname, '..', '..', 'views', `${viewName}.ejs`);

  // Leer archivo template
  const templateContent = fs.readFileSync(templatePath, 'utf8');

  // Datos por defecto que suelen estar en las vistas
  const defaultData = {
    t: (key) => key, // Función de traducción mock
    i18n: { language: 'en' },
    req: { t: (key) => key, i18n: { language: 'en' } },
    apiUrl: 'http://localhost:8000',
    appName: 'DietIntel',
    currentYear: new Date().getFullYear(),
    ...data
  };

  // Renderizar con EJS
  try {
    const html = ejs.render(templateContent, defaultData, {
      views: path.join(__dirname, '..', '..', 'views'),
      filename: templatePath
    });
    return html;
  } catch (error) {
    throw new Error(`Failed to render template ${viewName}: ${error.message}`);
  }
}

module.exports = { renderTemplate };
