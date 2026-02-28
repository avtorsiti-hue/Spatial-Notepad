import { openDB, DBSchema } from 'idb';

interface SpatialNotepadDB extends DBSchema {
  nodes: {
    key: string;
    value: any;
  };
  edges: {
    key: string;
    value: any;
  };
  appState: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'spatial-notepad-db';
const DB_VERSION = 1;

export const initDB = async () => {
  return openDB<SpatialNotepadDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('nodes')) {
        db.createObjectStore('nodes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('edges')) {
        db.createObjectStore('edges', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('appState')) {
        db.createObjectStore('appState', { keyPath: 'id' });
      }
    },
  });
};

export const saveNodes = async (nodes: any[]) => {
  const db = await initDB();
  const tx = db.transaction('nodes', 'readwrite');
  const store = tx.objectStore('nodes');
  await store.clear();
  for (const node of nodes) {
    await store.put(node);
  }
  await tx.done;
};

export const loadNodes = async () => {
  const db = await initDB();
  return db.getAll('nodes');
};

export const saveEdges = async (edges: any[]) => {
  const db = await initDB();
  const tx = db.transaction('edges', 'readwrite');
  const store = tx.objectStore('edges');
  await store.clear();
  for (const edge of edges) {
    await store.put(edge);
  }
  await tx.done;
};

export const loadEdges = async () => {
  const db = await initDB();
  return db.getAll('edges');
};

export const saveAppState = async (state: any) => {
  const db = await initDB();
  await db.put('appState', { id: 'main', ...state });
};

export const loadAppState = async () => {
  const db = await initDB();
  return db.get('appState', 'main');
};
