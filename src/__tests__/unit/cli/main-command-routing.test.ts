import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CLI command routing', () => {
  it('keeps explicit chat-v2 command out of the ask shortcut', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'cli', 'main.ts'), 'utf8');

    expect(source).toContain(".command('chat-v2')");
    expect(source).toMatch(/return \[[^\]]*'chat-v2'[^\]]*\]\.includes\(command\)/s);
  });
});
