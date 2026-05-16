import { createHmac } from 'node:crypto';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from './config.js';
import { parseCookies, safeEqual, sha256Hex } from './utils.js';

function adminPasswordHash() {
  if (process.env.ADMIN_PASSWORD) return sha256Hex(process.env.ADMIN_PASSWORD);
  if (process.env.ADMIN_PASSWORD_SHA256) return process.env.ADMIN_PASSWORD_SHA256.toLowerCase();
  return '';
}

function sessionSecret() {
  return process.env.SESSION_SECRET || sha256Hex(`linecode-hot-update-manager:${adminPasswordHash()}`);
}

function base64urlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64urlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(payload) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

export function assertAuthConfigured() {
  if (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_SHA256) {
    throw new Error('ADMIN_PASSWORD or ADMIN_PASSWORD_SHA256 is required.');
  }
}

export function verifyAdminPassword(password) {
  if (typeof password !== 'string') return false;
  return safeEqual(sha256Hex(password), adminPasswordHash());
}

export function createSessionCookie() {
  const payload = base64urlEncode(JSON.stringify({
    sub: 'admin',
    exp: Date.now() + SESSION_TTL_MS,
  }));
  const token = `${payload}.${sign(payload)}`;
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function verifySessionFromRequest(req) {
  const token = parseCookies(req.headers.cookie || '').get(SESSION_COOKIE_NAME);
  if (!token || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return false;
  try {
    const parsed = JSON.parse(base64urlDecode(payload));
    return parsed.sub === 'admin' && Number(parsed.exp) > Date.now();
  } catch {
    return false;
  }
}

