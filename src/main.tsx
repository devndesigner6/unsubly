import { Buffer } from "buffer/"
import React from "react"
import ReactDOM from "react-dom/client"
import "./index.css"

const globalScope = globalThis as any

if (typeof globalScope.global === "undefined") {
  globalScope.global = globalScope
}

if (typeof globalScope.process === "undefined") {
  globalScope.process = { env: {}, version: "", browser: true }
}

if (typeof globalScope.Buffer === "undefined") {
  globalScope.Buffer = Buffer
}

async function bootstrap() {
  const { default: App } = await import("./App")

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

bootstrap()
