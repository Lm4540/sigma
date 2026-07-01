'use strict';

const cron = require('node-cron');
const { Task, PushSubscription, RevokedToken, sequelize } = require('../models');
const { Op } = require('sequelize');
const webpush = require('web-push');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const init = () => {
  // Notificaciones de tareas — cada 30 minutos
  cron.schedule('*/30 * * * *', async () => {
    try {
      const tasks = await Task.findAll({
        where: {
          status: 'pendiente',
          isNotified: 0,
          dueDate: { [Op.lte]: new Date() },
        },
      });

      for (const task of tasks) {
        const subscriptions = await PushSubscription.findAll({ where: { userId: task.userId } });
        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(sub.subscription, JSON.stringify({
              title: 'Tarea pendiente — SIGMA',
              body: task.title,
              data: { taskId: task.id, clientId: task.clientId },
            }));
          } catch { /* suscripción inválida — ignorar */ }
        }
        await task.update({ isNotified: 1 });
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('[Cron] Notificaciones:', err.message);
    }
  }, { timezone: 'America/El_Salvador' });

  // Actualizar tareas vencidas — diario a las 00:05
  cron.schedule('5 0 * * *', async () => {
    try {
      await Task.update(
        { status: 'vencida' },
        { where: { status: 'pendiente', dueDate: { [Op.lt]: new Date() } } }
      );
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('[Cron] Tareas vencidas:', err.message);
    }
  }, { timezone: 'America/El_Salvador' });

  // Limpiar tokens revocados expirados — diario a las 02:00
  cron.schedule('0 2 * * *', async () => {
    try {
      await RevokedToken.destroy({ where: { expiresAt: { [Op.lt]: new Date() } } });
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('[Cron] Limpieza tokens:', err.message);
    }
  }, { timezone: 'America/El_Salvador' });
};

module.exports = { init };
