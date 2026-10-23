import { pathToFileURL } from 'node:url';
/** Facades may be imported without performing I/O or consuming the host's argv. */
export function runIfMain(url, main) {
    if (process.argv[1] && url === pathToFileURL(process.argv[1]).href) {
        void Promise.resolve().then(() => main(process.argv.slice(2))).then(code => {
            if (typeof code === 'number')
                process.exitCode = code;
        }).catch((error) => {
            console.error(error instanceof Error ? error.message : String(error));
            process.exitCode = 1;
        });
    }
}
export function argument(args, index) {
    const value = args[index];
    if (value === undefined)
        throw new Error(`Argumento ${index + 1} obrigatório`);
    return value;
}
