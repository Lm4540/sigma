'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('PushSubscription', {
  id:           { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  userId:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  subscription: {
    type: DataTypes.JSON, allowNull: false,
    get() {
      const raw = this.getDataValue('subscription');
      return raw && typeof raw === 'string' ? JSON.parse(raw) : raw;
    },
  },
}, { tableName: 'PushSubscriptions', timestamps: true, updatedAt: false });
