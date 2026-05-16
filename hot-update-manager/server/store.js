import { readFile } from 'node:fs/promises';
import { DATA_DIR, STORE_PATH } from './config.js';
import { ensureDir, maskCookie, writeJsonAtomic } from './utils.js';

const DEFAULT_STORE = {
  schemaVersion: 1,
  settings: {
    lanzou: {
      cookie: '',
      folderId: -1,
      lastVerifiedAt: null,
      lastError: '',
    },
    artifactDir: '',
  },
  releases: [],
};

let writeQueue = Promise.resolve();

export async function loadStore() {
  await ensureDir(DATA_DIR);
  try {
    const raw = await readFile(STORE_PATH, 'utf8');
    return normalizeStore(JSON.parse(raw));
  } catch (error) {
    if (error && error.code === 'ENOENT') return structuredClone(DEFAULT_STORE);
    throw error;
  }
}

export async function saveStore(store) {
  writeQueue = writeQueue.then(() => writeJsonAtomic(STORE_PATH, normalizeStore(store)));
  await writeQueue;
}

export async function updateStore(updater) {
  const store = await loadStore();
  const next = await updater(store);
  await saveStore(next || store);
  return next || store;
}

export function publicStore(store) {
  return {
    schemaVersion: store.schemaVersion,
    settings: {
      lanzou: {
        folderId: store.settings.lanzou.folderId,
        hasCookie: Boolean(store.settings.lanzou.cookie),
        maskedCookie: maskCookie(store.settings.lanzou.cookie),
        lastVerifiedAt: store.settings.lanzou.lastVerifiedAt,
        lastError: store.settings.lanzou.lastError,
      },
      artifactDir: store.settings.artifactDir,
    },
    releases: store.releases,
  };
}

function normalizeStore(input) {
  const store = { ...structuredClone(DEFAULT_STORE), ...(input || {}) };
  store.settings = { ...DEFAULT_STORE.settings, ...(input?.settings || {}) };
  store.settings.lanzou = { ...DEFAULT_STORE.settings.lanzou, ...(input?.settings?.lanzou || {}) };
  store.settings.artifactDir = typeof input?.settings?.artifactDir === 'string' ? input.settings.artifactDir : '';
  store.releases = Array.isArray(input?.releases) ? input.releases : [];
  return store;
}
