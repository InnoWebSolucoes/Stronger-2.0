import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Minimal key/value persistence for the in-progress workout.
 *
 * This is INTERIM. The real write path is WAL-backed SQLite in src/db, which
 * gives per-set durability. Until that is wired, this exists so that closing
 * the app mid-session does not lose the workout — that promise is the whole
 * product, so it cannot wait for the proper implementation.
 *
 * Uses the SDK 54+ File/Directory API; the legacy `documentDirectory` string
 * helpers were removed in expo-file-system 57.
 *
 * Writes are fire-and-forget and must never throw into the UI: failing to
 * persist a set is bad, but crashing the app mid-workout is worse.
 */

const isWeb = Platform.OS === 'web';

function dir(): Directory {
  return new Directory(Paths.document, 'stronger');
}

function fileFor(key: string): File {
  return new File(dir(), `${key}.json`);
}

export async function loadRaw(key: string): Promise<string | null> {
  try {
    if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
    const f = fileFor(key);
    if (!f.exists) return null;
    return f.textSync();
  } catch {
    return null;
  }
}

export async function saveRaw(key: string, value: string): Promise<void> {
  try {
    if (isWeb) {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    const d = dir();
    if (!d.exists) d.create({ intermediates: true });
    fileFor(key).write(value);
  } catch {
    // Swallowed deliberately — see the note above.
  }
}

export async function removeRaw(key: string): Promise<void> {
  try {
    if (isWeb) {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    const f = fileFor(key);
    if (f.exists) f.delete();
  } catch {
    // Swallowed deliberately.
  }
}
