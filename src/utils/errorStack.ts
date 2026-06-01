export interface ParsedStackFrame {
  raw: string;
  functionName?: string;
  file?: string;
  line?: number;
  column?: number;
}

const FRAME_RE =
  /^\s*at\s+(?:async\s+)?(?:([\w$.<>[\]'"]+)\s+)?\(?(.+?):(\d+):(\d+)\)?\s*$/;

/** 解析 Error.stack 为帧列表（首行多为 message） */
export function parseStackFrames(stack?: string): {
  message: string;
  frames: ParsedStackFrame[];
} {
  if (!stack?.trim()) {
    return { message: '', frames: [] };
  }

  const lines = stack.split('\n');
  const frames: ParsedStackFrame[] = [];
  const messageParts: string[] = [];

  for (const line of lines) {
    const m = line.match(FRAME_RE);
    if (m) {
      frames.push({
        raw: line.trim(),
        functionName: m[1]?.trim(),
        file: m[2].trim(),
        line: Number(m[3]),
        column: Number(m[4]),
      });
    } else if (line.trim()) {
      messageParts.push(line.trim());
    }
  }

  return {
    message: messageParts.join('\n'),
    frames,
  };
}

/** 开发环境源码 URL → monitor-admin 代理路径（规避 CORS） */
export function toSourceProxyUrl(fileUrl: string): string | null {
  try {
    const u = new URL(fileUrl);
    if (!/^(localhost|127\.0\.0\.1)$/i.test(u.hostname)) return null;
    return `/source-proxy${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

export function shortFileName(file?: string): string {
  if (!file) return 'unknown';
  try {
    const u = new URL(file);
    return u.pathname.split('/').pop() || file;
  } catch {
    return file.split('/').pop() || file;
  }
}

export interface ErrorMarkRange {
  /** 0-based，含 */
  start: number;
  /** 0-based，不含 */
  end: number;
}

export interface SourceLine {
  num: number;
  text: string;
  isError: boolean;
  /** 报错行内波浪线标出的片段 */
  mark?: ErrorMarkRange;
}

/**
 * 根据列号 / 错误文案推算需波浪线标注的源码区间（如 `.productName.slice(0)`）。
 */
export function resolveErrorMarkRange(
  line: string,
  column?: number,
  message?: string,
): ErrorMarkRange | null {
  if (!line) return null;

  const propMatch =
    message?.match(/reading\s+'([^']+)'/i) || message?.match(/reading\s+"([^"]+)"/i);
  if (propMatch) {
    const prop = propMatch[1];
    const dotProp = `.${prop}`;
    const dotIdx = line.indexOf(dotProp);
    if (dotIdx >= 0) {
      return { start: dotIdx, end: extendMemberChainEnd(line, dotIdx) };
    }
  }

  if (column && column >= 1) {
    let anchor = Math.min(column - 1, line.length - 1);
    while (anchor > 0 && line[anchor] === ' ') anchor -= 1;

    let start = anchor;
    while (start > 0 && /[\w$)\]]/.test(line[start - 1])) start -= 1;
    if (start > 0 && line[start - 1] === '.') start -= 1;

    const end = extendMemberChainEnd(line, start);
    if (end > start) return { start, end };
  }

  return null;
}

/** 从 start 起向后扩展成员访问链（含 .method()） */
function extendMemberChainEnd(line: string, start: number): number {
  let end = start;
  if (line[end] === '.') {
    end += 1;
    while (end < line.length && /[\w$]/.test(line[end])) end += 1;
  }
  while (end < line.length && line[end] === '.') {
    end += 1;
    while (end < line.length && /[\w$]/.test(line[end])) end += 1;
    if (line[end] === '(') {
      let depth = 0;
      while (end < line.length) {
        const ch = line[end];
        if (ch === '(') depth += 1;
        else if (ch === ')') {
          depth -= 1;
          if (depth === 0) {
            end += 1;
            break;
          }
        }
        end += 1;
      }
    }
  }
  return Math.min(end, line.length);
}

/** 拉取报错行附近源码（依赖 vite 代理 /source-proxy） */
export async function fetchSourceContext(
  fileUrl: string,
  errorLine: number,
  radius = 6,
  column?: number,
  message?: string,
): Promise<SourceLine[] | null> {
  const proxyUrl = toSourceProxyUrl(fileUrl);
  if (!proxyUrl || !errorLine) return null;

  const res = await fetch(proxyUrl);
  if (!res.ok) return null;

  const text = await res.text();
  const allLines = text.split(/\r?\n/);
  const start = Math.max(1, errorLine - radius);
  const end = Math.min(allLines.length, errorLine + radius);

  const result: SourceLine[] = [];
  for (let num = start; num <= end; num += 1) {
    const text = allLines[num - 1] ?? '';
    const isError = num === errorLine;
    result.push({
      num,
      text,
      isError,
      mark: isError ? resolveErrorMarkRange(text, column, message) ?? undefined : undefined,
    });
  }
  return result;
}
