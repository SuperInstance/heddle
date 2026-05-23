import {
  HeartbeatAutonomousApprovalPolicy,
  HeartbeatSchedulerService,
  HeartbeatViewsPresenter,
  FileHeartbeatTaskService,
  type HeartbeatTaskRunner,
} from '@/core/heartbeat/index.js';
import { DEFAULT_OPENAI_MODEL } from '@/core/config.js';
import { RuntimeCredentialService } from '@/core/runtime/credentials/index.js';

type CreateHeartbeatTaskArgs = {
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

type RunHeartbeatTaskNowArgs = {
  taskId: string;
  workspaceRoot: string;
  stateDir?: string;
  apiKey?: string;
  preferApiKey?: boolean;
  model?: string;
  maxSteps?: number;
  searchIgnoreDirs?: string[];
  systemContext?: string;
  runner?: HeartbeatTaskRunner;
};

export class ControlPlaneHeartbeatController {
  static async listTasks(stateRoot: string) {
    return await new FileHeartbeatTaskService({ stateRoot }).listTaskViews();
  }

  static async listRuns(
    stateRoot: string,
    options: { taskId?: string; limit?: number } = {},
  ) {
    return await new FileHeartbeatTaskService({ stateRoot }).listRunViews(options);
  }

  static async createTask(
    stateRoot: string,
    args: CreateHeartbeatTaskArgs,
  ) {
    return await new FileHeartbeatTaskService({ stateRoot }).createTask(args);
  }

  static async readTask(
    stateRoot: string,
    taskId: string,
    options: { runLimit?: number } = {},
  ) {
    return await new FileHeartbeatTaskService({ stateRoot }).readTask(taskId, options);
  }

  static async readRun(
    stateRoot: string,
    taskId: string,
    runId: string,
  ) {
    return await new FileHeartbeatTaskService({ stateRoot }).readRun(taskId, runId);
  }

  static async setTaskEnabled(
    stateRoot: string,
    taskId: string,
    enabled: boolean,
  ) {
    return await new FileHeartbeatTaskService({ stateRoot }).setTaskEnabled(taskId, enabled);
  }

  static async triggerTaskRun(stateRoot: string, taskId: string) {
    return await new FileHeartbeatTaskService({ stateRoot }).triggerTaskRun(taskId);
  }

  static async runTaskNow(
    stateRoot: string,
    args: RunHeartbeatTaskNowArgs,
  ) {
    const tasks = new FileHeartbeatTaskService({ stateRoot });
    const task = await tasks.requireTask(args.taskId);
    const model = args.model ?? task.runtime?.model ?? process.env.OPENAI_MODEL ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_OPENAI_MODEL;
    const runtimeCredential = args.apiKey ?
      { apiKey: args.apiKey, apiKeyProvider: 'explicit' as const, preferApiKey: args.preferApiKey }
    : { preferApiKey: args.preferApiKey };
    if (!args.runner && !RuntimeCredentialService.hasCredentialForModel(model, runtimeCredential)) {
      throw new Error(RuntimeCredentialService.formatMissingCredentialMessage(model));
    }

    const apiKey = RuntimeCredentialService.resolveApiKeyForModel(model, runtimeCredential);
    const result = await HeartbeatSchedulerService.runTaskNow({
      store: tasks,
      taskId: args.taskId,
      runner: args.runner,
      heartbeat: args.runner ? undefined : {
        model,
        apiKey,
        maxSteps: args.maxSteps,
        workspaceRoot: args.workspaceRoot,
        stateDir: args.stateDir,
        searchIgnoreDirs: args.searchIgnoreDirs,
        systemContext: args.systemContext,
        approveToolCall: HeartbeatAutonomousApprovalPolicy.denyInteractiveToolCall,
      },
    });
    const [run] = await tasks.listRunViews({
      taskId: args.taskId,
      limit: 1,
    });
    return {
      ...result,
      task: HeartbeatViewsPresenter.projectTask(await tasks.requireTask(args.taskId)),
      run: run ?? null,
    };
  }
}
