import type { LlmProvider } from '@/core/llm/types.js';
import { OpenAiOAuthService } from './openai-oauth.js';
import { ProviderCredentialRepository } from './provider-credentials.js';
import type { OpenAiOAuthCredential } from './types.js';

export type ProviderCredentialCommandOptions = {
  storePath?: string;
  openBrowser?: boolean;
  openAiLogin?: () => Promise<OpenAiOAuthCredential>;
  onAuthorizeUrl?: (url: string) => void;
};

/**
 * Owns provider credential command semantics shared by terminal and API hosts.
 *
 * Core auth owns what status/login/logout mean for persisted credentials.
 * Interfaces own how command progress is rendered and how users invoke these
 * actions.
 */
export class ProviderCredentialCommandService {
  static formatStatusMessage(storePath = ProviderCredentialRepository.resolveStorePath()): string {
    const summaries = new ProviderCredentialRepository({ storePath }).listSummaries();
    const lines = [`Auth store: ${storePath}`];

    if (summaries.length === 0) {
      return [...lines, 'Stored credentials: none'].join('\n');
    }

    lines.push('Stored credentials:');
    for (const summary of summaries) {
      const details = [
        `type=${summary.type}`,
        summary.label ? `label=${summary.label}` : undefined,
        summary.accountId ? `account=${summary.accountId}` : undefined,
        summary.expiresAt ? `expires=${new Date(summary.expiresAt).toISOString()}` : undefined,
        summary.expired === true ? 'expired=true' : undefined,
        `updated=${summary.updatedAt}`,
      ].filter(Boolean);
      lines.push(`- ${summary.provider}: ${details.join(' ')}`);
    }
    return lines.join('\n');
  }

  static async loginProviderWithOAuth(
    provider: LlmProvider,
    options: ProviderCredentialCommandOptions = {},
  ): Promise<string> {
    const storePath = options.storePath ?? ProviderCredentialRepository.resolveStorePath();
    if (provider !== 'openai') {
      throw new Error(`OAuth login is not available for ${provider}. Use API keys or supported provider credentials.`);
    }

    const credential = await (options.openAiLogin ?? (() => OpenAiOAuthService.runBrowserLogin({
      openBrowser: options.openBrowser,
      onAuthorizeUrl: options.onAuthorizeUrl,
    })))();
    new ProviderCredentialRepository({ storePath }).set(credential);

    return [
      'Stored OpenAI OAuth credential.',
      credential.accountId ? `Account: ${credential.accountId}` : undefined,
      `Expires: ${new Date(credential.expiresAt).toISOString()}`,
    ].filter((line): line is string => Boolean(line)).join('\n');
  }

  static logoutProvider(provider: LlmProvider, storePath = ProviderCredentialRepository.resolveStorePath()): string {
    const removed = new ProviderCredentialRepository({ storePath }).remove(provider);
    return removed ?
        `Removed stored ${provider} credential.`
      : `No stored ${provider} credential found.`;
  }
}
