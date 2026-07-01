'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('RevokedToken', {
  id:        { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  jti:       { type: DataTypes.STRING(36), allowNull: false, unique: true },
  userId:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  revokedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'RevokedTokens', timestamps: false });
