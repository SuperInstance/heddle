import { join } from 'node:path';
import { codingAwarenessToolkit } from '@/core/tools/toolkits/coding-awareness/toolkit.js';
import { codingFilesToolkit } from '@/core/tools/toolkits/coding-files/toolkit.js';
import { externalContextToolkit } from '@/core/tools/toolkits/external-context/toolkit.js';
import { internalToolkit } from '@/core/tools/toolkits/internal/toolkit.js';
import { knowledgeToolkit } from '@/core/tools/toolkits/knowledge/toolkit.js';
import { shellProcessToolkit } from '@/core/tools/toolkits/shell-process/toolkit.js';
import { createToolkitToolBundle, type ToolToolkit } from '@/core/tools/toolkit.js';
import type { ToolDefinition } from '@/core/types.js';
import type { DefaultAgentToolsOptions } from './types.js';

/**
 * Owns the default tool bundle policy for generic runtime execution.
 */
export class RuntimeToolService {
  static createDefaultAgentTools(options: DefaultAgentToolsOptions): ToolDefinition[] {
    const workspaceRoot = options.workspaceRoot ?? process.cwd();
    const memoryDir =
      options.memoryDir ??
      join(workspaceRoot, options.stateDir ?? '.heddle', 'memory');
    const memoryMode = options.memoryMode ?? 'read-and-record';

    return createToolkitToolBundle({
      toolkits: this.createDefaultToolkits({ includePlanTool: options.includePlanTool }),
      context: {
        workspaceRoot,
        model: options.model,
        apiKey: options.apiKey,
        providerCredentialSource: options.providerCredentialSource,
        credentialStorePath: options.credentialStorePath,
        memoryDir,
        memoryMode,
        searchIgnoreDirs: options.searchIgnoreDirs,
      },
    });
  }

  private static createDefaultToolkits(args: {
    includePlanTool?: boolean;
  }): ToolToolkit[] {
    return [
      codingAwarenessToolkit,
      codingFilesToolkit,
      externalContextToolkit,
      knowledgeToolkit,
      this.createDefaultInternalToolkit({ includePlanTool: args.includePlanTool }),
      shellProcessToolkit,
    ];
  }

  private static createDefaultInternalToolkit(args: {
    includePlanTool?: boolean;
  }): ToolToolkit {
    if (args.includePlanTool ?? true) {
      return internalToolkit;
    }

    return {
      id: internalToolkit.id,
      createTools(context) {
        return internalToolkit.createTools(context).filter((tool) => tool.name !== 'update_plan');
      },
    };
  }
}
