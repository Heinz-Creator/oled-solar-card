const databaseName = 'oled-solar-photos';
const fileTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export function photoSource(value) {
  if (typeof value !== 'string') return '';
  const path = value.trim();
  if (/^\/local\/[^\s\\]+$/.test(path)) {
    const url = new URL(path, 'https://local.invalid');
    if (url.pathname.startsWith('/local/')) return url.pathname + url.search + url.hash;
    return '';
  }
  try {
    const url = new URL(path);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {}
  return '';
}

function photoDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Der Fotospeicher ist belegt.'));
  });
}

async function transaction(key, mode, perform) {
  const db = await photoDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('photos', mode);
      const request = perform(tx.objectStore('photos'), key);
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error ?? request.error);
      tx.onerror = () => reject(tx.error ?? request.error);
    });
  } finally {
    db.close();
  }
}

export const readPhoto = key => transaction(key, 'readonly', (store, id) => store.get(id));
export const writePhoto = (key, file) => transaction(key, 'readwrite', (store, id) => store.put(file, id));
export const deletePhoto = key => transaction(key, 'readwrite', (store, id) => store.delete(id));

export async function preparePhoto(file) {
  if (!fileTypes.has(file.type)) throw new Error('Bitte wähle ein JPG-, PNG-, WebP- oder AVIF-Bild.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Das Bild darf höchstens 20 MB groß sein.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); }
    catch { throw new Error('Das Bild konnte nicht gelesen werden. Probiere eine andere Bilddatei.'); }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Die Datei enthält kein lesbares Bild.');
    const scale = Math.min(1, 1600 / image.naturalWidth, 1200 / image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const photo = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .88));
    if (!photo) throw new Error('Das Foto konnte nicht vorbereitet werden.');
    return photo;
  } finally {
    URL.revokeObjectURL(url);
  }
}
