'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('AuditLog', {
  id:            { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  userId:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  action:        { type: DataTypes.STRING(100), allowNull: false },
  entity:        { type: DataTypes.STRING(50), allowNull: true },
  entityId:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  previousValue: {
    type: DataTypes.JSON, allowNull: true,
    get() { const v = this.getDataValue('previousValue'); return typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v; },
  },
  newValue: {
    type: DataTypes.JSON, allowNull: true,
    get() { const v = this.getDataValue('newValue'); return typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v; },
  },
  ipAddress:     { type: DataTypes.STRING(45), allowNull: true },
  userAgent:     { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'AuditLogs', timestamps: true, updatedAt: false });
