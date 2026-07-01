'use strict';

const { Branch } = require('../models');

const index = async (req, res, next) => {
  try {
    const branches = await Branch.findAll({ order: [['name', 'ASC']] });
    res.render('branches/index', { title: 'Sucursales', user: req.user, branches });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { name, address, phone } = req.body;
    const branch = await Branch.create({ name, address, phone, createdBy: req.user.userId });
    res.status(201).json({ success: true, data: { id: branch.id } });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const branch = await Branch.findByPk(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: 'Sucursal no encontrada' });
    await branch.update(req.body);
    res.json({ success: true });
  } catch (err) { next(err); }
};

const toggleStatus = async (req, res, next) => {
  try {
    const branch = await Branch.findByPk(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: 'Sucursal no encontrada' });
    await branch.update({ status: branch.status === 'on' ? 'off' : 'on' });
    res.json({ success: true, status: branch.status });
  } catch (err) { next(err); }
};

module.exports = { index, create, update, toggleStatus };
