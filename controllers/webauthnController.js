'use strict';

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

const { User, UserCredential } = require('../models');
const auditService = require('../services/auditService');

const RP_NAME   = process.env.WEBAUTHN_RP_NAME   || 'SIGMA Cobranza';
const RP_ID     = process.env.WEBAUTHN_RP_ID     || 'localhost';
const ORIGIN    = process.env.WEBAUTHN_ORIGIN    || 'http://localhost:3000';

/* ── Registro ─────────────────────────────────────────── */
const registrationOptions = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const existingCredentials = await UserCredential.findAll({ where: { userId: user.id } });

    const options = await generateRegistrationOptions({
      rpName:               RP_NAME,
      rpID:                 RP_ID,
      userID:               Buffer.from(String(user.id)),
      userName:             user.email,
      userDisplayName:      user.name,
      attestationType:      'none',
      excludeCredentials:   existingCredentials.map(c => ({
        id:         c.credentialId,   // v13+: base64url string, no Buffer
        transports: c.transports ? c.transports.split(',') : [],
      })),
      authenticatorSelection: {
        residentKey:      'preferred',
        userVerification: 'preferred',
      },
    });

    res.cookie('webauthn_challenge', options.challenge, {
      httpOnly: true, sameSite: 'Strict', maxAge: 5 * 60 * 1000,
    });

    res.json({ success: true, options });
  } catch (err) { next(err); }
};

const registrationVerify = async (req, res, next) => {
  try {
    const challenge = req.cookies?.webauthn_challenge;
    if (!challenge) return res.status(400).json({ success: false, message: 'Challenge expirado' });

    const verification = await verifyRegistrationResponse({
      response:             req.body,
      expectedChallenge:    challenge,
      expectedOrigin:       ORIGIN,
      expectedRPID:         RP_ID,
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return res.status(400).json({ success: false, message: 'Verificación fallida' });
    }

    const { credential } = verification.registrationInfo;

    await UserCredential.create({
      userId:       req.user.userId,
      credentialId: Buffer.from(credential.id).toString('base64url'),
      publicKey:    Buffer.from(credential.publicKey).toString('base64'),
      counter:      credential.counter,
      transports:   (req.body.response?.transports || []).join(','),
    });

    await User.update({ webAuthnEnabled: 1 }, { where: { id: req.user.userId } });

    res.clearCookie('webauthn_challenge');
    res.json({ success: true, message: 'Biometría registrada correctamente' });
  } catch (err) { next(err); }
};

/* ── Autenticación ────────────────────────────────────── */
const authOptions = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email requerido' });

    const user = await User.findOne({ where: { email } });
    if (!user || !user.webAuthnEnabled) {
      return res.status(400).json({ success: false, message: 'Biometría no registrada para este usuario' });
    }

    const credentials = await UserCredential.findAll({ where: { userId: user.id } });
    if (!credentials.length) {
      return res.status(400).json({ success: false, message: 'Sin credenciales biométricas' });
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: credentials.map(c => ({
        id:         c.credentialId,   // v13+: base64url string, no Buffer
        transports: c.transports ? c.transports.split(',') : [],
      })),
      userVerification: 'preferred',
    });

    res.cookie('webauthn_challenge', options.challenge, {
      httpOnly: true, sameSite: 'Strict', maxAge: 5 * 60 * 1000,
    });
    res.cookie('webauthn_uid', String(user.id), {
      httpOnly: true, sameSite: 'Strict', maxAge: 5 * 60 * 1000,
    });

    res.json({ success: true, options });
  } catch (err) { next(err); }
};

const authVerify = async (req, res, next) => {
  try {
    const challenge = req.cookies?.webauthn_challenge;
    const uid       = parseInt(req.cookies?.webauthn_uid);
    if (!challenge || !uid) return res.status(400).json({ success: false, message: 'Challenge expirado' });

    const credential = await UserCredential.findOne({ where: { credentialId: req.body.id } });
    if (!credential || credential.userId !== uid) {
      return res.status(400).json({ success: false, message: 'Credencial no encontrada' });
    }

    const verification = await verifyAuthenticationResponse({
      response:             req.body,
      expectedChallenge:    challenge,
      expectedOrigin:       ORIGIN,
      expectedRPID:         RP_ID,
      requireUserVerification: false,
      credential: {
        id:         credential.credentialId,             // v13+: string
        publicKey:  Buffer.from(credential.publicKey, 'base64'),
        counter:    Number(credential.counter),
        transports: credential.transports ? credential.transports.split(',') : [],
      },
    });

    if (!verification.verified) {
      return res.status(401).json({ success: false, message: 'Autenticación biométrica fallida' });
    }

    await credential.update({ counter: verification.authenticationInfo.newCounter });

    const user = await User.findByPk(uid);
    if (!user || user.status !== 'on') {
      return res.status(403).json({ success: false, message: 'Cuenta inactiva o bloqueada' });
    }

    const jti   = uuidv4();
    const token = jwt.sign(
      { userId: user.id, roleId: user.roleId, branchId: user.branchId, jti },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.cookie('token', token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict', maxAge: 8 * 60 * 60 * 1000,
    });

    res.clearCookie('webauthn_challenge');
    res.clearCookie('webauthn_uid');

    auditService.log({ userId: user.id, action: 'user.login', entity: 'Users', entityId: user.id, newValue: { method: 'webauthn' }, ipAddress: req.ip, userAgent: req.get('user-agent') });

    const LANDING = { 1: '/dashboard', 2: '/dashboard', 3: '/dashboard', 4: '/collections/pending' };
    res.json({ success: true, redirect: LANDING[user.roleId] || '/dashboard' });
  } catch (err) { next(err); }
};

/* ── Eliminar credenciales biométricas ────────────────── */
const deleteCredentials = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    await UserCredential.destroy({ where: { userId } });
    await User.update({ webAuthnEnabled: 0 }, { where: { id: userId } });
    res.json({ success: true, message: 'Credenciales biométricas eliminadas' });
  } catch (err) { next(err); }
};

module.exports = { registrationOptions, registrationVerify, authOptions, authVerify, deleteCredentials };
