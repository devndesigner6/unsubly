import { Buffer } from "buffer/"

const globalScope = globalThis as typeof globalThis & {
  global?: typeof globalThis
  process?: {
    env: Record<string, string>
    version: string
    browser: boolean
  }
  Buffer?: typeof Buffer
}

if (typeof globalScope.global === "undefined") {
  globalScope.global = globalScope
}

if (typeof globalScope.process === "undefined") {
  globalScope.process = { env: {}, version: "", browser: true }
}

if (typeof globalScope.Buffer === "undefined") {
  globalScope.Buffer = Buffer
}
