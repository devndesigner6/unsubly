"""
Deploy all 5 Unsubscribely escrow vault contracts to Algorand Testnet.

Usage:
    python scripts/deploy.py

Required environment variables (.env file):
    TESTNET_MNEMONIC   — 25-word mnemonic of the deployer account (must be funded)
    ALGOD_URL          — (optional) defaults to https://testnet-api.algonode.cloud
    ALGOD_TOKEN        — (optional) defaults to empty string for AlgoNode public API
"""

import os
import json
import sys
from pathlib import Path

import algosdk
from algosdk.v2client import algod
from algosdk import transaction, account, encoding, logic
from dotenv import load_dotenv

load_dotenv()

ALGOD_URL = os.getenv("ALGOD_URL", "https://testnet-api.algonode.cloud")
ALGOD_TOKEN = os.getenv("ALGOD_TOKEN", "")
TESTNET_MNEMONIC = os.getenv("TESTNET_MNEMONIC", "")

ARTIFACTS_DIR = Path(__file__).parent.parent / "smart_contracts" / "artifacts"
DEPLOYMENT_RESULTS_FILE = Path(__file__).parent.parent / "smart_contracts" / "artifacts" / "deployed.json"

CONTRACT_CONFIGS = [
    {
        "name": "EscrowVault",
        "global_schema": transaction.StateSchema(num_uints=1, num_byte_slices=2),
        "local_schema": transaction.StateSchema(0, 0),
        "description": "Standard Escrow Vault",
    },
    {
        "name": "TimeLockEscrow",
        "global_schema": transaction.StateSchema(num_uints=2, num_byte_slices=2),
        "local_schema": transaction.StateSchema(0, 0),
        "description": "Time-Locked Escrow Vault",
    },
    {
        "name": "MultiSigEscrow",
        "global_schema": transaction.StateSchema(num_uints=3, num_byte_slices=3),
        "local_schema": transaction.StateSchema(0, 0),
        "description": "Multi-Signature Escrow Vault",
    },
    {
        "name": "DisputeEscrow",
        "global_schema": transaction.StateSchema(num_uints=1, num_byte_slices=3),
        "local_schema": transaction.StateSchema(0, 0),
        "description": "Dispute-Resolution Escrow Vault",
    },
    {
        "name": "ASAEscrow",
        "global_schema": transaction.StateSchema(num_uints=2, num_byte_slices=2),
        "local_schema": transaction.StateSchema(0, 0),
        "description": "ASA Token Escrow Vault",
    },
]


def get_algod_client() -> algod.AlgodClient:
    return algod.AlgodClient(ALGOD_TOKEN, ALGOD_URL)


def load_teal(contract_name: str, kind: str) -> bytes:
    """Load compiled TEAL bytes from artifacts directory.
    Supports both naming conventions: '{kind}.teal' and '{name}.{kind}.teal'
    """
    candidates = [
        ARTIFACTS_DIR / contract_name / f"{contract_name}.{kind}.teal",
        ARTIFACTS_DIR / contract_name / f"{kind}.teal",
    ]
    for path in candidates:
        if path.exists():
            return path.read_bytes()
    raise FileNotFoundError(
        f"TEAL file not found. Tried:\n" +
        "\n".join(f"  {p}" for p in candidates) +
        "\nRun 'algokit compile python smart_contracts/' to generate artifacts."
    )


def compile_teal(algod_client: algod.AlgodClient, teal_source: bytes) -> bytes:
    """Compile TEAL source to binary via algod."""
    result = algod_client.compile(teal_source.decode())
    import base64
    return base64.b64decode(result["result"])


def deploy_contract(
    algod_client: algod.AlgodClient,
    creator_address: str,
    creator_private_key: str,
    approval_program: bytes,
    clear_program: bytes,
    global_schema: transaction.StateSchema,
    local_schema: transaction.StateSchema,
) -> int:
    """Deploy an application and return its app ID."""
    params = algod_client.suggested_params()

    txn = transaction.ApplicationCreateTxn(
        sender=creator_address,
        sp=params,
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=approval_program,
        clear_program=clear_program,
        global_schema=global_schema,
        local_schema=local_schema,
    )

    signed = txn.sign(creator_private_key)
    tx_id = algod_client.send_transaction(signed)
    print(f"    Transaction ID: {tx_id}")

    result = transaction.wait_for_confirmation(algod_client, tx_id, 4)
    return result["application-index"]


def main():
    if not TESTNET_MNEMONIC:
        print("ERROR: TESTNET_MNEMONIC environment variable is not set.")
        print("Create a .env file with your 25-word mnemonic:")
        print('  TESTNET_MNEMONIC="word1 word2 ... word25"')
        sys.exit(1)

    private_key = algosdk.mnemonic.to_private_key(TESTNET_MNEMONIC)
    deployer_address = account.address_from_private_key(private_key)

    client = get_algod_client()

    account_info = client.account_info(deployer_address)
    balance_algo = account_info.get("amount", 0) / 1_000_000
    print(f"Deployer: {deployer_address}")
    print(f"Balance:  {balance_algo:.6f} ALGO")
    print(f"Network:  {ALGOD_URL}")
    print("=" * 60)

    if balance_algo < 1.0:
        print("WARNING: Low balance. Fund via https://bank.testnet.algorand.network/")

    deployed = {}

    for config in CONTRACT_CONFIGS:
        name = config["name"]
        print(f"\nDeploying {name} ({config['description']})...")

        try:
            approval_teal = load_teal(name, "approval")
            clear_teal = load_teal(name, "clear")

            approval_binary = compile_teal(client, approval_teal)
            clear_binary = compile_teal(client, clear_teal)

            app_id = deploy_contract(
                client,
                deployer_address,
                private_key,
                approval_binary,
                clear_binary,
                config["global_schema"],
                config["local_schema"],
            )

            app_address = logic.get_application_address(app_id)

            deployed[name] = {
                "app_id": app_id,
                "app_address": app_address,
                "network": ALGOD_URL,
                "deployer": deployer_address,
            }

            print(f"    App ID:      {app_id}")
            print(f"    App Address: {app_address}")

        except FileNotFoundError as e:
            print(f"    SKIPPED — {e}")
            deployed[name] = {"error": str(e)}
        except Exception as e:
            print(f"    FAILED — {e}")
            deployed[name] = {"error": str(e)}

    print("\n" + "=" * 60)
    print("Deployment Summary:")
    for name, info in deployed.items():
        if "app_id" in info:
            print(f"  {name}: App ID {info['app_id']} @ {info['app_address']}")
        else:
            print(f"  {name}: {info.get('error', 'unknown error')}")

    DEPLOYMENT_RESULTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DEPLOYMENT_RESULTS_FILE, "w") as f:
        json.dump(deployed, f, indent=2)

    print(f"\nDeployment results saved to: {DEPLOYMENT_RESULTS_FILE}")


if __name__ == "__main__":
    main()
