import { resolve } from 'node:path';
import { MemoryNoteService } from '@/core/memory/note-service.js';
import type { ListMemoryNotesInput, ReadMemoryNoteInput, SearchMemoryNotesInput } from '@/core/memory/types.js';
import type { ToolDefinition, ToolResult } from '@/core/types.js';

export type MemoryNotesToolOptions = {
  memoryRoot?: string;
};

const DEFAULT_MEMORY_ROOT = resolve(process.cwd(), '.heddle', 'memory');

export function createListMemoryNotesTool(options: MemoryNotesToolOptions = {}): ToolDefinition {
  return {
    name: 'list_memory_notes',
    description:
      'List markdown notes inside Heddle-managed persistent memory under .heddle/memory. Use this to follow the catalog discovery path for durable preferences, workflows, current-state handoff, operational conventions, relationships, history, and other reusable agent context. Optional field: path, relative to the memory root, to limit listing to a subdirectory. Returns relative note paths. Example inputs: {}, { "path": "." }, { "path": "preferences" }.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: {
          type: 'string',
          description: 'Optional memory-relative subdirectory to list from',
        },
      },
    },
    async execute(raw: unknown): Promise<ToolResult> {
      if (!MemoryNotesToolInput.isList(raw)) {
        return { ok: false, error: 'Invalid input for list_memory_notes. Optional field: path.' };
      }

      try {
        return {
          ok: true,
          output: (await memoryNotes(options).list(raw)).join('\n'),
        };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}

export function createReadMemoryNoteTool(options: MemoryNotesToolOptions = {}): ToolDefinition {
  return {
    name: 'read_memory_note',
    description:
      'Read a Heddle-managed persistent memory note from .heddle/memory. Prefer reading README.md catalogs first, then focused notes linked from those catalogs. Use this for durable agent context such as user/team preferences, task formats, workflows, current-state handoff, operational knowledge, relationships, history, known issues, or common commands. Optional fields: maxLines and offset for paging long notes. The path must stay inside the memory root. Example inputs: { "path": "README.md" }, { "path": "preferences/README.md" }, { "path": "preferences/ticket-format.md" }.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: {
          type: 'string',
          description: 'Memory-relative path to the note',
        },
        maxLines: {
          type: 'number',
          description: 'Maximum number of lines to return',
        },
        offset: {
          type: 'number',
          description: '0-based line offset to start from',
        },
      },
      required: ['path'],
    },
    async execute(raw: unknown): Promise<ToolResult> {
      if (!MemoryNotesToolInput.isRead(raw)) {
        return { ok: false, error: 'Invalid input for read_memory_note. Required field: path. Optional fields: maxLines, offset.' };
      }

      try {
        return {
          ok: true,
          output: await memoryNotes(options).read(raw),
        };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}

export function createSearchMemoryNotesTool(options: MemoryNotesToolOptions = {}): ToolDefinition {
  return {
    name: 'search_memory_notes',
    description:
      'Search Heddle-managed markdown memory under .heddle/memory. Use this before broad repo search when the user asks about durable preferences, ticket/response formats, workflows, recurring operational patterns, current-state handoff, relationships, or history and you do not yet know the right catalog path. Input example: { "query": "ticket" }. Optional fields: path to limit the search to a subdirectory or note, and maxResults to cap returned lines. Returns grep-style path:line:content output or "No matches found.".',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: {
          type: 'string',
          description: 'Text to search for in memory notes',
        },
        path: {
          type: 'string',
          description: 'Optional memory-relative subdirectory or note path to search within',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of matching lines to return',
        },
      },
      required: ['query'],
    },
    async execute(raw: unknown): Promise<ToolResult> {
      if (!MemoryNotesToolInput.isSearch(raw)) {
        return { ok: false, error: 'Invalid input for search_memory_notes. Required field: query. Optional fields: path, maxResults.' };
      }

      try {
        return {
          ok: true,
          output: await memoryNotes(options).search(raw),
        };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}

export function createEditMemoryNoteTool(options: MemoryNotesToolOptions = {}): ToolDefinition {
  return {
    name: 'edit_memory_note',
    description:
      'Create or edit a persistent markdown note inside .heddle/memory. Use this for stable reusable project knowledge that should survive future sessions. Use { "path", "oldText", "newText" } for an exact replacement, optionally with replaceAll, or use { "path", "content", "createIfMissing" } to overwrite an existing note or create a new one explicitly. This tool does not require approval; you should maintain durable memory proactively at sensible checkpoints. If the built-in edit flow is insufficient, it is acceptable to use mature shell tools against the memory directory.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: {
          type: 'string',
          description: 'Memory-relative markdown note path',
        },
        oldText: {
          type: 'string',
          description: 'Existing text to replace exactly',
        },
        newText: {
          type: 'string',
          description: 'Replacement text for oldText',
        },
        replaceAll: {
          type: 'boolean',
          description: 'Replace every matching occurrence instead of requiring a single exact match',
        },
        content: {
          type: 'string',
          description: 'Full note content to write',
        },
        createIfMissing: {
          type: 'boolean',
          description: 'Allow creating the note if it does not already exist when using content',
        },
      },
      required: ['path'],
    },
    async execute(raw: unknown): Promise<ToolResult> {
      return await memoryNotes(options).edit(raw);
    },
  };
}

export const listMemoryNotesTool = createListMemoryNotesTool();
export const readMemoryNoteTool = createReadMemoryNoteTool();
export const searchMemoryNotesTool = createSearchMemoryNotesTool();
export const editMemoryNoteTool = createEditMemoryNoteTool();

class MemoryNotesToolInput {
  static isList(raw: unknown): raw is ListMemoryNotesInput {
    if (raw === undefined) {
      return true;
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return false;
    }

    const input = raw as Record<string, unknown>;
    return Object.keys(input).every((key) => key === 'path')
      && (input.path === undefined || typeof input.path === 'string');
  }

  static isRead(raw: unknown): raw is ReadMemoryNoteInput {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return false;
    }

    const input = raw as Record<string, unknown>;
    return Object.keys(input).every((key) => key === 'path' || key === 'maxLines' || key === 'offset')
      && typeof input.path === 'string'
      && (input.maxLines === undefined || typeof input.maxLines === 'number')
      && (input.offset === undefined || typeof input.offset === 'number');
  }

  static isSearch(raw: unknown): raw is SearchMemoryNotesInput {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return false;
    }

    const input = raw as Record<string, unknown>;
    return Object.keys(input).every((key) => key === 'query' || key === 'path' || key === 'maxResults')
      && typeof input.query === 'string'
      && input.query.trim().length > 0
      && (input.path === undefined || typeof input.path === 'string')
      && (input.maxResults === undefined || typeof input.maxResults === 'number');
  }
}

function memoryNotes(options: MemoryNotesToolOptions): MemoryNoteService {
  return new MemoryNoteService(resolve(options.memoryRoot ?? DEFAULT_MEMORY_ROOT));
}
