// ---------------------------------------------------------------------------
// Tool: search_files
// Uses mature local search tools while keeping defaults focused and bounded.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { ToolDefinition, ToolResult } from '../../../types.js';

type SearchFilesInput = {
  query: string;
  path?: string;
  includeIgnored?: boolean;
};

export const DEFAULT_SEARCH_EXCLUDED_DIRS = ['.git', 'dist', 'node_modules', 'local', '.heddle'];
const PROTECTED_STATE_DIRS = ['.git', '.heddle'];
const GREP_TEXT_FILE_GLOBS = ['*.ts', '*.js', '*.json', '*.md', '*.txt', '*.yaml', '*.yml'];
const SEARCH_TIMEOUT_MS = 15_000;
const SEARCH_MAX_BUFFER = 1024 * 1024;

export type SearchFilesOptions = {
  excludedDirs?: string[];
  workspaceRoot?: string;
};

let cachedRipgrepAvailable: boolean | undefined;

export function createSearchFilesTool(options: SearchFilesOptions = {}): ToolDefinition {
  const excludedDirNames = sanitizeExcludedDirs(options.excludedDirs);
  const configuredWorkspaceRoot = options.workspaceRoot ? resolve(options.workspaceRoot) : undefined;

  return {
    name: 'search_files',
    description:
      'Search for a text pattern in files. Prefer rg when available for fast ignored-aware search, with a grep fallback. Use this when you need to locate a specific symbol or text string, not when a likely folder or file is already obvious from the workspace structure. Prefer searching for concrete terms such as tool names, symbols, or filenames rather than copying broad question text. Relative paths are resolved from the active workspace root and may also point to nearby parent or sibling folders. Returns newline-separated matches in grep-style path:line:content format, or "No matches found.". By default, search honors ignore files when rg is available and avoids expensive/generated/state folders like .git, dist, node_modules, local, and .heddle. Set includeIgnored: true only when intentionally searching ignored or dependency content such as node_modules; .git and .heddle are still avoided unless explicitly targeted via path. Example inputs: { "query": "createUser" }, { "query": "incident", "path": "../shared-notes" }, { "query": "packageName", "path": "node_modules", "includeIgnored": true }',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: {
          type: 'string',
          description: 'The text pattern to search for',
        },
        path: {
          type: 'string',
          description: 'Directory to search in. Defaults to "."',
        },
        includeIgnored: {
          type: 'boolean',
          description: 'Whether to include ignored/dependency content such as node_modules. Defaults to false.',
        },
      },
      required: ['query'],
    },
    async execute(raw: unknown): Promise<ToolResult> {
      if (!isSearchFilesInput(raw)) {
        return {
          ok: false,
          error: 'Invalid input for search_files. Required field: query. Optional fields: path, includeIgnored.',
        };
      }

      const input: SearchFilesInput = raw;
      const workspaceRoot = configuredWorkspaceRoot ?? process.cwd();
      const dir = resolve(workspaceRoot, input.path ?? '.');
      const explicitlyTargetedExcludedDirs = excludedDirNames.filter((name) => isExplicitlyTargetingExcludedDir(dir, name));
      const includeIgnored = input.includeIgnored === true || explicitlyTargetedExcludedDirs.length > 0;
      const excludedDirs = getEffectiveExcludedDirs({
        configuredExcludedDirs: excludedDirNames,
        dir,
        includeIgnored,
      });

      try {
        const output = isRipgrepAvailable()
          ? runRipgrepSearch({ query: input.query, dir, includeIgnored, excludedDirs })
          : runGrepFallbackSearch({ query: input.query, dir, excludedDirs });
        return { ok: true, output: output.trim() || 'No matches found.' };
      } catch (err) {
        if (isSearchNoMatchError(err)) {
          return { ok: true, output: 'No matches found.' };
        }
        return { ok: false, error: `Search failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  };
}

export const searchFilesTool: ToolDefinition = createSearchFilesTool();

function isSearchFilesInput(raw: unknown): raw is SearchFilesInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return false;
  }

  const input = raw as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.some((key) => key !== 'query' && key !== 'path' && key !== 'includeIgnored')) {
    return false;
  }

  if (typeof input.query !== 'string') {
    return false;
  }

  const validPath = input.path === undefined || typeof input.path === 'string';
  const validIncludeIgnored = input.includeIgnored === undefined || typeof input.includeIgnored === 'boolean';
  return validPath && validIncludeIgnored;
}

function isRipgrepAvailable(): boolean {
  if (cachedRipgrepAvailable !== undefined) {
    return cachedRipgrepAvailable;
  }

  try {
    execFileSync('rg', ['--version'], { stdio: 'ignore', timeout: 2_000 });
    cachedRipgrepAvailable = true;
  } catch {
    cachedRipgrepAvailable = false;
  }

  return cachedRipgrepAvailable;
}

function runRipgrepSearch(args: {
  query: string;
  dir: string;
  includeIgnored: boolean;
  excludedDirs: string[];
}): string {
  const commandArgs = [
    '--line-number',
    '--no-heading',
    '--color',
    'never',
    ...args.excludedDirs.flatMap((name) => ['--glob', `!**/${name}/**`]),
  ];

  if (args.includeIgnored) {
    commandArgs.push('--no-ignore', '--hidden');
  }

  commandArgs.push('--', args.query, args.dir);
  return execFileSync('rg', commandArgs, {
    encoding: 'utf-8',
    timeout: SEARCH_TIMEOUT_MS,
    maxBuffer: SEARCH_MAX_BUFFER,
  });
}

function runGrepFallbackSearch(args: { query: string; dir: string; excludedDirs: string[] }): string {
  return execFileSync(
    'grep',
    [
      '-rnI',
      ...args.excludedDirs.map((name) => `--exclude-dir=${name}`),
      ...GREP_TEXT_FILE_GLOBS.map((glob) => `--include=${glob}`),
      '--',
      args.query,
      args.dir,
    ],
    { encoding: 'utf-8', timeout: SEARCH_TIMEOUT_MS, maxBuffer: SEARCH_MAX_BUFFER },
  );
}

function isSearchNoMatchError(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'status' in err && err.status === 1);
}

function sanitizeExcludedDirs(custom: string[] | undefined): string[] {
  if (!custom || custom.length === 0) {
    return DEFAULT_SEARCH_EXCLUDED_DIRS;
  }

  const normalized = custom
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace(/^\.?\//, '').replace(/\/+$/, ''));

  return normalized.length > 0 ? normalized : DEFAULT_SEARCH_EXCLUDED_DIRS;
}

function getEffectiveExcludedDirs(args: {
  configuredExcludedDirs: string[];
  dir: string;
  includeIgnored: boolean;
}): string[] {
  if (!args.includeIgnored) {
    return args.configuredExcludedDirs.filter((name) => !isExplicitlyTargetingExcludedDir(args.dir, name));
  }

  return PROTECTED_STATE_DIRS.filter((name) => !isExplicitlyTargetingExcludedDir(args.dir, name));
}

function isExplicitlyTargetingExcludedDir(dir: string, excludedName: string): boolean {
  const normalizedExcludedName = excludedName.trim().replace(/^\.?\//, '').replace(/\/+$/, '');
  if (!normalizedExcludedName) {
    return false;
  }

  const segments = dir.split(/[/\\]+/).filter(Boolean);
  return segments.includes(normalizedExcludedName);
}
