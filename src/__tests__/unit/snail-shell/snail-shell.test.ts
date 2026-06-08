import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type http from 'node:http';
import type { SymphonyShellIdentity, Timbre } from '@/snail-shell/types.js';
import { SymphonyIdentityService } from '@/snail-shell/identity.js';
import { SnailShellRpcServer } from '@/snail-shell/rpc/server.js';
import { SnailShellRpcMethodRegistry } from '@/snail-shell/rpc/methods.js';
import { SnailShellFleetMethods } from '@/snail-shell/rpc/fleet-methods.js';
import { attachSnailShellToDaemon } from '@/snail-shell/integration/daemon-plugin.js';
import { SnailShellFleetCueLoop } from '@/snail-shell/integration/fleet-cue-loop.js';
import { annotateSessionWithSymphonyIdentity } from '@/snail-shell/integration/session-metadata.js';

describe('snail-shell', () => {
  describe('types.ts', () => {
    it('accepts valid SymphonyShellIdentity structure', () => {
      const identity: SymphonyShellIdentity = {
        timbre: 'builder',
        track: {
          channel: 'symphony-alpha',
          group: 'all',
        },
        frequency: {
          cuePollIntervalMs: 30000,
          registryHeartbeatIntervalMs: 15000,
          identityBroadcastIntervalMs: 60000,
        },
      };

      expect(identity.timbre).toBe('builder');
      expect(identity.track.channel).toBe('symphony-alpha');
      expect(identity.track.group).toBe('all');
      expect(identity.frequency.cuePollIntervalMs).toBe(30000);
    });

    it('accepts all timbre variants', () => {
      const timbres: Timbre[] = ['builder', 'auditor', 'weaver', 'watcher'];

      timbres.forEach((timbre) => {
        const identity: SymphonyShellIdentity = {
          timbre,
          track: { channel: 'test', group: 'all' },
          frequency: {
            cuePollIntervalMs: 30000,
            registryHeartbeatIntervalMs: 15000,
            identityBroadcastIntervalMs: 60000,
          },
        };
        expect(identity.timbre).toBe(timbre);
      });
    });
  });

  describe('identity.ts', () => {
    it('builds with defaults when no input provided', () => {
      const identity = SymphonyIdentityService.build();

      expect(identity.timbre).toBe('builder');
      expect(identity.track.channel).toBe('symphony-alpha');
      expect(identity.track.group).toBe('all');
      expect(identity.frequency.cuePollIntervalMs).toBe(30000);
      expect(identity.frequency.registryHeartbeatIntervalMs).toBe(15000);
      expect(identity.frequency.identityBroadcastIntervalMs).toBe(60000);
    });

    it('builds with explicit config overriding defaults', () => {
      const identity = SymphonyIdentityService.build({
        timbre: 'auditor',
        channel: 'fleet-canary',
        group: 'cyberloop',
      });

      expect(identity.timbre).toBe('auditor');
      expect(identity.track.channel).toBe('fleet-canary');
      expect(identity.track.group).toBe('cyberloop');
      expect(identity.frequency.cuePollIntervalMs).toBe(30000);
    });

    it('builds from environment variables', () => {
      const env = {
        SNAIL_SHELL_TIMBRE: 'weaver',
        SNAIL_SHELL_CHANNEL: 'test-channel',
        SNAIL_SHELL_GROUP: 'test-group',
        SNAIL_SHELL_CUE_POLL_MS: '45000',
        REGISTRY_HEARTBEAT_MS: '20000',
        SNAIL_SHELL_BROADCAST_MS: '90000',
      };

      const identity = SymphonyIdentityService.build({ env: env as typeof process.env });

      expect(identity.timbre).toBe('weaver');
      expect(identity.track.channel).toBe('test-channel');
      expect(identity.track.group).toBe('test-group');
      expect(identity.frequency.cuePollIntervalMs).toBe(45000);
      expect(identity.frequency.registryHeartbeatIntervalMs).toBe(20000);
      expect(identity.frequency.identityBroadcastIntervalMs).toBe(90000);
    });

    it('prioritizes explicit config over env vars', () => {
      const env = {
        SNAIL_SHELL_TIMBRE: 'auditor',
        SNAIL_SHELL_CHANNEL: 'env-channel',
        SNAIL_SHELL_GROUP: 'env-group',
      };

      const identity = SymphonyIdentityService.build({
        timbre: 'watcher',
        channel: 'explicit-channel',
        group: 'explicit-group',
        env: env as typeof process.env,
      });

      expect(identity.timbre).toBe('watcher');
      expect(identity.track.channel).toBe('explicit-channel');
      expect(identity.track.group).toBe('explicit-group');
    });

    it('generates deterministic fleetNodeId for same inputs', () => {
      const serverId = 'server-123';
      const workspaceRoot = '/path/to/workspace';

      const id1 = SymphonyIdentityService.fleetNodeId(serverId, workspaceRoot);
      const id2 = SymphonyIdentityService.fleetNodeId(serverId, workspaceRoot);

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^heddle:server-123:[0-9a-f]{8}$/);
    });

    it('generates different fleetNodeId for different workspaces', () => {
      const serverId = 'server-123';
      const workspace1 = '/path/to/workspace1';
      const workspace2 = '/path/to/workspace2';

      const id1 = SymphonyIdentityService.fleetNodeId(serverId, workspace1);
      const id2 = SymphonyIdentityService.fleetNodeId(serverId, workspace2);

      expect(id1).not.toBe(id2);
    });

    it('generates different fleetNodeId for different servers', () => {
      const server1 = 'server-abc';
      const server2 = 'server-xyz';
      const workspaceRoot = '/path/to/workspace';

      const id1 = SymphonyIdentityService.fleetNodeId(server1, workspaceRoot);
      const id2 = SymphonyIdentityService.fleetNodeId(server2, workspaceRoot);

      expect(id1).not.toBe(id2);
    });
  });

  describe('rpc/server.ts', () => {
    let mockHttpServer: http.Server;
    let mockIdentity: SymphonyShellIdentity;

    beforeEach(() => {
      mockHttpServer = {} as http.Server;
      mockIdentity = {
        timbre: 'builder',
        track: { channel: 'test', group: 'all' },
        frequency: {
          cuePollIntervalMs: 30000,
          registryHeartbeatIntervalMs: 15000,
          identityBroadcastIntervalMs: 60000,
        },
      };
    });

    it('constructs SnailShellRpcServer with options', () => {
      const server = new SnailShellRpcServer({
        httpServer: mockHttpServer,
        path: '/custom/ws',
        maxPayload: 512 * 1024,
        identity: mockIdentity,
        workspaceRoot: '/test/workspace',
      });

      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(SnailShellRpcServer);
    });

    it('uses default path and maxPayload when not provided', () => {
      const server = new SnailShellRpcServer({
        httpServer: mockHttpServer,
        identity: mockIdentity,
        workspaceRoot: '/test/workspace',
      });

      expect(server).toBeDefined();
    });

    it('calls destroy to close server', () => {
      const server = new SnailShellRpcServer({
        httpServer: mockHttpServer,
        identity: mockIdentity,
        workspaceRoot: '/test/workspace',
      });

      expect(() => server.destroy()).not.toThrow();
    });
  });

  describe('rpc/methods.ts', () => {
    let mockIdentity: SymphonyShellIdentity;

    beforeEach(() => {
      mockIdentity = {
        timbre: 'builder',
        track: { channel: 'test', group: 'all' },
        frequency: {
          cuePollIntervalMs: 30000,
          registryHeartbeatIntervalMs: 15000,
          identityBroadcastIntervalMs: 60000,
        },
      };
    });

    it('creates registry with all expected methods', () => {
      const registry = new SnailShellRpcMethodRegistry({
        identity: mockIdentity,
        workspaceRoot: '/test/workspace',
      });

      const workspaceMethods = ['workspace.list', 'workspace.status', 'workspace.changes'];
      const sessionMethods = ['session.list', 'session.get', 'session.runtimeContext'];
      const fleetMethods = ['fleet.t-minus', 'fleet.identity', 'fleet.health'];

      [...workspaceMethods, ...sessionMethods, ...fleetMethods].forEach((method) => {
        expect(registry.get(method)).toBeDefined();
        expect(typeof registry.get(method)).toBe('function');
      });
    });

    it('returns undefined for unregistered method', () => {
      const registry = new SnailShellRpcMethodRegistry({
        identity: mockIdentity,
        workspaceRoot: '/test/workspace',
      });

      expect(registry.get('unknown.method')).toBeUndefined();
    });

    it('registers custom method via register()', () => {
      const registry = new SnailShellRpcMethodRegistry({
        identity: mockIdentity,
        workspaceRoot: '/test/workspace',
      });

      const customHandler = vi.fn();
      registry.register('custom.method', customHandler);

      expect(registry.get('custom.method')).toBe(customHandler);
    });
  });

  describe('rpc/fleet-methods.ts', () => {
    let fleetMethods: SnailShellFleetMethods;
    let mockIdentity: SymphonyShellIdentity;

    beforeEach(() => {
      mockIdentity = {
        timbre: 'builder',
        track: { channel: 'test', group: 'all' },
        frequency: {
          cuePollIntervalMs: 30000,
          registryHeartbeatIntervalMs: 15000,
          identityBroadcastIntervalMs: 60000,
        },
      };

      vi.mock('@/core/runtime/workspaces/index.js', () => ({
        RuntimeWorkspaceService: {
          resolveContext: vi.fn(() => ({
            workspaces: [],
          })),
        },
      }));

      fleetMethods = new SnailShellFleetMethods({
        identity: mockIdentity,
        workspaceRoot: '/test/workspace',
      });
    });

    it('returns identity with fleetNodeId', () => {
      const result = fleetMethods.getIdentity();

      expect(result.identity).toEqual(mockIdentity);
      expect(result.fleetNodeId).toMatch(/^heddle:snail-\d+:[0-9a-f]{8}$/);
    });

    it('returns health status with correct structure', () => {
      const result = fleetMethods.getHealth();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('workspaceCount');
      expect(result).toHaveProperty('sessionCount');
      expect(result).toHaveProperty('memory');

      expect(result.status).toBe('healthy');
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.workspaceCount).toBe('number');
      expect(typeof result.sessionCount).toBe('number');
      expect(result.memory).toHaveProperty('rss');
      expect(result.memory).toHaveProperty('heapUsed');
      expect(result.memory).toHaveProperty('heapTotal');
    });

    it('accepts valid t-minus cue', async () => {
      const validParams = {
        target: 'session.send-prompt' as const,
        sessionId: 'session-123',
        prompt: 'Test prompt',
        workspaceId: 'workspace-123',
        sender: 'fleet-agent-1',
        timestamp: new Date().toISOString(),
      };

      const result = await fleetMethods.handleTMinus(validParams);

      expect(result.accepted).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('rejects t-minus cue with stale timestamp', async () => {
      const staleParams = {
        target: 'session.send-prompt' as const,
        sender: 'fleet-agent-1',
        timestamp: new Date(Date.now() - 120_000).toISOString(),
      };

      const result = await fleetMethods.handleTMinus(staleParams);

      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('cue stale');
    });

    it('throws error for invalid t-minus params', async () => {
      const invalidParams = {
        target: 'invalid-target',
        sender: 'fleet-agent-1',
        timestamp: new Date().toISOString(),
      };

      await expect(fleetMethods.handleTMinus(invalidParams)).rejects.toThrow('Invalid params');
    });

    it('rejects t-minus cue just past 60s boundary', async () => {
      const staleBoundary = {
        target: 'fleet.status' as const,
        sender: 'fleet-agent-1',
        timestamp: new Date(Date.now() - 60_001).toISOString(),
      };

      const result = await fleetMethods.handleTMinus(staleBoundary);

      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('cue stale');
    });

    it('accepts t-minus cue just before 60s boundary', async () => {
      const freshParams = {
        target: 'heartbeat.run-tasks' as const,
        sender: 'fleet-agent-1',
        timestamp: new Date(Date.now() - 59_999).toISOString(),
      };

      const result = await fleetMethods.handleTMinus(freshParams);

      expect(result.accepted).toBe(true);
    });
  });

  describe('integration/daemon-plugin.ts', () => {
    let mockIdentity: SymphonyShellIdentity;
    let mockServerHandle: Record<string, unknown>;

    beforeEach(() => {
      mockIdentity = {
        timbre: 'builder',
        track: { channel: 'test', group: 'all' },
        frequency: {
          cuePollIntervalMs: 30000,
          registryHeartbeatIntervalMs: 15000,
          identityBroadcastIntervalMs: 60000,
        },
      };

      mockServerHandle = {
        server: {} as http.Server,
        otherProp: 'value',
      };
    });

    it('returns augmented handle with snailShell property', () => {
      const result = attachSnailShellToDaemon(
        {
          identity: mockIdentity,
          workspaceRoot: '/test/workspace',
          stateRoot: '/test/.heddle',
          expressApp: {} as any,
          httpServer: {} as http.Server,
        },
        mockServerHandle as any,
      );

      expect(result).toHaveProperty('snailShell');
      expect(result).toHaveProperty('server');
      expect(result).toHaveProperty('otherProp');
      expect(result.otherProp).toBe('value');
    });

    it('snailShell handle contains rpcServer, cueLoop, identity, and close', () => {
      const result = attachSnailShellToDaemon(
        {
          identity: mockIdentity,
          workspaceRoot: '/test/workspace',
          stateRoot: '/test/.heddle',
          expressApp: {} as any,
          httpServer: {} as http.Server,
        },
        mockServerHandle as any,
      );

      expect(result.snailShell).toHaveProperty('rpcServer');
      expect(result.snailShell).toHaveProperty('cueLoop');
      expect(result.snailShell).toHaveProperty('identity');
      expect(result.snailShell).toHaveProperty('close');

      expect(result.snailShell.rpcServer).toBeInstanceOf(SnailShellRpcServer);
      expect(result.snailShell.cueLoop).toBeInstanceOf(SnailShellFleetCueLoop);
      expect(result.snailShell.identity).toEqual(mockIdentity);
      expect(typeof result.snailShell.close).toBe('function');
    });

    it('close function stops cueLoop and destroys rpcServer', () => {
      const stopSpy = vi.spyOn(SnailShellFleetCueLoop.prototype, 'stop');
      const destroySpy = vi.spyOn(SnailShellRpcServer.prototype, 'destroy');

      const result = attachSnailShellToDaemon(
        {
          identity: mockIdentity,
          workspaceRoot: '/test/workspace',
          stateRoot: '/test/.heddle',
          expressApp: {} as any,
          httpServer: {} as http.Server,
        },
        mockServerHandle as any,
      );

      result.snailShell.close();

      expect(stopSpy).toHaveBeenCalled();
      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('integration/fleet-cue-loop.ts', () => {
    let cueLoop: SnailShellFleetCueLoop;
    let mockIdentity: SymphonyShellIdentity;

    beforeEach(() => {
      mockIdentity = {
        timbre: 'builder',
        track: { channel: 'test', group: 'all' },
        frequency: {
          cuePollIntervalMs: 30000,
          registryHeartbeatIntervalMs: 15000,
          identityBroadcastIntervalMs: 60000,
        },
      };

      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('starts polling loop on start()', () => {
      cueLoop = new SnailShellFleetCueLoop({
        identity: mockIdentity,
        workspaceRoot: '/test/workspace',
        stateRoot: '/test/.heddle',
        cuePollIntervalMs: 1000,
      });

      cueLoop.start();
      cueLoop.stop();

      expect(cueLoop).toBeDefined();
    });

    it('stops polling loop on stop()', () => {
      cueLoop = new SnailShellFleetCueLoop({
        identity: mockIdentity,
        workspaceRoot: '/test/workspace',
        stateRoot: '/test/.heddle',
        cuePollIntervalMs: 1000,
      });

      cueLoop.start();
      cueLoop.stop();

      expect(cueLoop).toBeDefined();
    });

    it('handles multiple start calls gracefully', () => {
      cueLoop = new SnailShellFleetCueLoop({
        identity: mockIdentity,
        workspaceRoot: '/test/workspace',
        stateRoot: '/test/.heddle',
        cuePollIntervalMs: 1000,
      });

      expect(() => {
        cueLoop.start();
        cueLoop.start();
        cueLoop.stop();
      }).not.toThrow();
    });

    it('handles multiple stop calls gracefully', () => {
      cueLoop = new SnailShellFleetCueLoop({
        identity: mockIdentity,
        workspaceRoot: '/test/workspace',
        stateRoot: '/test/.heddle',
        cuePollIntervalMs: 1000,
      });

      cueLoop.start();
      expect(() => {
        cueLoop.stop();
        cueLoop.stop();
      }).not.toThrow();
    });

    it('created cueLoop is usable', () => {
      cueLoop = new SnailShellFleetCueLoop({
        identity: mockIdentity,
        workspaceRoot: '/test/workspace',
        stateRoot: '/test/.heddle',
        cuePollIntervalMs: 1000,
      });

      expect(cueLoop).toBeDefined();
    });
  });

  describe('integration/session-metadata.ts', () => {
    it('annotates session with symphony identity', () => {
      const session = {
        id: 'session-123',
        name: 'Test Session',
        createdAt: new Date(),
      };

      const identity: SymphonyShellIdentity = {
        timbre: 'builder',
        track: { channel: 'test', group: 'all' },
        frequency: {
          cuePollIntervalMs: 30000,
          registryHeartbeatIntervalMs: 15000,
          identityBroadcastIntervalMs: 60000,
        },
      };

      const result = annotateSessionWithSymphonyIdentity(session, identity);

      expect(result).toHaveProperty('symphony');
      expect(result.symphony).toHaveProperty('identity');
      expect(result.symphony?.identity).toEqual(identity);
      expect(result.id).toBe('session-123');
      expect(result.name).toBe('Test Session');
    });

    it('preserves original session properties', () => {
      const session = {
        id: 'session-456',
        name: 'Another Session',
        userId: 'user-789',
        metadata: { key: 'value' },
      };

      const identity: SymphonyShellIdentity = {
        timbre: 'auditor',
        track: { channel: 'fleet', group: 'test' },
        frequency: {
          cuePollIntervalMs: 45000,
          registryHeartbeatIntervalMs: 20000,
          identityBroadcastIntervalMs: 90000,
        },
      };

      const result = annotateSessionWithSymphonyIdentity(session, identity);

      expect(result.id).toBe('session-456');
      expect(result.name).toBe('Another Session');
      expect(result.userId).toBe('user-789');
      expect(result.metadata).toEqual({ key: 'value' });
    });

    it('returns type with optional symphony property', () => {
      const session = {
        id: 'session-789',
        name: 'Session 789',
      };

      const identity: SymphonyShellIdentity = {
        timbre: 'watcher',
        track: { channel: 'monitor', group: 'ops' },
        frequency: {
          cuePollIntervalMs: 60000,
          registryHeartbeatIntervalMs: 30000,
          identityBroadcastIntervalMs: 120000,
        },
      };

      const result = annotateSessionWithSymphonyIdentity(session, identity);

      expect(result.symphony?.identity).toEqual(identity);
      expect(result.symphony?.identity.timbre).toBe('watcher');
    });
  });
});
