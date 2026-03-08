export type AlgorandNetwork = "testnet" | "mainnet"

export const ALGORAND_TESTNET = {
  algodToken: "",
  algodServer: "https://testnet-api.algonode.cloud",
  algodPort: 443,
  indexerServer: "https://testnet-idx.algonode.cloud",
  indexerPort: 443,
  network: "testnet" as const,
}

export const ALGORAND_MAINNET = {
  algodToken: "",
  algodServer: "https://mainnet-api.algonode.cloud",
  algodPort: 443,
  indexerServer: "https://mainnet-idx.algonode.cloud",
  indexerPort: 443,
  network: "mainnet" as const,
}

export const MIN_BALANCE_MICROALGOS = 100_000
export const MICROALGOS_PER_ALGO = 1_000_000

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

export function getAlgoExplorerUrl(txnId: string, network: AlgorandNetwork = "testnet"): string {
  const prefix = network === "mainnet" ? "" : "testnet."
  return `https://${prefix}explorer.perawallet.app/tx/${txnId}`
}

export function getAddressExplorerUrl(address: string, network: AlgorandNetwork = "testnet"): string {
  const prefix = network === "mainnet" ? "" : "testnet."
  return `https://${prefix}explorer.perawallet.app/address/${address}`
}

export type VaultType = "standard" | "time_locked" | "multi_sig" | "dispute" | "asa"

export const VAULT_TYPE_LABELS: Record<VaultType, string> = {
  standard: "Standard",
  time_locked: "Time-Locked",
  multi_sig: "Multi-Sig",
  dispute: "Dispute Escrow",
  asa: "ASA Token",
}
