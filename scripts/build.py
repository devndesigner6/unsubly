"""
Build all 5 Unsubscribely smart contracts using AlgoKit.

This script:
  1. Compiles each Algorand Python contract to TEAL via `algokit compile python`
  2. Outputs approval.teal, clear.teal, and application.json to smart_contracts/artifacts/<ContractName>/
  3. Generates TypeScript ABI clients to frontend_integration/clients/

Usage:
    python scripts/build.py
    # or via algokit:
    algokit project run build
"""

import subprocess
import sys
import os
from pathlib import Path

ROOT = Path(__file__).parent.parent
CONTRACTS_DIR = ROOT / "smart_contracts"
ARTIFACTS_DIR = CONTRACTS_DIR / "artifacts"
CLIENTS_DIR = ROOT / "frontend_integration" / "clients"

CONTRACT_MODULES = [
    ("escrow",        "EscrowVault"),
    ("agent_escrow",  "AgentEscrowVault"),
    ("time_locked",   "TimeLockEscrow"),
    ("multi_sig",     "MultiSigEscrow"),
    ("dispute",       "DisputeEscrow"),
    ("asa_escrow",    "ASAEscrow"),
]


def run(cmd: list[str], cwd: Path = ROOT) -> int:
    """Run a command and return exit code."""
    print(f"  $ {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=str(cwd))
    return result.returncode


def compile_contracts() -> bool:
    """Compile all contracts using algokit compile python."""
    print("\n[1/2] Compiling Algorand Python contracts...")
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    success = True
    for module, class_name in CONTRACT_MODULES:
        contract_file = CONTRACTS_DIR / module / "contract.py"
        out_dir = ARTIFACTS_DIR / class_name
        out_dir.mkdir(parents=True, exist_ok=True)

        print(f"\n  Compiling {class_name} from {contract_file.relative_to(ROOT)}...")
        code = run(
            [
                "algokit",
                "compile",
                "python",
                str(contract_file),
                "--out-dir",
                str(out_dir),
            ]
        )

        if code != 0:
            print(f"  WARNING: Compilation failed for {class_name} (exit code {code})")
            success = False
        else:
            print(f"  OK — artifacts written to {out_dir.relative_to(ROOT)}")

    return success


def generate_ts_clients() -> bool:
    """Generate TypeScript ABI clients from ARC-32 app specs."""
    print("\n[2/2] Generating TypeScript clients...")
    CLIENTS_DIR.mkdir(parents=True, exist_ok=True)

    success = True
    for _, class_name in CONTRACT_MODULES:
        spec_file = ARTIFACTS_DIR / class_name / "application.json"
        if not spec_file.exists():
            print(f"  SKIPPED {class_name} — application.json not found (compile first)")
            continue

        out_file = CLIENTS_DIR / f"{class_name}Client.ts"
        print(f"  Generating {out_file.name}...")
        code = run(
            [
                "algokit",
                "generate",
                "client",
                str(spec_file),
                "--output",
                str(out_file),
                "--language",
                "typescript",
            ]
        )

        if code != 0:
            print(f"  WARNING: Client generation failed for {class_name} (exit code {code})")
            success = False
        else:
            print(f"  OK — {out_file.relative_to(ROOT)}")

    return success


def main():
    print("Unsubscribely — AlgoKit Build Pipeline")
    print("=" * 50)

    compiled_ok = compile_contracts()
    clients_ok = generate_ts_clients()

    print("\n" + "=" * 50)
    if compiled_ok and clients_ok:
        print("Build completed successfully.")
        print(f"  Artifacts: {ARTIFACTS_DIR.relative_to(ROOT)}/")
        print(f"  TS Clients: {CLIENTS_DIR.relative_to(ROOT)}/")
    elif compiled_ok:
        print("Build completed with warnings (TypeScript client generation failed).")
    else:
        print("Build completed with errors. Check output above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
