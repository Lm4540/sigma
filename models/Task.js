'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('Task', {
  id:          { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  userId:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  clientId:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  title:       { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  dueDate:     { type: DataTypes.DATE, allowNull: false },
  priority:    { type: DataTypes.ENUM('baja', 'media', 'alta'), defaultValue: 'media' },
  status:      { type: DataTypes.ENUM('pendiente', 'completada', 'vencida'), defaultValue: 'pendiente' },
  isNotified:  { type: DataTypes.TINYINT(1), defaultValue: 0 },
  createdBy:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { tableName: 'tasks', timestamps: true });
