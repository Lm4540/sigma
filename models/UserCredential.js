'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('UserCredential', {
  id:           { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  userId:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  credentialId: { type: DataTypes.STRING(1024), allowNull: false },
  publicKey:    { type: DataTypes.TEXT, allowNull: false },
  counter:      { type: DataTypes.BIGINT, allowNull: false },
  transports:   { type: DataTypes.STRING(255), allowNull: true },
}, { tableName: 'usercredentials', timestamps: false, updatedAt: false });
