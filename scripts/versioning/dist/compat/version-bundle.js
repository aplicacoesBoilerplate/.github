import { readFileSync, statSync, writeFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { captureVersionBundle, applyVersionBundle, validateBundleContext } from '../services/legacy-version-bundle.js';
import { runProcess } from '../ports/process.js';
import { validateVersionReport } from './version-report.js';
import { argument } from './cli.js';
export function main(args) {
    const get = (index) => argument(args, index);
    const mode = get(0), repository = get(1), projectPath = get(2), bundlePath = get(4);
    const report = validateVersionReport(JSON.parse(readFileSync(get(3), 'utf8')));
    if (mode === 'capture' || mode === 'generate') {
        if (mode === 'generate') {
            // Check the report and checkout before invoking a native executable.
            validateBundleContext({ repository, projectPath, report });
            runProcess({ command: get(5), args: ['--skip.commit', '--skip.tag', '--tag-prefix', report.tagPrefix ?? 'v'],
                cwd: realpathSync(join(repository, projectPath)), workspace: realpathSync(repository) });
        }
        writeFileSync(bundlePath, JSON.stringify(captureVersionBundle({ repository, projectPath, report })) + '\n');
    }
    else if (mode === 'apply') {
        if (statSync(bundlePath).size > 16 * 1024 * 1024)
            throw new Error('Bundle excede limite serializado');
        process.stdout.write(applyVersionBundle({ repository, projectPath, report,
            bundle: JSON.parse(readFileSync(bundlePath, 'utf8')) }).join('\n'));
    }
    else
        throw new Error('Modo de bundle inválido');
}
