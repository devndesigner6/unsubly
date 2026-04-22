/**
 * ARC-56-aware typed client surface for Unsubscribely's on-chain contracts.
 *
 * This module is the single source of truth for:
 *   - The list of deployed singleton contracts (from `deployed.json`)
 *   - The ARC-56 schema for each contract (imported as JSON)
 *   - A small typed view that the UI can render in `/api-docs` without
 *     having to repeatedly know how to parse ARC-56.
 *
 * We import the schemas as `unknown` and then narrow with the local
 * `Arc56Contract` type so a contract author can publish a richer schema
 * without breaking this file at compile time.
 */

import deployedRaw from "../../../smart_contracts/artifacts/deployed.json"

import agentEscrowV2Schema from "../../../smart_contracts/artifacts/AgentEscrowVaultV2/AgentEscrowVaultV2.arc56.json"
import escrowVaultSchema from "../../../smart_contracts/artifacts/EscrowVault/EscrowVault.arc56.json"
import serviceRegistrySchema from "../../../smart_contracts/artifacts/ServiceRegistry/ServiceRegistry.arc56.json"
import timeLockEscrowSchema from "../../../smart_contracts/artifacts/TimeLockEscrow/TimeLockEscrow.arc56.json"
import multiSigEscrowSchema from "../../../smart_contracts/artifacts/MultiSigEscrow/MultiSigEscrow.arc56.json"
import disputeEscrowSchema from "../../../smart_contracts/artifacts/DisputeEscrow/DisputeEscrow.arc56.json"
import asaEscrowSchema from "../../../smart_contracts/artifacts/ASAEscrow/ASAEscrow.arc56.json"

export interface Arc56Arg {
  name?: string
  type: string
  desc?: string
}
export interface Arc56Method {
  name: string
  desc?: string
  readonly?: boolean
  args: Arc56Arg[]
  returns: { type: string; struct?: string; desc?: string }
  actions?: { create?: string[]; call?: string[] }
}
export interface Arc56Contract {
  name: string
  desc?: string
  methods: Arc56Method[]
  structs?: Record<string, Array<{ name: string; type: string }>>
}

export interface DeployedSingleton {
  appId: number | null
  appAddress: string | null
  deployed_at?: string | null
  txid?: string | null
  lora_url?: string
}
interface DeployedFile {
  testnet: Record<string, DeployedSingleton>
  mainnet: Record<string, DeployedSingleton>
}
const deployed = deployedRaw as unknown as DeployedFile

export type ContractKey =
  | "ServiceRegistry"
  | "AgentEscrowVaultV2"
  | "EscrowVault"
  | "TimeLockEscrow"
  | "MultiSigEscrow"
  | "DisputeEscrow"
  | "ASAEscrow"

export interface ContractInfo {
  key: ContractKey
  schema: Arc56Contract
  /** Slug used in URLs and as a stable React key. */
  slug: string
  /** Short, human-readable description shown above the method table. */
  description: string
  /**
   * The deployed singleton key (in `deployed.json`), or null when the
   * contract is deployed per-user from the UI (so there is no singleton).
   */
  singletonKey: string | null
}

const SCHEMAS: Record<ContractKey, Arc56Contract> = {
  ServiceRegistry: serviceRegistrySchema as unknown as Arc56Contract,
  AgentEscrowVaultV2: agentEscrowV2Schema as unknown as Arc56Contract,
  EscrowVault: escrowVaultSchema as unknown as Arc56Contract,
  TimeLockEscrow: timeLockEscrowSchema as unknown as Arc56Contract,
  MultiSigEscrow: multiSigEscrowSchema as unknown as Arc56Contract,
  DisputeEscrow: disputeEscrowSchema as unknown as Arc56Contract,
  ASAEscrow: asaEscrowSchema as unknown as Arc56Contract,
}

export const CONTRACTS: ContractInfo[] = [
  {
    key: "ServiceRegistry",
    schema: SCHEMAS.ServiceRegistry,
    slug: "service-registry",
    singletonKey: "ServiceRegistry",
    description:
      "On-chain A2A discovery registry. Providers publish their service ID, name, price and billing cycle into Box Storage so any agent can resolve a service by ID without a centralized database.",
  },
  {
    key: "AgentEscrowVaultV2",
    schema: SCHEMAS.AgentEscrowVaultV2,
    slug: "agent-escrow-v2",
    singletonKey: "AgentEscrowVaultV2_template",
    description:
      "Per-user autonomous escrow vault that releases funds to the recipient on a schedule managed by an off-chain agent. Every release is appended to an on-chain billing history (BoxMap) for an immutable audit trail.",
  },
  {
    key: "EscrowVault",
    schema: SCHEMAS.EscrowVault,
    slug: "escrow-vault",
    singletonKey: null,
    description:
      "Standard escrow vault: the creator funds it, only the creator can release the agreed amount to the recipient, and any leftover balance can be killed back to the creator.",
  },
  {
    key: "TimeLockEscrow",
    schema: SCHEMAS.TimeLockEscrow,
    slug: "time-locked",
    singletonKey: null,
    description:
      "Funds are locked until a specific Unix timestamp. Useful for guaranteed delivery windows and trial-period guardrails, the agent literally cannot pay the merchant before the lock expires.",
  },
  {
    key: "MultiSigEscrow",
    schema: SCHEMAS.MultiSigEscrow,
    slug: "multi-sig",
    singletonKey: null,
    description:
      "2-of-2 escrow: both the creator and the configured co-signer must call `approve` before funds move. Suitable for high-value subscriptions or shared budgets.",
  },
  {
    key: "DisputeEscrow",
    schema: SCHEMAS.DisputeEscrow,
    slug: "dispute",
    singletonKey: null,
    description:
      "Escrow with a third-party arbitrator. Either the creator releases normally, or the named arbitrator can step in to release/kill on behalf of either party when there is a dispute.",
  },
  {
    key: "ASAEscrow",
    schema: SCHEMAS.ASAEscrow,
    slug: "asa-escrow",
    singletonKey: null,
    description:
      "Escrow vault that holds an Algorand Standard Asset (ASA) instead of ALGO, used for stablecoin or token-denominated subscriptions.",
  },
]

/**
 * Returns the deployed singleton info for the given network, or null.
 * Pass the network from `useAlgorand().network` so this stays reactive
 * when the user toggles testnet ↔ mainnet at runtime.
 */
export function getDeployment(
  c: ContractInfo,
  network: "testnet" | "mainnet",
): DeployedSingleton | null {
  if (!c.singletonKey) return null
  return deployed[network]?.[c.singletonKey] ?? null
}

/** True when the schema describes a method that does not modify state. */
export function isReadonly(m: Arc56Method): boolean {
  return Boolean(m.readonly)
}

/** Render a method signature in canonical ARC-4 form, e.g. `release(uint64)uint64`. */
export function methodSignature(m: Arc56Method): string {
  const args = m.args.map((a) => a.type).join(",")
  return `${m.name}(${args})${m.returns.type}`
}

