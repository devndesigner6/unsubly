import { Buffer } from "buffer/"

;(globalThis as any).global = globalThis
;(globalThis as any).process = (globalThis as any).process || { env: {}, version: "", browser: true }
;(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer
