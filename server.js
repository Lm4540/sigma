'use strict';

require('dotenv').config();

const http       = require('http');
const { Server } = require('socket.io');
const app        = require('./app');
const { sequelize } = require('./models');
const cronJobs   = require('./cron/jobs');

const PORT = parseInt(process.env.PORT) || 3000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: false },
});

// Hacer disponible io en los controladores
app.set('io', io);

io.on('connection', (socket) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Socket.io] Cliente conectado: ${socket.id}`);
  }
  socket.on('disconnect', () => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);
    }
  });
});

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('[DB] Conexión establecida correctamente');

    cronJobs.init();
    console.log('[Cron] Trabajos programados iniciados');

    server.listen(PORT, () => {
      console.log(`[SIGMA] Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[SIGMA] Error al iniciar:', err);
    process.exit(1);
  }
};

start();
