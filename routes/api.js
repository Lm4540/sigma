'use strict';

// Endpoints JSON para consumo del frontend PWA
const router = require('express').Router();
const checkPermission = require('../middlewares/checkPermission');
const { User, Client } = require('../models');

// Búsqueda rápida de clientes (autocomplete)
router.get('/clients/search', checkPermission('view_clients'), async (req, res, next) => {
  try {
    const { q } = req.query;
    const { Op } = require('sequelize');
    const clients = await Client.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { clientCode: { [Op.like]: `%${q}%` } },
          { loanNumber: { [Op.like]: `%${q}%` } },
        ],
      },
      attributes: ['id', 'name', 'clientCode', 'loanNumber', 'riskCategory'],
      limit: 10,
    });
    res.json({ success: true, data: clients });
  } catch (err) { next(err); }
});

// Lista de gestores (para asignaciones)
router.get('/users/gestores', checkPermission('manage_assignments'), async (req, res, next) => {
  try {
    const gestores = await User.findAll({
      where: { roleId: 3, status: 'on' },
      attributes: ['id', 'name'],
    });
    res.json({ success: true, data: gestores });
  } catch (err) { next(err); }
});

// Registro de suscripción Web Push
router.post('/push-subscription', async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ success: false, message: 'Suscripción inválida' });
    }
    const { sequelize } = require('../models');
    const userId = req.user.userId;
    const subscriptionJson = JSON.stringify({ endpoint, keys });
    // Reemplazar suscripción existente del mismo usuario en este dispositivo (por endpoint)
    await sequelize.query(
      `DELETE FROM pushsubscriptions WHERE userId = :userId AND JSON_UNQUOTE(JSON_EXTRACT(subscription, '$.endpoint')) = :endpoint`,
      { replacements: { userId, endpoint } }
    );
    await sequelize.query(
      `INSERT INTO pushsubscriptions (userId, subscription, createdAt) VALUES (:userId, :subscription, NOW())`,
      { replacements: { userId, subscription: subscriptionJson } }
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// VAPID public key para el cliente
router.get('/push-vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

module.exports = router;
