import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MANAGER_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export const REPO_ROOT = path.resolve(MANAGER_ROOT, '..');
export const DATA_DIR = path.resolve(process.env.HOT_UPDATE_MANAGER_DATA_DIR || path.join(MANAGER_ROOT, 'data'));
export const ARTIFACTS_DIR = path.join(DATA_DIR, 'artifacts');
export const STORE_PATH = path.join(DATA_DIR, 'store.json');
export const CLIENT_DIST_DIR = path.join(MANAGER_ROOT, 'dist', 'client');
export const DEFAULT_ARTIFACT_DIR = path.join(REPO_ROOT, 'dist', 'hot-update');
export const SESSION_COOKIE_NAME = 'linecode_hum_session';
export const SESSION_TTL_MS = Math.max(1, Number(process.env.SESSION_TTL_HOURS || 12)) * 60 * 60 * 1000;
export const PORT = Number(process.env.PORT || 3737);

