/**
 * AlgoKit Utils integration layer
 * Wraps @algorandfoundation/algokit-utils for standardized Algorand interactions
 * Compatible with AlgoBharat Hack Series 3.0 requirements
 */
import algosdk from "algosdk"
import { AlgorandClient } from "@algorandfoundation/algokit-utils"
import type { AlgorandNetwork } from "./constants"
import { getNetworkConfig } from "./constants"

let cachedClients: Map<AlgorandNetwork, AlgorandClient> = new Map()

/**
 * Get or create an AlgorandClient instance for the given network
 */
export function getAlgorandClient(network: AlgorandNetwork): AlgorandClient {
  const existing = cachedClients.get(network)
  if (existing) return existing

  const config = getNetworkConfig(network)

  const client = AlgorandClient.fromConfig({
    algodConfig: {
      server: config.algodServer,
      port: config.algodPort,
      token: config.algodToken,
    },
    indexerConfig: {
      server: config.indexerServer,
      port: config.indexerPort,
      token: "",
    },
  })

  cachedClients.set(network, client)
  return client
}

/**
 * Clear cached clients (useful on network switch)
 */
export function clearClientCache() {
  cachedClients.clear()
}

/**
 * Get account info using AlgoKit patterns
 */
export async function getAccountInfo(
  algodClient: algosdk.Algodv2,
  address: string
): Promise<{ balance: number; minBalance: number; totalApps: number }> {
  try {
    const info = await algodClient.accountInformation(address).do() as any
    return {
      balance: Number(info.amount ?? 0),
      minBalance: Number(info["min-balance"] ?? info.minBalance ?? 100_000),
      totalApps: Number(info["total-created-apps"] ?? info.totalCreatedApps ?? 0),
    }
  } catch {
    return { balance: 0, minBalance: 100_000, totalApps: 0 }
  }
}

/**
 * Verify an application exists on-chain
 */
export async function verifyApplication(
  algodClient: algosdk.Algodv2,
  appId: number
): Promise<{ exists: boolean; creator?: string; globalState?: Record<string, string | number> }> {
  try {
    const appInfo = await algodClient.getApplicationByID(appId).do() as any
    const globalState: Record<string, string | number> = {}

    const stateArray = appInfo.params?.globalState ?? appInfo.params?.["global-state"] ?? []
    if (Array.isArray(stateArray)) {
      for (const item of stateArray) {
        const key = atob(item.key)
        if (item.value.type === 1) {
          const bytes = Uint8Array.from(atob(item.value.bytes), c => c.charCodeAt(0))
          if (bytes.length === 32) {
            globalState[key] = String(algosdk.encodeAddress(bytes))
          } else {
            globalState[key] = item.value.bytes
          }
        } else {
          globalState[key] = Number(item.value.uint)
        }
      }
    }

    return {
      exists: true,
      creator: String(appInfo.params?.creator ?? ""),
      globalState,
    }
  } catch {
    return { exists: false }
  }
}

/**
 * Ensure minimum balance for a transaction
 */
export function validateTransactionPrereqs(
  balance: number,
  requiredAmount: number,
  minFee: number = 300_000 // 0.3 ALGO for MBR + fees
): { valid: boolean; message?: string } {
  if (balance <= 0) {
    return { valid: false, message: "Wallet has 0 ALGO. Fund your wallet first." }
  }
  const total = requiredAmount + minFee
  if (balance < total) {
    return {
      valid: false,
      message: `Insufficient balance. Need ~${(total / 1_000_000).toFixed(4)} ALGO, have ${(balance / 1_000_000).toFixed(4)} ALGO.`
    }
  }
  return { valid: true }
}

/**
 * Format a transaction note following ARC-2 convention
 */
export function createARC2Note(
  dappName: string,
  data: Record<string, unknown>
): Uint8Array {
  const note = `${dappName}:j${JSON.stringify(data)}`
  return new TextEncoder().encode(note)
}

/**
 * Create an ARC-3 compliant NFT receipt metadata
 */
export function createARC3Metadata(params: {
  appId: number
  amount: number
  recipient: string
  vaultType: string
  network: AlgorandNetwork
}) {
  return {
    standard: "arc3",
    name: `Payment Receipt #${params.appId}`,
    description: `Escrow vault payment receipt for ${params.amount} ALGO via ${params.vaultType} contract`,
    image: "",
    image_integrity: "",
    image_mimetype: "",
    properties: {
      app_id: params.appId,
      amount: params.amount,
      recipient: params.recipient,
      vault_type: params.vaultType,
      network: params.network,
      timestamp: new Date().toISOString(),
      platform: "Unsubscribely",
      standard: "ARC-3",
    },
  }
}
