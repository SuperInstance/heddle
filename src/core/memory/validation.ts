import { readFile, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import {
  DEFAULT_MEMORY_FOLDER_CATALOG_MAX_BYTES,
  DEFAULT_MEMORY_ROOT_CATALOG_MAX_BYTES,
  MemoryCatalogService,
} from './catalog.js';
import { MemoryMaintenanceRepository } from './maintenance-repository.js';
import { MemoryVisibilityService } from './visibility.js';
import type { MemoryValidationIssue, MemoryValidationResult } from './types.js';

/**
 * Owns memory workspace health checks and lightweight repair actions.
 */
export class MemoryValidationService {
  constructor(
    private readonly memoryRoot: string,
    private readonly catalog = new MemoryCatalogService(memoryRoot),
    private readonly visibility = new MemoryVisibilityService(memoryRoot),
    private readonly maintenance = new MemoryMaintenanceRepository(memoryRoot),
  ) {}

  async validate(): Promise<MemoryValidationResult> {
    const memoryRoot = resolve(this.memoryRoot);
    const issues: MemoryValidationIssue[] = [];
    const shape = this.catalog.validateShape();
    for (const path of shape.missing) {
      issues.push({
        type: 'missing_catalog',
        severity: 'error',
        path,
        message: `Missing required memory catalog: ${path}`,
      });
    }

    const notes = await this.visibility.listNotePaths();
    await this.appendOversizedCatalogIssues(memoryRoot, notes, issues);
    await this.appendOrphanNoteIssues(memoryRoot, notes, issues);

    const pending = await this.maintenance.readPendingCandidates();
    if (pending.length > 0) {
      issues.push({
        type: 'pending_candidates',
        severity: 'info',
        count: pending.length,
        message: `${pending.length} pending memory candidate${pending.length === 1 ? '' : 's'} waiting for maintenance.`,
      });
    }

    return {
      memoryRoot,
      ok: issues.every((issue) => issue.severity !== 'error'),
      issueCount: issues.length,
      issues,
    };
  }

  repairMissingCatalogs() {
    return this.catalog.bootstrap();
  }

  private async appendOversizedCatalogIssues(memoryRoot: string, notes: string[], issues: MemoryValidationIssue[]) {
    for (const path of notes.filter((note) => basename(note).toLowerCase() === 'readme.md')) {
      const fullPath = join(memoryRoot, path);
      const info = await stat(fullPath);
      const maxBytes = path === 'README.md' ? DEFAULT_MEMORY_ROOT_CATALOG_MAX_BYTES : DEFAULT_MEMORY_FOLDER_CATALOG_MAX_BYTES;
      if (info.size <= maxBytes) {
        continue;
      }

      issues.push({
        type: 'oversized_catalog',
        severity: 'warning',
        path,
        sizeBytes: info.size,
        maxBytes,
        message: `Memory catalog ${path} is ${info.size} bytes, above the ${maxBytes} byte cap.`,
      });
    }
  }

  private async appendOrphanNoteIssues(memoryRoot: string, notes: string[], issues: MemoryValidationIssue[]) {
    const catalogPaths = notes.filter((note) => basename(note).toLowerCase() === 'readme.md');
    const catalogTextByPath = new Map<string, string>();
    for (const catalogPath of catalogPaths) {
      catalogTextByPath.set(catalogPath, await readFile(join(memoryRoot, catalogPath), 'utf8'));
    }

    for (const note of notes) {
      if (basename(note).toLowerCase() === 'readme.md') {
        continue;
      }

      const folderCatalog = MemoryValidationService.catalogPathForNote(note);
      const folderCatalogText = catalogTextByPath.get(folderCatalog) ?? '';
      const rootCatalogText = catalogTextByPath.get('README.md') ?? '';
      const localName = basename(note);
      const linkedFromFolder = folderCatalogText.includes(localName) || folderCatalogText.includes(note);
      const linkedFromRoot = rootCatalogText.includes(note);
      if (linkedFromFolder || linkedFromRoot) {
        continue;
      }

      issues.push({
        type: 'orphan_note',
        severity: 'warning',
        path: note,
        message: MemoryValidationService.orphanNoteMessage(note, folderCatalog),
      });
    }
  }

  private static catalogPathForNote(path: string): string {
    const folder = dirname(path);
    return folder === '.' ? 'README.md' : join(folder, 'README.md');
  }

  private static orphanNoteMessage(note: string, folderCatalog: string): string {
    return folderCatalog === 'README.md' ?
      `Memory note ${note} is not linked from README.md.`
    : `Memory note ${note} is not linked from ${folderCatalog} or README.md.`;
  }
}
