import { describe, expect, it } from 'vitest';
import { appendAwarenessDomainSystemContext, buildAwarenessDomainSystemContext } from '../../../core/awareness/domain-prompt.js';

describe('awareness domain prompt', () => {
  it('builds concise interpretation guidance for situation awareness', () => {
    const context = buildAwarenessDomainSystemContext();

    expect(context).toContain('## Situation Awareness Domain');
    expect(context).toContain('current-state orientation layer');
    expect(context).toContain('Treat working_environment as a compact current-state summary');
    expect(context).toContain('Situation awareness is a map of current workspace state, not proof of code behavior');
    expect(context).toContain('Durable preferences, recurring workflows, and historical operational context belong to Heddle-managed memory');
  });

  it('prepends awareness guidance to existing system context', () => {
    const context = appendAwarenessDomainSystemContext('Source: AGENTS.md\nRead docs first.');

    expect(context).toContain('Source: AGENTS.md');
    expect(context.indexOf('## Situation Awareness Domain')).toBeLessThan(context.indexOf('Source: AGENTS.md'));
  });
});
