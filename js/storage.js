const Storage = (() => {
  let dirHandle = null;
  const DB_NAME = "ohmymanual";
  const STORE = "handles";

  function idb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function rememberHandle(handle) {
    try {
      const db = await idb();
      db.transaction(STORE, "readwrite").objectStore(STORE).put(handle, "last");
    } catch (e) { /* 저장 실패 시 매번 폴더 선택 */ }
  }

  async function lastHandle() {
    try {
      const db = await idb();
      return await new Promise((resolve) => {
        const req = db.transaction(STORE).objectStore(STORE).get("last");
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) { return null; }
  }

  function isSupported() {
    return "showDirectoryPicker" in window;
  }

  async function pickFolder() {
    dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    rememberHandle(dirHandle);
    return dirHandle.name;
  }

  async function reopenLast() {
    const h = await lastHandle();
    if (!h) return null;
    const perm = await h.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") return null;
    dirHandle = h;
    return dirHandle.name;
  }

  async function lastFolderName() {
    const h = await lastHandle();
    return h ? h.name : null;
  }

  async function kvPut(key, val) {
    const db = await idb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  async function kvGet(key) {
    const db = await idb();
    return new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async function getAttachRoots() {
    try {
      const list = await kvGet("attachRoots");
      if (Array.isArray(list)) return list;
      const old = await kvGet("attachRoot");
      return old ? [{ id: "r_legacy", name: old.handle.name, handle: old.handle, abs: old.abs }] : [];
    } catch (e) { return []; }
  }

  async function setAttachRoots(list) {
    await kvPut("attachRoots", list);
  }

  function isValid(b) {
    return b && typeof b.id === "string" && typeof b.title === "string" && Array.isArray(b.rows);
  }

  async function loadAll() {
    const blocks = [];
    const errors = [];
    for await (const entry of dirHandle.values()) {
      if (entry.kind !== "file" || !entry.name.endsWith(".json")) continue;
      try {
        const file = await entry.getFile();
        const data = JSON.parse(await file.text());
        if (!isValid(data)) throw new Error("스키마 불일치");
        data.categories = Array.isArray(data.categories) ? data.categories : [];
        if (Array.isArray(data.attachments) && data.attachments.length) {
          data.rows.push({ type: "step", text: "첨부파일", attachments: data.attachments });
        }
        delete data.attachments;
        blocks.push(data);
      } catch (e) {
        errors.push(entry.name + ": " + e.message);
      }
    }
    return { blocks, errors };
  }

  async function save(block) {
    block.schemaVersion = 1;
    delete block.attachments;
    block.updatedAt = new Date().toISOString();
    const handle = await dirHandle.getFileHandle(block.id + ".json", { create: true });
    const w = await handle.createWritable();
    await w.write(JSON.stringify(block, null, 2));
    await w.close();
    return block;
  }

  async function remove(id) {
    await dirHandle.removeEntry(id + ".json");
  }

  function newId() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const rnd = Math.random().toString(36).slice(2, 6);
    return "b_" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + rnd;
  }

  return { isSupported, pickFolder, reopenLast, lastFolderName, loadAll, save, remove, newId, getAttachRoots, setAttachRoots, hasFolder: () => !!dirHandle };
})();
