export type AlgorandNetwork = "testnet" | "mainnet"

// Allow overriding via env (paid Nodely / self-hosted node), falls back to public algonode.
const ENV_TESTNET_ALGOD = import.meta.env.VITE_ALGOD_TESTNET_URL as string | undefined
const ENV_MAINNET_ALGOD = import.meta.env.VITE_ALGOD_MAINNET_URL as string | undefined
const ENV_TESTNET_INDEXER = import.meta.env.VITE_INDEXER_TESTNET_URL as string | undefined
const ENV_MAINNET_INDEXER = import.meta.env.VITE_INDEXER_MAINNET_URL as string | undefined
const ENV_ALGOD_TOKEN = (import.meta.env.VITE_ALGOD_TOKEN as string | undefined) ?? ""

export const ALGORAND_TESTNET = {
  algodToken: ENV_ALGOD_TOKEN,
  algodServer: ENV_TESTNET_ALGOD || "https://testnet-api.algonode.cloud",
  algodPort: 443,
  indexerServer: ENV_TESTNET_INDEXER || "https://testnet-idx.algonode.cloud",
  indexerPort: 443,
  network: "testnet" as const,
}

export const ALGORAND_MAINNET = {
  algodToken: ENV_ALGOD_TOKEN,
  algodServer: ENV_MAINNET_ALGOD || "https://mainnet-api.algonode.cloud",
  algodPort: 443,
  indexerServer: ENV_MAINNET_INDEXER || "https://mainnet-idx.algonode.cloud",
  indexerPort: 443,
  network: "mainnet" as const,
}

export const MIN_BALANCE_MICROALGOS = 100_000
export const MICROALGOS_PER_ALGO = 1_000_000

// USDCa (USDC on Algorand) asset IDs, the same on testnet faucets / mainnet.
export const USDCA_ASSET_ID: Record<AlgorandNetwork, number> = {
  testnet: 10458941,   // USDC testnet ASA
  mainnet: 31566704,   // USDC mainnet ASA
}

export function getNetworkConfig(network: AlgorandNetwork) {
  return network === "mainnet" ? ALGORAND_MAINNET : ALGORAND_TESTNET
}

export function getStoredNetwork(): AlgorandNetwork {
  return (localStorage.getItem("algorand_network") as AlgorandNetwork) || "testnet"
}

export function setStoredNetwork(network: AlgorandNetwork) {
  localStorage.setItem("algorand_network", network)
}

export function microalgosToAlgo(microalgos: number): number {
  return microalgos / MICROALGOS_PER_ALGO
}

export function algoToMicroalgos(algo: number): number {
  return Math.round(algo * MICROALGOS_PER_ALGO)
}

export function shortenAddress(address: string, chars = 6): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

// ── Legacy aliases, now all point to Lora ────────────────────────────────
export function getAlgoExplorerUrl(txnId: string, network: AlgorandNetwork = "testnet"): string {
  return `https://lora.algokit.io/${network}/transaction/${txnId}`
}

export function getAddressExplorerUrl(address: string, network: AlgorandNetwork = "testnet"): string {
  return `https://lora.algokit.io/${network}/account/${address}`
}

// ── Lora Explorer (AlgoKit official) ──────────────────────────────────────
export function getLoraTransactionUrl(txnId: string, network: AlgorandNetwork = "testnet"): string {
  return `https://lora.algokit.io/${network}/transaction/${txnId}`
}

export function getLoraApplicationUrl(appId: number, network: AlgorandNetwork = "testnet"): string {
  return `https://lora.algokit.io/${network}/application/${appId}`
}

export function getLoraAddressUrl(address: string, network: AlgorandNetwork = "testnet"): string {
  return `https://lora.algokit.io/${network}/account/${address}`
}

export type VaultType = "standard" | "agent" | "agent_v2" | "time_locked" | "multi_sig" | "dispute" | "asa" | "cancellation_insurance"

export const VAULT_TYPE_LABELS: Record<VaultType, string> = {
  standard:                 "Standard",
  agent:                    "Agent-Managed",
  agent_v2:                 "Agent-Managed v2",
  time_locked:              "Time-Locked",
  multi_sig:                "Multi-Sig",
  dispute:                  "Dispute Escrow",
  asa:                      "ASA Token",
  cancellation_insurance:   "Cancel Insurance",
}
