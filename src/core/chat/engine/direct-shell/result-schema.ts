import { z } from 'zod';

export const ConversationDirectShellLineResultSchema = z.object({
  kind: z.literal('direct_shell_result'),
  command: z.string(),
  tool: z.string(),
  outcome: z.enum(['done', 'error']),
  exitCode: z.number().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  error: z.string().optional(),
  durationMs: z.number().optional(),
  policy: z.object({
    binary: z.string().optional(),
    scope: z.string().optional(),
    risk: z.string().optional(),
    capability: z.string().optional(),
    reason: z.string().optional(),
  }).optional(),
});
