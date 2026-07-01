'use strict';

require('dotenv').config();

const express    = require('express');
const path       = require('path');
const cors       = require('cors');
const morgan     = require('morgan');
const cookieParser = require('cookie-parser');

const { general } = require('./middlewares/rateLimiter');
const errorHandler = require('./middlewares/errorHandler');
const routes       = require('./routes/index');

const app = express();

// Vistas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware base
app.use(cors({ origin: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/legal', express.static(path.join(__dirname, 'uploads', 'legal')));

if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Exponer variables de configuración al frontend vía EJS locals
app.use((req, res, next) => {
  res.locals.IMG_MAX_PX       = parseInt(process.env.IMG_MAX_PX  || 1200);
  res.locals.IMG_QUALITY      = parseFloat(process.env.IMG_QUALITY || 0.8);
  res.locals.webAuthnEnabled  = false; // sobrescrito por authMiddleware cuando el usuario está autenticado
  next();
});

// Rate limiting general
app.use(general);

// Rutas
app.use('/', routes);

// Error handler (debe ir último)
app.use(errorHandler);

module.exports = app;
