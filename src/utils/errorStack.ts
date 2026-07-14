import { SourceMapConsumer } from 'source-map-js';

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

/** monitor-admin 侧配置的业务 dev 地址（.env.development → VITE_SOURCE_PROXY_TARGET） */
export function getConfiguredSourceProxyTarget(): string {
  return import.meta.env.VITE_SOURCE_PROXY_TARGET || 'http://127.0.0.1:3002';
}

/** 源码加载失败时的配置提示 */
export function getSourceProxySetupHint(): string {
  const target = getConfiguredSourceProxyTarget();
  return (
    '请确认：① csl-new-front 已启动；② monitor-admin 用 npm run dev 运行（静态/preview 无代理时需改 .env）；'
    + `③ fe-monitor/monitor-admin/.env.development 中 VITE_SOURCE_PROXY_TARGET=${target} 与业务端口一致，改后重启 admin。`
  );
}

/** 相对路径堆栈补全为带端口的绝对 URL（用 VITE_SOURCE_PROXY_TARGET） */
export function resolveDevFileUrl(fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  try {
    const origin = new URL(getConfiguredSourceProxyTarget()).origin;
    const qIdx = fileUrl.indexOf('?');
    const pathPart = qIdx >= 0 ? fileUrl.slice(0, qIdx) : fileUrl;
    const search = qIdx >= 0 ? fileUrl.slice(qIdx) : '';
    const pathname = pathPart.startsWith('/') ? pathPart : `/src/pages/project/${pathPart}`;
    return `${origin}${pathname}${search}`;
  } catch {
    return fileUrl;
  }
}

