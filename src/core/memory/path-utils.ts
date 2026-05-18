import { access } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

export class MemoryPathUtils {
  static resolveMemoryPath(memoryRoot: string, requestedPath: string): { ok: true; path: string } | { ok: false; error: string } {
    if (!requestedPath.trim()) {
      return { ok: false, error: `Memory note paths must be non-empty and stay inside ${memoryRoot}.` };
    }

    const targetPath = resolve(memoryRoot, requestedPath);
    const rel = relative(memoryRoot, targetPath);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return { ok: false, error: `Memory note paths must stay inside ${memoryRoot}. Refusing to access ${targetPath}.` };
    }

    return { ok: true, path: targetPath };
  }

  static toMemoryRelativePath(memoryRoot: string, filePath: string): string {
    return relative(memoryRoot, filePath) || '.';
  }

  static async pathExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  static isErrorWithCode(error: unknown, code: string): error is Error & { code: string } {
    return error instanceof Error && 'code' in error && error.code === code;
  }
}
