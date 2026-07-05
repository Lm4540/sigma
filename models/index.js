'use strict';

const { Sequelize } = require('sequelize');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);

// Importar modelos
const Role             = require('./Role')(sequelize, Sequelize.DataTypes);
const Branch           = require('./Branch')(sequelize, Sequelize.DataTypes);
const User             = require('./User')(sequelize, Sequelize.DataTypes);
const UserCredential   = require('./UserCredential')(sequelize, Sequelize.DataTypes);
const RevokedToken     = require('./RevokedToken')(sequelize, Sequelize.DataTypes);
const Client           = require('./Client')(sequelize, Sequelize.DataTypes);
const ClientAssignment = require('./ClientAssignment')(sequelize, Sequelize.DataTypes);
const ClientContact    = require('./ClientContact')(sequelize, Sequelize.DataTypes);
const CollectionLog    = require('./CollectionLog')(sequelize, Sequelize.DataTypes);
const PushSubscription = require('./PushSubscription')(sequelize, Sequelize.DataTypes);
const Task             = require('./Task')(sequelize, Sequelize.DataTypes);
const AuditLog         = require('./AuditLog')(sequelize, Sequelize.DataTypes);
const SystemConfig     = require('./SystemConfig')(sequelize, Sequelize.DataTypes);
const LegalCase        = require('./LegalCase')(sequelize, Sequelize.DataTypes);
const LegalDocument    = require('./LegalDocument')(sequelize, Sequelize.DataTypes);

// Asociaciones
User.belongsTo(Role,   { foreignKey: 'roleId',   as: 'role' });
User.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });
Role.hasMany(User,     { foreignKey: 'roleId' });
Branch.hasMany(User,   { foreignKey: 'branchId' });
Branch.hasMany(Client, { foreignKey: 'branchId' });

User.hasMany(UserCredential,   { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(RevokedToken,     { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(CollectionLog,    { foreignKey: 'userId' });
User.hasMany(ClientAssignment, { foreignKey: 'userId', as: 'assignments' });
User.hasMany(PushSubscription, { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(Task,             { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(AuditLog,         { foreignKey: 'userId' });

Client.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });
Client.hasMany(CollectionLog,    { foreignKey: 'clientId', onDelete: 'CASCADE' });
Client.hasMany(ClientAssignment, { foreignKey: 'clientId', onDelete: 'CASCADE' });
Client.hasMany(ClientContact,    { foreignKey: 'clientId', onDelete: 'CASCADE' });
Client.hasMany(Task,             { foreignKey: 'clientId' });

ClientAssignment.belongsTo(Client, { foreignKey: 'clientId' });
ClientAssignment.belongsTo(User,   { foreignKey: 'userId',     as: 'gestor' });
ClientAssignment.belongsTo(User,   { foreignKey: 'assignedBy', as: 'assignedByUser' });

CollectionLog.belongsTo(Client, { foreignKey: 'clientId' });
CollectionLog.belongsTo(User,   { foreignKey: 'userId',       as: 'gestor' });
CollectionLog.belongsTo(User,   { foreignKey: 'reviewedBy',   as: 'reviewer' });
CollectionLog.belongsTo(User,   { foreignKey: 'authorizedBy', as: 'authorizer' });
CollectionLog.belongsTo(User,   { foreignKey: 'appliedBy',    as: 'applier' });

Task.belongsTo(User,   { foreignKey: 'userId' });
Task.belongsTo(Client, { foreignKey: 'clientId' });

AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'User', constraints: false });

LegalCase.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });
LegalCase.belongsTo(User,   { foreignKey: 'assignedTo', as: 'assignee', constraints: false });
LegalCase.belongsTo(User,   { foreignKey: 'createdBy',  as: 'creator',  constraints: false });
LegalCase.hasMany(LegalDocument, { foreignKey: 'caseId', as: 'documents', onDelete: 'CASCADE' });

LegalDocument.belongsTo(LegalCase,  { foreignKey: 'caseId',   as: 'case' });
LegalDocument.belongsTo(Client,     { foreignKey: 'clientId', as: 'client' });
LegalDocument.belongsTo(User,       { foreignKey: 'uploadedBy', as: 'uploader', constraints: false });

Client.hasOne(LegalCase, { foreignKey: 'clientId', as: 'legalCase' });

module.exports = {
  sequelize,
  Sequelize,
  Role,
  Branch,
  User,
  UserCredential,
  RevokedToken,
  Client,
  ClientAssignment,
  ClientContact,
  CollectionLog,
  PushSubscription,
  Task,
  AuditLog,
  SystemConfig,
  LegalCase,
  LegalDocument,
};
