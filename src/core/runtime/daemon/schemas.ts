/**
 * Zod schemas for daemon registry persistence.
 *
 * This file is the JSON contract for the global daemon registry. The registry
 * owns live control-plane server discovery and known workspace records; a
 * workspace record must not imply server ownership.
 */
import { z } from 'zod';
import { WorkspaceDescriptorSchema } from '@/core/runtime/workspaces/schemas.js';

export const ControlPlaneServerRecordSchema = z.object({
  serverId: z.string().describe('Unique local control-plane server identifier.'),
  mode: z.enum(['daemon', 'embedded-chat']).describe('Runtime server mode.'),
  host: z.string().describe('HTTP host where the control plane listens.'),
  port: z.number().describe('HTTP port where the control plane listens.'),
  pid: z.number().describe('Local process id for stale-server detection.'),
  startedAt: z.string().describe('Timestamp when this server started.'),
  lastSeenAt: z.string().describe('Timestamp when this server last refreshed its registry heartbeat.'),
});

export const RegisteredWorkspaceRecordSchema = z.object({
  workspace: WorkspaceDescriptorSchema.describe('Workspace descriptor known to the daemon registry.'),
  updatedAt: z.string().describe('Timestamp when this registry record was last changed.'),
});

export const DaemonRegistrySchema = z.object({
  version: z.literal(1).describe('Daemon registry format version.'),
  updatedAt: z.string().describe('Timestamp when this registry was last written.'),
  server: ControlPlaneServerRecordSchema.optional().describe('Live local control-plane server, when one is registered.'),
  workspaces: z.array(RegisteredWorkspaceRecordSchema).describe('Known workspace records.'),
});

export const DaemonRegistryReadSchema = z.object({
  version: z.literal(1).optional().catch(1),
  updatedAt: z.string().optional().catch(undefined),
  server: ControlPlaneServerRecordSchema.partial().optional().catch(undefined),
  workspaces: z.array(RegisteredWorkspaceRecordSchema.partial().extend({
    owner: z.object({
      ownerId: z.string().optional(),
      mode: z.literal('daemon').optional(),
      host: z.string().optional(),
      port: z.number().optional(),
      pid: z.number().optional(),
      startedAt: z.string().optional(),
      lastSeenAt: z.string().optional(),
    }).optional().catch(undefined),
  })).optional().catch(undefined),
});
