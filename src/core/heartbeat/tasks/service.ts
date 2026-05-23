import { resolve } from 'node:path';
import { HeartbeatViewsPresenter } from '../views/index.js';
import { FileHeartbeatTaskRepository } from './repository.js';
import type {
  FileHeartbeatTaskRepositoryOptions,
  HeartbeatTask,
  HeartbeatTaskStore,
} from './types.js';

export type FileHeartbeatTaskServiceOptions =
  | { stateRoot: string }
  | { workspaceRoot: string; stateDir?: string }
  | FileHeartbeatTaskRepositoryOptions;

export type CreateHeartbeatTaskInput = {
  workspaceId?: string;
  id?: string;
  name?: string;
  task: string;
  enabled?: boolean;
  intervalMs?: number;
  defer?: boolean;
  model?: string;
  maxSteps?: number;
  workspaceRoot?: string;
  stateDir?: string;
  searchIgnoreDirs?: string[];
  systemContext?: string;
};

/**
 * Heartbeat task service.
 *
 * This is the persistence boundary for durable heartbeat tasks, checkpoints,
 * run records, and operator-facing task/run projections. Hosts should call this
 * service, not the file repository.
 */
export class FileHeartbeatTaskService implements HeartbeatTaskStore {
  private readonly repository: HeartbeatTaskStore;

  constructor(options: FileHeartbeatTaskServiceOptions) {
    this.repository = new FileHeartbeatTaskRepository({
      dir: FileHeartbeatTaskService.resolveHeartbeatRoot(options),
    });
  }

  async listTasks() {
    return await this.repository.listTasks();
  }

  async saveTask(task: HeartbeatTask) {
    await this.repository.saveTask(task);
  }

  async loadCheckpoint(task: HeartbeatTask) {
    return await this.repository.loadCheckpoint(task);
  }

  async saveCheckpoint(task: HeartbeatTask, checkpoint: Parameters<HeartbeatTaskStore['saveCheckpoint']>[1]) {
    await this.repository.saveCheckpoint(task, checkpoint);
  }

  async saveRunRecord(record: Parameters<NonNullable<HeartbeatTaskStore['saveRunRecord']>>[0]) {
    await this.repository.saveRunRecord?.(record);
  }

  async listRunRecords(options?: Parameters<NonNullable<HeartbeatTaskStore['listRunRecords']>>[0]) {
    return await this.repository.listRunRecords?.(options) ?? [];
  }

  async loadRunRecord(id: string) {
    return await this.repository.loadRunRecord?.(id);
  }

  async listTaskViews() {
    return await HeartbeatViewsPresenter.listTaskViews(this);
  }

  async listRunViews(options: { taskId?: string; limit?: number } = {}) {
    return await HeartbeatViewsPresenter.listRunViews(this, options);
  }

  async createTask(input: CreateHeartbeatTaskInput) {
    const tasks = await this.listTasks();
    const now = new Date();
    const id = input.id ?? FileHeartbeatTaskService.createTaskId(input.name ?? input.task, tasks.map((task) => task.id));
    if (tasks.some((task) => task.id === id)) {
      throw new Error(`Heartbeat task already exists: ${id}`);
    }

    const intervalMs = input.intervalMs ?? 60 * 60_000;
    const task: HeartbeatTask = {
      id,
      workspaceId: input.workspaceId,
      name: input.name,
      task: input.task.trim(),
      enabled: input.enabled ?? true,
      schedule: {
        intervalMs,
        nextRunAt: input.defer === false ? new Date(now.getTime() - 1_000).toISOString() : new Date(now.getTime() + intervalMs).toISOString(),
      },
      runtime: {
        model: input.model,
        maxSteps: input.maxSteps,
        workspaceRoot: input.workspaceRoot,
        stateDir: input.stateDir,
        searchIgnoreDirs: input.searchIgnoreDirs,
        systemContext: input.systemContext,
      },
      state: {
        status: input.enabled === false ? 'idle' : 'waiting',
        updatedAt: now.toISOString(),
      },
    };

    await this.saveTask(task);
    return HeartbeatViewsPresenter.projectTask(task);
  }

  async readTask(taskId: string, options: { runLimit?: number } = {}) {
    const task = await this.requireTask(taskId);
    const runs = await this.listRunViews({
      taskId,
      limit: options.runLimit ?? 50,
    });

    return {
      task: HeartbeatViewsPresenter.projectTask(task),
      runs,
    };
  }

  async readRun(taskId: string, runId: string) {
    await this.requireTask(taskId);
    return await HeartbeatViewsPresenter.loadRunView(this, runId, { taskId });
  }

  async setTaskEnabled(taskId: string, enabled: boolean) {
    const task = await this.requireTask(taskId);
    const now = new Date();
    const status = enabled ? (task.state?.status ?? 'waiting') : (task.state?.status === 'running' ? 'running' : 'idle');
    const nextTask: HeartbeatTask = {
      ...task,
      enabled,
      schedule: {
        ...task.schedule,
        nextRunAt:
          enabled ?
            task.schedule.nextRunAt ?? new Date(now.getTime() - 1_000).toISOString()
          : undefined,
      },
      state: {
        ...task.state,
        status,
        updatedAt: now.toISOString(),
      },
    };
    await this.saveTask(nextTask);
    return HeartbeatViewsPresenter.projectTask(nextTask);
  }

  async triggerTaskRun(taskId: string) {
    const task = await this.requireTask(taskId);
    if (!task.enabled) {
      throw new Error(`Heartbeat task ${taskId} is disabled. Enable it before triggering a run.`);
    }

    const now = new Date();
    const status = task.state?.status === 'running' ? 'running' : 'waiting';
    const nextTask: HeartbeatTask = {
      ...task,
      schedule: {
        ...task.schedule,
        nextRunAt: new Date(now.getTime() - 1_000).toISOString(),
      },
      state: {
        ...task.state,
        status,
        progress:
          task.state?.status === 'running' ?
            task.state.progress
          : 'Task manually triggered from control plane. Waiting for the next heartbeat worker poll.',
        updatedAt: now.toISOString(),
      },
    };
    await this.saveTask(nextTask);
    return HeartbeatViewsPresenter.projectTask(nextTask);
  }

  async requireTask(taskId: string): Promise<HeartbeatTask> {
    const tasks = await this.listTasks();
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      throw new Error(`Heartbeat task not found: ${taskId}`);
    }
    return task;
  }

  private static resolveHeartbeatRoot(options: FileHeartbeatTaskServiceOptions): string {
    if ('dir' in options) {
      return options.dir;
    }

    if ('stateRoot' in options) {
      return resolve(options.stateRoot, 'heartbeat');
    }

    return resolve(options.workspaceRoot, options.stateDir ?? '.heddle', 'heartbeat');
  }

  private static createTaskId(value: string, existingIds: string[]): string {
    const base = value
      .toLowerCase()
      .replace(/[`'"]/g, '')
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64)
      .replace(/-+$/g, '') || 'heartbeat-task';
    if (!existingIds.includes(base)) {
      return base;
    }

    for (let index = 2; index < 1_000; index++) {
      const candidate = `${base}-${index}`;
      if (!existingIds.includes(candidate)) {
        return candidate;
      }
    }

    throw new Error(`Unable to create a unique heartbeat task id for ${base}`);
  }
}
