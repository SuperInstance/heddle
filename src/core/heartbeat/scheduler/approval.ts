import type { ToolCall, ToolDefinition } from '@/core/types.js';

/**
 * Shared approval policy for autonomous heartbeat hosts.
 *
 * Heartbeat runs are background work and do not currently have a live operator
 * approval channel. Hosts can still run read-only tools, but mutating tools
 * must fail closed instead of silently bypassing approval.
 */
export class HeartbeatAutonomousApprovalPolicy {
  static async denyInteractiveToolCall(
    call: ToolCall,
    _toolDef: ToolDefinition,
  ): Promise<{ approved: boolean; reason?: string }> {
    return {
      approved: false,
      reason:
        call.tool === 'edit_file' || call.tool === 'run_shell_mutate' ?
          'Autonomous heartbeat runs do not yet have a live approval UI. Use read-only tools, memory notes, or run the task in chat for approved workspace changes.'
        : 'Autonomous heartbeat runs cannot approve this tool call interactively.',
    };
  }
}
