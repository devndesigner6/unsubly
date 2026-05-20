/**
 * Skill: lookup-service
 * Queries the on-chain ServiceRegistry to discover registered subscription
 * services. Used by the agent before releasing a vault to verify the
 * recipient is a known registered service and to log the service metadata.
 *
 * ServiceRegistry App ID is read from SERVICE_REGISTRY_APP_ID env var.
 * Falls back gracefully if registry is not configured or unreachable.
 */

import algosdk from "algosdk"

const NETWORK = (process.env.ALGO_NETWORK || "testnet").toLowerCase()
const ALGOD_URL = NETWORK === "mainnet"
  ? (process.env.ALGOD_MAINNET_URL || "https://mainnet-api.algonode.cloud")
  : (process.env.ALGOD_TESTNET_URL || "https://testnet-api.algonode.cloud")

const REGISTRY_APP_ID = NETWORK === "mainnet"
  ? process.env.SERVICE_REGISTRY_APP_ID_MAINNET
  : (process.env.SERVICE_REGISTRY_APP_ID_TESTNET || process.env.SERVICE_REGISTRY_APP_ID)

/**
 * Look up a service in the on-chain ServiceRegistry by recipient address.
 * Returns service metadata if found, null if not registered or registry unavailable.
 *
 * @param {string} recipientAddress - Algorand address of the payment recipient
 * @returns {{ name: string, price_microalgos: number, cycle_days: number } | null}
 */
export async function lookupService(recipientAddress) {
  if (!REGISTRY_APP_ID) {
    console.log("[lookup-service] SERVICE_REGISTRY_APP_ID not set — skipping registry check")
    return null
  }

  try {
    const algod = new algosdk.Algodv2(process.env.ALGOD_TOKEN || "", ALGOD_URL, "")
    const appId = Number(REGISTRY_APP_ID)

    // Fetch all boxes from the ServiceRegistry
    const boxesResp = await algod.getApplicationBoxes(appId).do()
    const boxes = boxesResp?.boxes ?? []

    for (const b of boxes) {
      const name = b.name instanceof Uint8Array ? b.name : new Uint8Array(b.name)

      // Box name format: "svc:" (4 bytes) + uint16-BE length + service_id bytes
      if (name.length < 6 || name[0] !== 0x73 || name[1] !== 0x76 || name[2] !== 0x63 || name[3] !== 0x3a) continue

      try {
        const boxResp = await algod.getApplicationBoxByName(appId, name).do()
        const value = boxResp?.value instanceof Uint8Array ? boxResp.value : new Uint8Array(boxResp?.value ?? [])

        if (value.length < 52) continue

        // ARC-4 struct layout (puyapy compiled):
        // provider (32 bytes) | price_microalgos (8 bytes) | cycle_days (8 bytes)
        // | name_len uint16-BE (2 bytes) | name_bytes (variable)
        // Total fixed header = 50 bytes
        const provider = algosdk.encodeAddress(value.slice(0, 32))

        if (provider !== recipientAddress) continue

        const price = Number(algosdk.decodeUint64(value.slice(32, 40), "safe"))
        const cycle = Number(algosdk.decodeUint64(value.slice(40, 48), "safe"))
        const nameLen = (value[48] << 8) | value[49]
        const serviceName = new TextDecoder().decode(value.slice(50, 50 + nameLen))

        // Extract service_id from box name
        const idLen = (name[4] << 8) | name[5]
        const serviceId = new TextDecoder().decode(name.slice(6, 6 + idLen))

        console.log(`[lookup-service] Found registered service: ${serviceName} (${serviceId}) — ${price} microALGO / ${cycle} days`)

        return {
          service_id: serviceId,
          name: serviceName,
          price_microalgos: price,
          cycle_days: cycle,
          provider,
        }
      } catch {
        // Skip malformed box
      }
    }

    console.log(`[lookup-service] Recipient ${recipientAddress.slice(0, 8)}… not found in ServiceRegistry`)
    return null
  } catch (err) {
    console.warn(`[lookup-service] Registry lookup failed: ${err.message}`)
    return null
  }
}
