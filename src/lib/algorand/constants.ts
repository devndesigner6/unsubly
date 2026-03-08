// Algorand Testnet configuration
export const ALGORAND_TESTNET = {
  algodToken: '',
  algodServer: 'https://testnet-api.algonode.cloud',
  algodPort: 443,
  indexerServer: 'https://testnet-idx.algonode.cloud',
  indexerPort: 443,
  network: 'testnet' as const,
}

// Minimum balance for Algorand accounts (0.1 ALGO)
export const MIN_BALANCE_MICROALGOS = 100_000

// Microalgos per ALGO
export const MICROALGOS_PER_ALGO = 1_000_000

export function microalgosToAlgo(microalgos: number): number {
  return microalgos / MICROALGOS_PER_ALGO
}

export function algoToMicroalgos(algo: number): number {
  return Math.round(algo * MICROALGOS_PER_ALGO)
}

export function shortenAddress(address: string, chars = 6): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

export function getAlgoExplorerUrl(txnId: string): string {
  return `https://testnet.explorer.perawallet.app/tx/${txnId}`
}

export function getAddressExplorerUrl(address: string): string {
  return `https://testnet.explorer.perawallet.app/address/${address}`
}
