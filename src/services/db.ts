import Dexie, { type EntityTable } from 'dexie';
import type { MediaObject, Session, TriggerChain, ChainedMediaObject } from '../types';

const db = new Dexie('kontextlager') as Dexie & {
  objects: EntityTable<MediaObject, 'id'>;
  sessions: EntityTable<Session, 'id'>;
  chains: EntityTable<TriggerChain, 'id'>;
};

db.version(1).stores({
  objects: 'id, title, createdAt, active, [location.lat+location.lng]',
  sessions: 'id, createdAt',
});

// Version 2: Lägg till chains-tabell och kedjeindex
db.version(2).stores({
  objects: 'id, title, createdAt, active, chainId, chainOrder, [location.lat+location.lng]',
  sessions: 'id, createdAt',
  chains: 'id, title, createdAt',
});

export { db };

// Media Object operations
export async function getAllObjects(): Promise<MediaObject[]> {
  return db.objects.toArray();
}

export async function getObject(id: string): Promise<MediaObject | undefined> {
  return db.objects.get(id);
}

export async function saveObject(obj: MediaObject): Promise<string> {
  try {
    // Compress image if it's too large (> 500KB)
    if (obj.imageBlob && obj.imageBlob.size > 500 * 1024) {
      obj.imageBlob = await compressImage(obj.imageBlob, 0.7, 1200);
    }
    return await db.objects.put(obj);
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new Error('Lagringsutrymmet är fullt. Radera några objekt och försök igen.');
    }
    throw error;
  }
}

// Get storage estimate
export async function getStorageEstimate(): Promise<{ used: number; quota: number } | null> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return null;
}

// Compress image to reduce storage
async function compressImage(blob: Blob, quality: number, maxSize: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if too large
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(blob);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (result) => resolve(result || blob),
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };

    img.src = url;
  });
}

export async function deleteObject(id: string): Promise<void> {
  await db.objects.delete(id);
}

export async function getActiveObjects(): Promise<MediaObject[]> {
  return db.objects.where('active').equals(1).toArray();
}

// Export/Import
export async function exportAllObjects(): Promise<string> {
  const objects = await getAllObjects();

  // Convert Blobs to base64 for export
  const exportData = await Promise.all(
    objects.map(async (obj) => {
      const exported: Record<string, unknown> = { ...obj };

      if (obj.imageBlob) {
        exported.imageBase64 = await blobToBase64(obj.imageBlob);
        delete exported.imageBlob;
      }
      if (obj.audioBlob) {
        exported.audioBase64 = await blobToBase64(obj.audioBlob);
        delete exported.audioBlob;
      }

      return exported;
    })
  );

  return JSON.stringify(exportData, null, 2);
}

interface ExportedMediaObject extends Omit<MediaObject, 'imageBlob' | 'audioBlob'> {
  imageBase64?: string;
  audioBase64?: string;
}

export async function importObjects(jsonString: string): Promise<number> {
  const data = JSON.parse(jsonString) as ExportedMediaObject[];

  const objects: MediaObject[] = await Promise.all(
    data.map(async (item) => {
      const obj: Partial<MediaObject> & { imageBase64?: string; audioBase64?: string } = { ...item };

      if (obj.imageBase64) {
        obj.imageBlob = await base64ToBlob(obj.imageBase64);
        delete obj.imageBase64;
      }
      if (obj.audioBase64) {
        obj.audioBlob = await base64ToBlob(obj.audioBase64);
        delete obj.audioBase64;
      }

      return obj as MediaObject;
    })
  );

  await db.objects.bulkPut(objects);
  return objects.length;
}

// Helper functions
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string): Promise<Blob> {
  return fetch(base64).then((res) => res.blob());
}

// ===== CHAIN OPERATIONS =====

export async function saveChain(chain: TriggerChain): Promise<string> {
  return db.chains.put(chain);
}

export async function getChain(id: string): Promise<TriggerChain | undefined> {
  return db.chains.get(id);
}

export async function getAllChains(): Promise<TriggerChain[]> {
  return db.chains.toArray();
}

export async function deleteChain(id: string): Promise<void> {
  await db.transaction('rw', [db.chains, db.objects], async () => {
    await db.chains.delete(id);
    // Nollställ chainId på alla objekt i kedjan
    await db.objects
      .where('chainId')
      .equals(id)
      .modify({ chainId: undefined, chainOrder: undefined });
  });
}

export async function getObjectsInChain(chainId: string): Promise<ChainedMediaObject[]> {
  const objects = await db.objects.where('chainId').equals(chainId).toArray();
  return objects.sort((a, b) => {
    const orderA = (a as ChainedMediaObject).chainOrder || 0;
    const orderB = (b as ChainedMediaObject).chainOrder || 0;
    return orderA - orderB;
  }) as ChainedMediaObject[];
}

export async function addObjectToChain(
  objectId: string,
  chainId: string,
  order?: number
): Promise<void> {
  const chain = await getChain(chainId);
  if (!chain) throw new Error('Kedja hittades inte');

  // Uppdatera objektet
  await db.objects.update(objectId, {
    chainId,
    chainOrder: order ?? chain.triggerIds.length,
  });

  // Lägg till i kedjan om det inte redan finns
  if (!chain.triggerIds.includes(objectId)) {
    chain.triggerIds.push(objectId);
    chain.updatedAt = Date.now();
    await db.chains.put(chain);
  }
}

export async function removeObjectFromChain(objectId: string): Promise<void> {
  const obj = await db.objects.get(objectId);
  if (!obj || !(obj as ChainedMediaObject).chainId) return;

  const chainId = (obj as ChainedMediaObject).chainId!;
  const chain = await getChain(chainId);

  // Ta bort kedje-referens från objektet
  await db.objects.update(objectId, {
    chainId: undefined,
    chainOrder: undefined,
    armCondition: undefined,
  });

  // Ta bort från kedjan
  if (chain) {
    chain.triggerIds = chain.triggerIds.filter((id) => id !== objectId);
    chain.updatedAt = Date.now();
    await db.chains.put(chain);
  }
}

// Export blobToBase64 for chain export
export { blobToBase64 };
