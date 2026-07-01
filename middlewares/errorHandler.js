'use strict';

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const isDev = process.env.NODE_ENV === 'development';

  // JSON para: rutas /api, XHR, Accept:json, o cualquier verbo que no sea GET
  const isJsonRequest =
    req.path.startsWith('/api') ||
    req.xhr ||
    (req.headers.accept && req.headers.accept.includes('application/json')) ||
    req.method !== 'GET';

  if (isJsonRequest) {
    return res.status(status).json({
      success: false,
      message: err.message || 'Error interno del servidor',
      ...(isDev && { error: err.stack }),
    });
  }

  // Para vistas GET renderiza página de error
  return res.status(status).render('error', {
    title: `Error ${status}`,
    message: err.message || 'Error interno del servidor',
    status,
    user: req.user || null,
    stack: isDev ? err.stack : null,
  });
};

module.exports = errorHandler;
