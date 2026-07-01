/* SIGMA — Offline sync utilities */
'use strict';

const DB_NAME    = 'sigma-offline';
const STORE_NAME = 'pending-collections';
const DB_VERSION = 1;

const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = (e) => {
    e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
  };
  req.onsuccess  = (e) => resolve(e.target.result);
  req.onerror    = (e) => reject(e.target.error);
});

/**
 * Guarda una gestión pendiente en IndexedDB.
 * @param {FormData} formData — campos del formulario
 * @param {Blob|null} evidenceBlob — imagen ya comprimida (o null)
 */
const saveOffline = async (formData, evidenceBlob = null) => {
  const db   = await openDB();
  const data = {};
  for (const [k, v] of formData.entries()) {
    if (v instanceof File || v instanceof Blob) continue; // lo manejamos aparte
    data[k] = v;
  }
  if (evidenceBlob) {
    data._evidence = await evidenceBlob.arrayBuffer();
    data._evidenceMime = evidenceBlob.type || 'image/jpeg';
    data._evidenceName = 'evidence.jpg';
  }
  data._timestamp = Date.now();

  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
};

const getPending = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
};

const deletePending = async (id) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
};

/**
 * Intenta enviar todas las gestiones pendientes al servidor.
 * Llámalo cuando se recupere la conexión o el SW dispare sync-trigger.
 * @returns {Promise<number>} cantidad de gestiones enviadas exitosamente
 */
const processPending = async () => {
  const pending = await getPending();
  if (!pending.length) return 0;

  let sent = 0;
  for (const record of pending) {
    try {
      const fd = new FormData();
      const { id, _timestamp, _evidence, _evidenceMime, _evidenceName, ...fields } = record;
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      if (_evidence) {
        fd.append('evidence', new Blob([_evidence], { type: _evidenceMime }), _evidenceName);
      }
      const r = await fetch('/collections', { method: 'POST', body: fd });
      if (r.ok) {
        await deletePending(id);
        sent++;
      }
    } catch (_) { /* sin conexión todavía — intentar en el próximo ciclo */ }
  }
  return sent;
};

// Escuchar mensaje del Service Worker (Background Sync)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', async (e) => {
    if (e.data?.type === 'sync-trigger') {
      const sent = await processPending();
      if (sent > 0 && window.sigma) {
        window.sigma.toast(`${sent} gestión(es) sincronizada(s) correctamente`, 'success');
      }
    }
  });
}

// Procesar automáticamente al recuperar conexión
window.addEventListener('online', async () => {
  const sent = await processPending();
  if (sent > 0 && window.sigma) {
    window.sigma.toast(`${sent} gestión(es) sincronizada(s) correctamente`, 'success');
  }
});

window.sigmaSync = { saveOffline, getPending, deletePending, processPending };
