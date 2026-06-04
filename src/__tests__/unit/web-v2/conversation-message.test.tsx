/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConversationMessage } from '../../../web-v2/components/conversation/ConversationMessage.js';
import { I18nProvider } from '../../../web-v2/i18n/I18nProvider.js';

describe('web-v2 ConversationMessage', () => {
  it('renders user messages as user-owned rows', () => {
    const { container } = render(
      <ConversationMessage message={{ id: 'user-1', role: 'user', text: 'Hello from the browser.' }} />,
    );

    expect(container.querySelector('[data-message-role="user"]')).not.toBeNull();
    expect(container.querySelector('.v2-user-message-card')).not.toBeNull();
    expect(screen.getByText('Hello from the browser.')).toBeTruthy();
  });

  it('renders assistant messages as markdown content without raw html', () => {
    const markdown = [
      '# Release summary',
      '',
      'Visit [repo](https://github.com/roackb2/heddle).',
      '',
      '- shipped',
      '  - nested item',
      '',
      '```ts',
      'const value = 42;',
      '```',
      '',
      '| Name | Value |',
      '| --- | --- |',
      '| mode | article |',
      '',
      '- [x] verified',
      '',
      '<script>alert("bad")</script>',
    ].join('\n');

    const { container } = render(
      <ConversationMessage message={{ id: 'assistant-1', role: 'assistant', text: markdown }} />,
    );

    expect(container.querySelector('[data-message-role="assistant"]')).not.toBeNull();
    expect(container.querySelector('.v2-assistant-article-shell')).not.toBeNull();
    expect(container.querySelector('.v2-assistant-markdown')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Release summary' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'repo' }).getAttribute('href')).toBe('https://github.com/roackb2/heddle');
    expect(container.querySelectorAll('ul').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('code').length).toBeGreaterThan(0);
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('input[type="checkbox"]')).not.toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });

  it('renders structured direct shell results', () => {
    const { container } = render(
      <I18nProvider>
        <ConversationMessage
          message={{
            id: 'assistant-direct-shell',
            role: 'assistant',
            text: 'git status --short',
            directShellResult: {
              kind: 'direct_shell_result',
              command: 'git status --short',
              tool: 'run_shell_inspect',
              outcome: 'done',
              stdout: 'M src/web-v2/components/conversation/ConversationMessage.tsx',
              policy: {
                reason: 'Inspect workspace status.',
              },
            },
          }}
        />
      </I18nProvider>,
    );

    expect(container.querySelector('.v2-direct-shell-result')).not.toBeNull();
    expect(screen.getByText('git status --short')).toBeTruthy();
    expect(screen.getByText('M src/web-v2/components/conversation/ConversationMessage.tsx')).toBeTruthy();
    expect(screen.getByText('Inspect workspace status.')).toBeTruthy();
  });
});