/** 从报错 filename 解析本地 dev 服务 host:port（仅 localhost / 127.0.0.1） */
export function getDevServerHostPort(fileUrl: string): { hostname: string; port: string } | null {
  try {
    if (!/^https?:\/\//i.test(fileUrl)) return null;
    const u = new URL(fileUrl);
    if (!/^(localhost|127\.0\.0\.1)$/i.test(u.hostname)) return null;
    const port = u.port || (u.protocol === 'https:' ? '443' : '80');
    return { hostname: u.hostname, port };
  } catch {
    return null;
  }
}

/** 开发环境源码 URL → monitor-admin 代理路径（规避 CORS，保留报错页 dev 端口） */
export function toSourceProxyUrl(fileUrl: string): string | null {
  try {
    if (/^https?:\/\//i.test(fileUrl)) {
      const u = new URL(fileUrl);
      if (!/^(localhost|127\.0\.0\.1)$/i.test(u.hostname)) return null;
      const port = u.port || (u.protocol === 'https:' ? '443' : '80');
      const path = `${u.pathname}${u.search}`;
      if (port && port !== '80' && port !== '443') {
        return `/source-proxy/dev/${u.hostname}/${port}${path}`;
      }
      return `/source-proxy${path}`;
    }
    // 堆栈里可能是 /src/pages/.../me.vue 或 me.vue
    const qIdx = fileUrl.indexOf('?');
    const pathPart = qIdx >= 0 ? fileUrl.slice(0, qIdx) : fileUrl;
    const search = qIdx >= 0 ? fileUrl.slice(qIdx) : '';
    const pathname = pathPart.startsWith('/') ? pathPart : `/src/pages/project/${pathPart}`;
    return `/source-proxy${pathname}${search}`;
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

export interface SourceContextResult {
  lines: SourceLine[];
  /** source map 还原后的源码行号（.vue 等原始文件） */
  line: number;
  column?: number;
}

interface ResolvedOriginalPosition {
  sourceText: string;
  line: number;
  column: number | null;
}

/** 从 Vite 编译产物末尾解析 inline source map */
function extractInlineSourceMapPayload(code: string): Record<string, unknown> | null {
  const match = code.match(/\/\/# sourceMappingURL=data:application\/json;base64,(.+)$/m);
  if (!match) return null;
  try {
    return JSON.parse(atob(match[1].trim())) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function findSourceContentIndex(
  sources: string[],
  source: string,
): number {
  let idx = sources.indexOf(source);
  if (idx >= 0) return idx;

  const normalized = source.replace(/\/\.\//g, '/');
  idx = sources.indexOf(normalized);
  if (idx >= 0) return idx;

  const baseName = source.split('/').pop() || source;
  return sources.findIndex(
    (item) =>
      item === source
      || item.endsWith(`/${baseName}`)
      || item.endsWith(baseName),
  );
}

/** 将堆栈中的编译行号映射回原始源码（Vite + Vue SFC） */
async function resolveOriginalSourcePosition(
  generatedCode: string,
  genLine: number,
  genColumn?: number,
): Promise<ResolvedOriginalPosition | null> {
  const payload = extractInlineSourceMapPayload(generatedCode);
  const sources = payload?.sources as string[] | undefined;
  const sourcesContent = payload?.sourcesContent as Array<string | null> | undefined;
  if (!payload || !sources?.length || !sourcesContent?.length) return null;

  const consumer = await new SourceMapConsumer(payload as Parameters<typeof SourceMapConsumer>[0]);
  try {
    const pos = consumer.originalPositionFor({
      line: genLine,
      column: genColumn ?? 0,
    });
    if (!pos.source || pos.line == null) return null;

    const idx = findSourceContentIndex(sources, pos.source);
    if (idx < 0) return null;

    const sourceText = sourcesContent[idx];
    if (!sourceText) return null;

    return {
      sourceText,
      line: pos.line,
      column: pos.column,
    };
  } finally {
    if (typeof consumer.destroy === 'function') {
      consumer.destroy();
    }
  }
}

/** 获取 .vue 文件中 `<script>` 区块行范围（1-based，含 `<script>` / `</script>` 行） */
function getScriptLineRange(lines: string[]): { start: number; end: number } | null {
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/<script\b/.test(lines[i])) start = i + 1;
    if (start > 0 && /<\/script>/.test(lines[i])) {
      return { start, end: i + 1 };
    }
  }
  return null;
}

function isLineInRange(line: number, range?: { start: number; end: number } | null): boolean {
  if (!range) return true;
  return line >= range.start && line <= range.end;
}

/** 从 Vite 编译产物 source map 中取原始 .vue 源码 */
function extractVueSourceFromGenerated(generatedCode: string): string | null {
  const payload = extractInlineSourceMapPayload(generatedCode);
  const sources = payload?.sources as string[] | undefined;
  const sourcesContent = payload?.sourcesContent as Array<string | null> | undefined;
  if (!sources?.length || !sourcesContent?.length) return null;

  for (let i = 0; i < sources.length; i += 1) {
    const content = sourcesContent[i];
    if (!content) continue;
    if (sources[i].endsWith('.vue') || content.includes('<script')) return maybeFixUtf8Mojibake(content);
  }
  const fallback = sourcesContent[0];
  return fallback ? maybeFixUtf8Mojibake(fallback) : null;
}

function getVuePathname(fileUrl: string): string | null {
  try {
    if (/^https?:\/\//i.test(fileUrl)) {
      return new URL(fileUrl).pathname;
    }
    const qIdx = fileUrl.indexOf('?');
    const pathPart = qIdx >= 0 ? fileUrl.slice(0, qIdx) : fileUrl;
    return pathPart.startsWith('/') ? pathPart : `/src/pages/project/${pathPart}`;
  } catch {
    return null;
  }
}

/** 修复 UTF-8 被误读为 Latin-1 导致的乱码（如 æ¨¡æ‹Ÿ → 模拟） */
function maybeFixUtf8Mojibake(text: string): string {
  if (/[\u4e00-\u9fff]/.test(text)) return text;
  if (!/[\u00c0-\u00ff]/.test(text)) return text;
  try {
    const bytes = Uint8Array.from([...text], (c) => c.charCodeAt(0) & 0xff);
    const fixed = new TextDecoder('utf-8').decode(bytes);
    if (/[\u4e00-\u9fff]/.test(fixed)) return fixed;
  } catch {
    // ignore
  }
  return text;
}

function parseViteRawModule(moduleText: string): string | null {
  const trimmed = moduleText.trim();
  const prefix = 'export default ';
  if (!trimmed.startsWith(prefix)) return null;
  const literal = trimmed.slice(prefix.length).replace(/;\s*$/, '');
  try {
    return JSON.parse(literal) as string;
  } catch {
    return null;
  }
}

function buildLocalDevFileUrl(fileUrl: string, pathname: string, search = ''): string {
  const dev = getDevServerHostPort(fileUrl);
  if (dev) {
    return `http://${dev.hostname}:${dev.port}${pathname}${search}`;
  }
  return `http://127.0.0.1${pathname}${search}`;
}

/** 通过 Vite ?raw 拉取磁盘上的 .vue 原文（中文编码最可靠） */
async function fetchRawVueSource(fileUrl: string): Promise<string | null> {
  const pathname = getVuePathname(fileUrl);
  if (!pathname?.endsWith('.vue')) return null;

  const proxyUrl = toSourceProxyUrl(buildLocalDevFileUrl(fileUrl, pathname, '?raw'));
  if (!proxyUrl) return null;

  try {
    const res = await fetch(proxyUrl);
    if (!res.ok) return null;
    const moduleText = await res.text();
    return parseViteRawModule(moduleText);
  } catch {
    return null;
  }
}

/** 从 TypeError 文案提取被读取的属性名，如 productName */
function extractErrorPropertyName(message?: string): string | null {
  const m =
    message?.match(/reading\s+'([^']+)'/i) || message?.match(/reading\s+"([^"]+)"/i);
  return m?.[1] ?? null;
}

/** 定位函数体在源码中的行范围（1-based，含起止行） */
function findFunctionBodyRange(
  lines: string[],
  functionName: string,
): { start: number; end: number } | null {
  const startIdx = lines.findIndex(
    (line) =>
      new RegExp(`\\bfunction\\s+${functionName}\\s*\\(`).test(line)
      || new RegExp(`\\b${functionName}\\s*=\\s*(?:async\\s*)?\\(`).test(line),
  );
  if (startIdx < 0) return null;

  let depth = 0;
  let started = false;
  for (let i = startIdx; i < lines.length; i += 1) {
    for (const ch of lines[i]) {
      if (ch === '{') {
        depth += 1;
        started = true;
      } else if (ch === '}') {
        depth -= 1;
        if (started && depth === 0) {
          return { start: startIdx + 1, end: i + 1 };
        }
      }
    }
  }
  return { start: startIdx + 1, end: Math.min(lines.length, startIdx + 30) };
}

/**
 * 二次校准报错行：仅在 script 区块内搜索，避免误匹配 template 中的同名属性。
 * window error 上报的 lineno（reportLine）优先于堆栈虚拟模块行号。
 */
export function refineErrorLocation(
  sourceText: string,
  mappedLine: number,
  mappedColumn: number | null | undefined,
  message?: string,
  functionName?: string,
  scriptRange?: { start: number; end: number } | null,
): { line: number; column?: number } {
  const lines = sourceText.split(/\r?\n/);
  const prop = extractErrorPropertyName(message);
  const inScope = (lineNum: number) => isLineInRange(lineNum, scriptRange);

  // 1. 堆栈函数名最可靠：在函数体内找报错属性
  if (functionName) {
    const fnRange = findFunctionBodyRange(lines, functionName);
    if (fnRange) {
      if (prop) {
        const dotProp = `.${prop}`;
        for (let n = fnRange.start; n <= fnRange.end; n += 1) {
          const lineText = lines[n - 1] ?? '';
          if (lineText.includes(dotProp)) {
            return { line: n, column: lineText.indexOf(dotProp) + 1 };
          }
        }
      }
      const throwLine = Math.min(fnRange.start + 2, fnRange.end);
      const throwText = lines[throwLine - 1] ?? '';
      return {
        line: throwLine,
        column: mappedColumn ?? (prop && throwText.includes(`.${prop}`)
          ? throwText.indexOf(`.${prop}`) + 1
          : undefined),
      };
    }
  }

  const mappedText = lines[mappedLine - 1] ?? '';
  if (mappedText && inScope(mappedLine)) {
    if (!prop || mappedText.includes(`.${prop}`)) {
      const dotProp = prop ? `.${prop}` : '';
      return {
        line: mappedLine,
        column:
          mappedColumn
          ?? (dotProp && mappedText.includes(dotProp) ? mappedText.indexOf(dotProp) + 1 : undefined),
      };
    }
  }

  if (prop) {
    const dotProp = `.${prop}`;
    const candidates: number[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      const lineNum = i + 1;
      if (lines[i].includes(dotProp) && inScope(lineNum)) candidates.push(lineNum);
    }

    if (candidates.length === 1) {
      const lineText = lines[candidates[0] - 1] ?? '';
      return { line: candidates[0], column: lineText.indexOf(dotProp) + 1 };
    }
    if (candidates.length > 1) {
      const line = candidates.reduce((best, cur) =>
        Math.abs(cur - mappedLine) < Math.abs(best - mappedLine) ? cur : best,
      );
      const lineText = lines[line - 1] ?? '';
      return { line, column: lineText.indexOf(dotProp) + 1 };
    }
  }

  return { line: mappedLine, column: mappedColumn ?? undefined };
}

function buildSourceLines(
  allLines: string[],
  errorLine: number,
  radius: number,
  column?: number,
  message?: string,
): SourceLine[] {
  const start = Math.max(1, errorLine - radius);
  const end = Math.min(allLines.length, errorLine + radius);

  const result: SourceLine[] = [];
  for (let num = start; num <= end; num += 1) {
    const lineText = allLines[num - 1] ?? '';
    const isError = num === errorLine;
    result.push({
      num,
      text: lineText,
      isError,
      mark: isError ? resolveErrorMarkRange(lineText, column, message) ?? undefined : undefined,
    });
  }
  return result;
}

/** Vite 堆栈 URL 缺 query 时，补全 script 子模块参数以便拿到可映射的 source map */
function ensureViteVueScriptUrl(fileUrl: string): string {
  try {
    let origin = 'http://localhost';
    let pathname: string;
    let search: string;
    if (/^https?:\/\//i.test(fileUrl)) {
      const u = new URL(fileUrl);
      origin = u.origin;
      pathname = u.pathname;
      search = u.search;
    } else {
      const qIdx = fileUrl.indexOf('?');
      const pathPart = qIdx >= 0 ? fileUrl.slice(0, qIdx) : fileUrl;
      search = qIdx >= 0 ? fileUrl.slice(qIdx) : '';
      pathname = pathPart.startsWith('/') ? pathPart : `/src/pages/project/${pathPart}`;
    }
    if (!pathname.endsWith('.vue')) return fileUrl;
    const u = new URL(`${origin}${pathname}${search}`);
    if (u.searchParams.has('vue') && u.searchParams.get('type') === 'script') {
      return u.toString();
    }
    u.searchParams.set('vue', '');
    u.searchParams.set('type', 'script');
    if (!u.searchParams.has('setup')) u.searchParams.set('setup', 'true');
    return u.toString();
  } catch {
    return fileUrl;
  }
}

/** 拉取报错行附近源码（Vite + Vue SFC：堆栈行号经 source map 还原，仅在 script 内定位） */
export async function fetchSourceContext(
  fileUrl: string,
  stackLine: number,
  radius = 6,
  stackColumn?: number,
  message?: string,
  functionName?: string,
  reportLine?: number,
  reportColumn?: number,
): Promise<SourceContextResult | null> {
  const absoluteFileUrl = resolveDevFileUrl(fileUrl);
  const fetchUrl = ensureViteVueScriptUrl(absoluteFileUrl);
  const proxyUrl = toSourceProxyUrl(fetchUrl);
  if (!proxyUrl || (!stackLine && !reportLine)) return null;

  const res = await fetch(proxyUrl);
  if (!res.ok) return null;

  const generatedCode = await res.text();
  const rawVue = await fetchRawVueSource(absoluteFileUrl);
  let sourceText = rawVue ?? extractVueSourceFromGenerated(generatedCode) ?? generatedCode;
  const scriptRange = getScriptLineRange(sourceText.split(/\r?\n/));

  const allLines = sourceText.split(/\r?\n/);
  const prop = extractErrorPropertyName(message);

  // 仅当 lineno 落在 <script> 内才考虑信任（42 这类虚拟模块行号会落在 template，必须忽略）
  const reportInScript =
    reportLine != null
    && reportLine > 0
    && scriptRange != null
    && isLineInRange(reportLine, scriptRange);

  if (reportInScript) {
    const reportText = allLines[reportLine! - 1] ?? '';
    const reportLineMatchesError =
      !prop || reportText.includes(`.${prop}`);

    if (reportLineMatchesError) {
      const refined = refineErrorLocation(
        sourceText,
        reportLine!,
        reportColumn ?? stackColumn,
        message,
        functionName,
        scriptRange,
      );
      return {
        line: refined.line,
        column: refined.column ?? reportColumn ?? stackColumn,
        lines: buildSourceLines(
          allLines,
          refined.line,
          radius,
          refined.column ?? reportColumn ?? stackColumn,
          message,
        ),
      };
    }
  }

  let errorLine = stackLine || reportLine || 0;
  let errorColumn = stackColumn ?? reportColumn;

  if (stackLine) {
    const resolved = await resolveOriginalSourcePosition(generatedCode, stackLine, stackColumn);
    if (resolved) {
      sourceText = resolved.sourceText;
      errorLine = resolved.line;
      errorColumn = resolved.column ?? stackColumn;
    }
  }

  const finalLines = sourceText.split(/\r?\n/);
  const finalScriptRange = getScriptLineRange(finalLines);

  const refined = refineErrorLocation(
    sourceText,
    errorLine,
    errorColumn,
    message,
    functionName,
    finalScriptRange,
  );

  return {
    line: refined.line,
    column: refined.column,
    lines: buildSourceLines(finalLines, refined.line, radius, refined.column, message),
  };
}
