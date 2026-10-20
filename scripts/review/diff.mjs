import { contractError, validateRelativePath } from '../llm/validate-request.mjs';

const fail = () => { throw contractError('REVIEW_INCONCLUSIVE'); };
function path(value) {
  validateRelativePath(value);
  return value;
}

/** Parse complete Git unified text; never infer added lines from an incomplete hunk. */
export function buildDiffIndex(diff) {
  try {
    if (typeof diff !== 'string' || diff.includes('\0') || Buffer.byteLength(diff) > 16384) fail();
    if (diff === '') return { files: [] };
    const files = []; const seen = new Set();
    let file; let headers = 0; let hunk; let lastData = false;
    let nextOld = 0; let nextNew = 0; let modeChange = 0; let rename = 0;
    function finish() {
      if (!file) return;
      if (hunk && (hunk.oldLeft || hunk.newLeft)) fail();
      if (headers === 2 && !hunk) fail();
      if (headers !== 2 && !(headers === 0 && (modeChange === 2 || rename === 2))) fail();
      if (seen.has(file.path)) fail();
      seen.add(file.path); files.push(file);
      if (files.length > 100) fail();
    }
    const lines = diff.split('\n');
    if (lines.at(-1) === '') lines.pop();
    for (const line of lines) {
      if (line.startsWith('diff --git ')) {
        finish();
        const match = /^diff --git a\/(\S+) b\/(\S+)$/.exec(line);
        if (!match) fail();
        file = { path: path(match[2]), old_path: path(match[1]), added_lines: [] };
        headers = 0; hunk = null; nextOld = 0; nextNew = 0; modeChange = 0; rename = 0; lastData = false;
      } else if (!file) fail();
      else if (line === '\\ No newline at end of file') {
        if (!lastData) fail();
        lastData = false;
      } else if (hunk && (hunk.oldLeft || hunk.newLeft)) {
        const kind = line[0];
        if (![' ', '-', '+'].includes(kind)) fail();
        if (kind !== '+' && hunk.oldLeft-- <= 0) fail();
        if (kind !== '-' && hunk.newLeft-- <= 0) fail();
        if (kind === '+') file.added_lines.push(hunk.newLine);
        if (kind !== '-') hunk.newLine++;
        lastData = true;
      } else if (line.startsWith('@@ ')) {
        if (headers !== 2) fail();
        const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: .*)?$/.exec(line);
        if (!match) fail();
        const oldLine = Number(match[1]); const oldLeft = Number(match[2] ?? 1);
        const newLine = Number(match[3]); const newLeft = Number(match[4] ?? 1);
        if (![oldLine, oldLeft, newLine, newLeft].every(Number.isSafeInteger)
          || (oldLeft && oldLine === 0) || (newLeft && newLine === 0) || (!oldLeft && !newLeft)
          || oldLine < nextOld || newLine < nextNew) fail();
        nextOld = oldLine + oldLeft; nextNew = newLine + newLeft;
        if (!Number.isSafeInteger(nextOld) || !Number.isSafeInteger(nextNew)) fail();
        hunk = { oldLeft, newLeft, newLine }; lastData = false;
      } else if (hunk) fail();
      else if (line.startsWith('--- ')) {
        if (headers !== 0) fail();
        if (line === '--- /dev/null') file.old_path = null;
        else if (line !== `--- a/${file.old_path}`) fail();
        headers = 1;
      } else if (line.startsWith('+++ ')) {
        if (headers !== 1 || (line !== `+++ b/${file.path}` && line !== '+++ /dev/null')) fail();
        headers = 2;
      } else if (headers) fail();
      else if (/^index [a-f0-9]+\.\.[a-f0-9]+(?: 100(?:644|755))?$/.test(line)) { /* Git metadata, not a line of source. */ }
      else if (/^(?:new|deleted) file mode 100(?:644|755)$/.test(line)) modeChange = 2;
      else if (/^(?:old|new) mode 100(?:644|755)$/.test(line)) modeChange++;
      else if (/^similarity index (?:100|[0-9]{1,2})%$/.test(line)) { /* Rename metadata. */ }
      else if (line === `rename from ${file.old_path}` || line === `rename to ${file.path}`) rename++;
      else fail();
    }
    finish();
    return { files };
  } catch { fail(); }
}
