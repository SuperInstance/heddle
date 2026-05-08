/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConversationMessage } from '../../../web/features/control-plane/components/ConversationMessage.js';

describe('ConversationMessage', () => {
  it('renders user messages as compact user-owned bubbles', () => {
    const { container } = render(
      <ConversationMessage message={{ id: 'user-1', role: 'user', text: 'Hello from the browser.' }} />,
    );

    expect(container.querySelector('[data-message-role="user"]')).not.toBeNull();
    expect(container.querySelector('.user-message-card')).not.toBeNull();
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('Hello from the browser.')).toBeTruthy();
  });

  it('renders assistant messages as article-style markdown content', () => {
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
    ].join('\n');

    const { container } = render(
      <ConversationMessage message={{ id: 'assistant-1', role: 'assistant', text: markdown }} />,
    );

    const article = container.querySelector('[data-message-variant="article"]');
    expect(article).not.toBeNull();
    expect(container.querySelector('.assistant-article-shell')).not.toBeNull();
    expect(container.querySelector('.assistant-markdown')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Release summary' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'repo' }).getAttribute('href')).toBe('https://github.com/roackb2/heddle');
    expect(container.querySelectorAll('ul').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('code').length).toBeGreaterThan(0);
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('input[type="checkbox"]')).not.toBeNull();
  });

  it('keeps transient run-status messages out of the article renderer', () => {
    const { container } = render(
      <ConversationMessage message={{
        id: 'live-run-status',
        role: 'assistant',
        text: 'Working… running read_file (step 2)',
        isPending: true,
        isStreaming: true,
      }} />,
    );

    expect(container.querySelector('[data-message-variant="status"]')).not.toBeNull();
    expect(container.querySelector('.assistant-status-card')).not.toBeNull();
    expect(container.querySelector('.assistant-markdown')).toBeNull();
    expect(screen.getByText('Working… running read_file (step 2)')).toBeTruthy();
  });

  it('renders recognized tool results in their utility card treatment', () => {
    const payload = JSON.stringify({
      ok: true,
      output: {
        command: 'git status --short',
        stdout: 'M src/web/features/control-plane/components/ConversationMessage.tsx',
      },
    });

    const { container } = render(
      <ConversationMessage message={{
        id: 'assistant-tool-result',
        role: 'assistant',
        text: `run_shell_inspect: ${payload}`,
      }} />,
    );

    expect(container.querySelector('[data-message-variant="tool-result"]')).not.toBeNull();
    expect(container.querySelector('.tool-result-card')).not.toBeNull();
    expect(screen.getByText('Tool result')).toBeTruthy();
    expect(screen.getByText('run_shell_inspect')).toBeTruthy();
    expect(screen.getByText('git status --short')).toBeTruthy();
  });

  it('does not render raw html from assistant markdown', () => {
    const { container } = render(
      <ConversationMessage message={{
        id: 'assistant-html',
        role: 'assistant',
        text: '<script>alert("bad")</script>\n\nSafe text.',
      }} />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('Safe text.')).toBeTruthy();
  });
});
