// Classic Web Worker for Solidity compilation.
// importScripts runs soljson.js in the global scope so emscripten's
// `var Module = Module || {}` picks up our pre-configured self.Module.

let _sol: any = null

async function loadSoljson(): Promise<any> {
    if (_sol) return _sol

    await new Promise<void>((resolve, reject) => {
        // Pre-configure Module before the script runs so onRuntimeInitialized fires
        (self as any).Module = { onRuntimeInitialized: resolve }
        try {
            // importScripts executes in the worker global scope (not a function scope)
            importScripts('/soljson.js')
        } catch (e) {
            reject(e)
        }
    })

    _sol = (self as any).Module
    if (typeof _sol?.cwrap !== 'function')
        throw new Error('soljson.js initialised but cwrap not found')
    return _sol
}

function runCompile(sol: any, inputJson: string): string {
    const compileFn = sol.cwrap('solidity_compile', 'string', ['string', 'number', 'number'])
    const addFn: (fn: Function, sig: string) => number =
        sol.addFunction ?? sol.Runtime?.addFunction
    const removeFn: (p: number) => void =
        sol.removeFunction ?? sol.Runtime?.removeFunction
    const fromCStr: (p: number) => string =
        sol.UTF8ToString ?? sol.Pointer_stringify

    const importCb = addFn((
        _ctx: number, _kind_ptr: number, data_ptr: number,
        _contents_ptr: number, error_ptr: number,
    ) => {
        const file = fromCStr(data_ptr)
        const err = `Import "${file}" not supported`
        const len = sol.lengthBytesUTF8(err)
        const buf = sol._malloc(len + 1)
        sol.stringToUTF8(err, buf, len + 1)
        sol.setValue(error_ptr, buf, '*')
    }, 'viiiii')

    let output: string
    try {
        output = compileFn(inputJson, importCb, 0)
    } finally {
        removeFn(importCb)
        try { sol.cwrap('solidity_reset', null, [])() } catch { /* ignore */ }
    }
    return output
}

self.onmessage = async (e: MessageEvent) => {
    const { id, sourceCode } = e.data
    try {
        const sol = await loadSoljson()

        const inputJson = JSON.stringify({
            language: 'Solidity',
            sources: { 'contract.sol': { content: sourceCode } },
            settings: {
                outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } },
                optimizer: { enabled: true, runs: 200 },
            },
        })

        const outputStr = runCompile(sol, inputJson)
        const output = JSON.parse(outputStr) as any

        const errors = (output.errors ?? []).filter((e: any) => e.severity === 'error')
        if (errors.length > 0) {
            self.postMessage({
                id, status: 1, abi: '', bytecode: '',
                msg: errors.map((e: any) => e.formattedMessage ?? e.message).join('\n'),
            })
            return
        }

        const file = Object.keys(output.contracts ?? {})[0]
        if (!file) {
            self.postMessage({ id, status: 1, abi: '', bytecode: '', msg: 'No contracts found' })
            return
        }

        const name = Object.keys(output.contracts[file]).pop()!
        const contract = output.contracts[file][name]

        self.postMessage({
            id, status: 0,
            abi: JSON.stringify(contract.abi),
            bytecode: '0x' + contract.evm.bytecode.object,
        })
    } catch (err: any) {
        self.postMessage({ id, status: 1, abi: '', bytecode: '', msg: String(err?.message ?? err) })
    }
}
