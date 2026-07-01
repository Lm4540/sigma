'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('User', {
  id:                { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  name:              { type: DataTypes.STRING(100), allowNull: false },
  email:             { type: DataTypes.STRING(100), allowNull: false, unique: true },
  password:          { type: DataTypes.STRING(255), allowNull: false },
  roleId:            { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  branchId:          { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  specialPermissions: {
    type: DataTypes.JSON, allowNull: true,
    get() {
      const raw = this.getDataValue('specialPermissions');
      return raw && typeof raw === 'string' ? JSON.parse(raw) : raw;
    },
  },
  loginAttempts:     { type: DataTypes.TINYINT, defaultValue: 0 },
  lockUntil:         { type: DataTypes.DATE, allowNull: true },
  status:            { type: DataTypes.ENUM('on', 'off'), defaultValue: 'on' },
  webAuthnEnabled:   { type: DataTypes.TINYINT(1), defaultValue: 0 },
  createdBy:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  tableName: 'Users',
  timestamps: true,
  defaultScope: { attributes: { exclude: ['password'] } },
  scopes: { withPassword: { attributes: {} } },
});
