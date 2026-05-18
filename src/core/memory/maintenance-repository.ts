import { appendFile, mkdir, open, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { MemorySchemas } from './schemas.js';
import type {
  KnowledgeCandidate,
  KnowledgeCandidateStatusRecord,
  KnowledgeMaintenanceRunRecord,
  MemoryMaintenanceLockRecord,
} from './types.js';

/**
 * Owns memory maintenance JSONL files and lock-file persistence.
 */
export class MemoryMaintenanceRepository {
  constructor(private readonly memoryRoot: string) {}

  async readPendingCandidates(): Promise<KnowledgeCandidate[]> {
    const entries = await this.readCandidateLogEntries();
    const processed = new Set<string>();
    const pending: KnowledgeCandidate[] = [];

    for (const entry of entries) {
      if ('kind' in entry) {
        processed.add(entry.candidateId);
        continue;
      }
      pending.push(entry);
    }

    return pending.filter((candidate) => !processed.has(candidate.id));
  }

  async appendCandidate(candidate: KnowledgeCandidate): Promise<void> {
    await this.appendJsonLine(this.candidatesPath(), candidate);
  }

  async appendCandidateStatusEvents(candidateIds: string[], runId: string, now: () => Date): Promise<void> {
    const recordedAt = now().toISOString();
    const records: KnowledgeCandidateStatusRecord[] = candidateIds.map((candidateId) => ({
      kind: 'candidate_status',
      candidateId,
      status: 'processed',
      runId,
      recordedAt,
    }));

    await this.appendJsonLines(this.candidatesPath(), records);
  }

  async appendMaintenanceRun(run: KnowledgeMaintenanceRunRecord): Promise<void> {
    await this.appendJsonLine(this.runsPath(), run);
  }

  async readRecentMaintenanceRuns(limit = 5): Promise<KnowledgeMaintenanceRunRecord[]> {
    const lines = await this.readJsonlLines(this.runsPath());
    return lines
      .map((line) => this.parseMaintenanceRun(line))
      .filter((run): run is KnowledgeMaintenanceRunRecord => Boolean(run))
      .slice(-limit)
      .reverse();
  }

  async writeLock(lockPath: string, record: MemoryMaintenanceLockRecord): Promise<void> {
    await mkdir(dirname(lockPath), { recursive: true });
    const handle = await open(lockPath, 'wx');
    try {
      await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8');
    } finally {
      await handle.close();
    }
  }

  async readLock(lockPath: string): Promise<MemoryMaintenanceLockRecord | undefined> {
    try {
      const parsed = JSON.parse(await readFile(lockPath, 'utf8')) as unknown;
      const result = MemorySchemas.parseMaintenanceLock(parsed);
      return result.success ? result.data : undefined;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return undefined;
      }
      return undefined;
    }
  }

  async removeLock(lockPath: string): Promise<void> {
    await rm(lockPath, { force: true });
  }

  maintenanceLockPath(): string {
    return join(this.resolveRoot(), '_maintenance', 'maintenance.lock');
  }

  private async readCandidateLogEntries(): Promise<Array<KnowledgeCandidate | KnowledgeCandidateStatusRecord>> {
    const lines = await this.readJsonlLines(this.candidatesPath());
    return lines
      .map((line) => this.parseCandidateLogEntry(line))
      .filter((entry): entry is KnowledgeCandidate | KnowledgeCandidateStatusRecord => Boolean(entry));
  }

  private candidatesPath(): string {
    return join(this.resolveRoot(), '_maintenance', 'candidates.jsonl');
  }

  private runsPath(): string {
    return join(this.resolveRoot(), '_maintenance', 'runs.jsonl');
  }

  private async appendJsonLine(path: string, record: unknown): Promise<void> {
    await this.appendJsonLines(path, [record]);
  }

  private async appendJsonLines(path: string, records: unknown[]): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`, 'utf8');
  }

  private async readJsonlLines(path: string): Promise<string[]> {
    try {
      const raw = await readFile(path, 'utf8');
      return raw.split(/\r?\n/u).filter((line) => line.trim());
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private parseCandidateLogEntry(line: string): KnowledgeCandidate | KnowledgeCandidateStatusRecord | undefined {
    try {
      const parsed = JSON.parse(line) as unknown;
      const result = MemorySchemas.parseCandidateLogEntry(parsed);
      return result.success ? result.data : undefined;
    } catch {
      return undefined;
    }
  }

  private parseMaintenanceRun(line: string): KnowledgeMaintenanceRunRecord | undefined {
    try {
      const parsed = JSON.parse(line) as unknown;
      const result = MemorySchemas.parseMaintenanceRun(parsed);
      return result.success ? result.data : undefined;
    } catch {
      return undefined;
    }
  }

  private resolveRoot(): string {
    return resolve(this.memoryRoot);
  }
}
