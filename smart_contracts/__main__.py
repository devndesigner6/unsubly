"""
AlgoKit project entry point.

Usage:
    algokit project run build
    python -m smart_contracts
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
ARTIFACTS = ROOT / "artifacts"

CONTRACTS = [
    "escrow",
    "agent_escrow",
    "agent_escrow_v2",
    "time_locked",
    "multi_sig",
    "dispute",
    "asa_escrow",
    "service_registry",
    "cancellation_insurance",
]


def build():
    """Compile all contracts using algokit."""
    print("Compiling Unsubscribely smart contracts...")
    ARTIFACTS.mkdir(parents=True, exist_ok=True)

    for contract in CONTRACTS:
        source = ROOT / contract / "contract.py"
        if not source.exists():
            print(f"  SKIP {contract} (no contract.py)")
            continue

        print(f"  Compiling {contract}...")
        result = subprocess.run(
            ["algokit", "compile", "python", str(source), "--out-dir", str(ARTIFACTS)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"    ERROR: {result.stderr.strip()}")
        else:
            print(f"    OK")

    print("\nDone. Artifacts in smart_contracts/artifacts/")


if __name__ == "__main__":
    build()
