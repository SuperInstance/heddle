import { resolve } from 'node:path';
import { MemoryCatalogService } from './catalog.js';
import { MemoryMaintenanceRepository } from './maintenance-repository.js';
import { MemoryNoteService } from './note-service.js';
import type { MemoryStatusView, ReadMemoryNoteInput, SearchMemoryNotesInput } from './types.js';

/**
 * Owns host-facing memory status and note visibility reads.
 */
export class MemoryVisibilityService {
  constructor(
    private readonly memoryRoot: string,
    private readonly notes = new MemoryNoteService(memoryRoot),
    private readonly maintenance = new MemoryMaintenanceRepository(memoryRoot),
    private readonly catalog = new MemoryCatalogService(memoryRoot),
  ) {}

  async loadStatus(recentRunLimit = 5): Promise<MemoryStatusView> {
    const [notes, pending, latestRuns] = await Promise.all([
      this.notes.list(),
      this.maintenance.readPendingCandidates(),
      this.maintenance.readRecentMaintenanceRuns(recentRunLimit),
    ]);
    const catalog = this.catalog.validateShape();

    return {
      memoryRoot: resolve(this.memoryRoot),
      catalog: {
        ok: catalog.ok,
        missing: catalog.missing,
      },
      notes: {
        count: notes.length,
      },
      candidates: {
        pending: pending.length,
      },
      runs: {
        latest: latestRuns,
      },
    };
  }

  async listNotePaths(path?: string): Promise<string[]> {
    return await this.notes.list({ path });
  }

  async readNote(input: ReadMemoryNoteInput): Promise<string> {
    return await this.notes.read(input);
  }

  async searchNotes(input: SearchMemoryNotesInput): Promise<string> {
    return await this.notes.search(input);
  }

  async readRecentMaintenanceRuns(limit = 5) {
    return await this.maintenance.readRecentMaintenanceRuns(limit);
  }
}
