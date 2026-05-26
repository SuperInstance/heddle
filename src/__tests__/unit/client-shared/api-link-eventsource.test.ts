import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('client-shared subscription EventSource wiring', () => {
  it('lets Node clients provide an EventSource implementation for tRPC subscriptions', () => {
    const linksSource = readFileSync(join(process.cwd(), 'src', 'client-shared', 'api', 'links.ts'), 'utf8');
    const cliV2Source = readFileSync(join(process.cwd(), 'src', 'cli-v2', 'index.tsx'), 'utf8');

    expect(linksSource).toContain('eventSource?: typeof EventSource');
    expect(linksSource).toContain('httpSubscriptionLink({ url, EventSource: eventSource })');
    expect(cliV2Source).toContain("import { EventSource } from 'eventsource'");
    expect(cliV2Source).toContain('eventSource: EventSource');
  });
});
