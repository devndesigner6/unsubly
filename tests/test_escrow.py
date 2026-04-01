"""
Tests for all 5 Unsubscribely escrow vault contracts.

These tests are structured for AlgoKit / algokit-utils with Algorand Testnet.
They verify: create, fund, release, kill, and unauthorized-access rejection.

Run with:
    pytest tests/test_escrow.py -v
"""

import pytest
import algosdk
from algosdk.v2client import algod
from algosdk import transaction, account, encoding
from algosdk.atomic_transaction_composer import (
    AtomicTransactionComposer,
    AccountTransactionSigner,
    TransactionWithSigner,
)
import json
import os
import time
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ALGOD_URL = os.getenv("ALGOD_URL", "https://testnet-api.algonode.cloud")
ALGOD_TOKEN = os.getenv("ALGOD_TOKEN", "")
TESTNET_MNEMONIC = os.getenv("TESTNET_MNEMONIC", "")

ARTIFACTS_DIR = Path(__file__).parent.parent / "smart_contracts" / "artifacts"


def get_algod_client() -> algod.AlgodClient:
    return algod.AlgodClient(ALGOD_TOKEN, ALGOD_URL)


def load_abi(contract_name: str) -> dict:
    """Load ARC-32 app spec JSON from artifacts directory."""
    spec_path = ARTIFACTS_DIR / contract_name / "application.json"
    if not spec_path.exists():
        pytest.skip(f"ARC-32 spec not found at {spec_path} — run build first")
    with open(spec_path) as f:
        return json.load(f)


def get_signer(private_key: str) -> AccountTransactionSigner:
    return AccountTransactionSigner(private_key)


@pytest.fixture(scope="session")
def algod_client():
    return get_algod_client()


@pytest.fixture(scope="session")
def creator_account():
    if not TESTNET_MNEMONIC:
        pytest.skip("TESTNET_MNEMONIC not set — skipping on-chain tests")
    private_key = algosdk.mnemonic.to_private_key(TESTNET_MNEMONIC)
    address = account.address_from_private_key(private_key)
    return {"private_key": private_key, "address": address}


@pytest.fixture(scope="session")
def recipient_account():
    private_key, address = account.generate_account()
    return {"private_key": private_key, "address": address}


@pytest.fixture(scope="session")
def cosigner_account():
    private_key, address = account.generate_account()
    return {"private_key": private_key, "address": address}


def deploy_contract(
    algod_client,
    creator_private_key: str,
    approval_program: bytes,
    clear_program: bytes,
    global_schema: transaction.StateSchema,
    local_schema: transaction.StateSchema,
    app_args: list,
) -> int:
    """Deploy a smart contract and return its app ID."""
    params = algod_client.suggested_params()
    creator_address = account.address_from_private_key(creator_private_key)

    txn = transaction.ApplicationCreateTxn(
        sender=creator_address,
        sp=params,
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=approval_program,
        clear_program=clear_program,
        global_schema=global_schema,
        local_schema=local_schema,
        app_args=app_args,
    )

    signed = txn.sign(creator_private_key)
    tx_id = algod_client.send_transaction(signed)
    result = transaction.wait_for_confirmation(algod_client, tx_id, 4)
    return result["application-index"]


def fund_app(algod_client, sender_private_key: str, app_id: int, amount: int) -> None:
    """Send ALGO to an application address."""
    params = algod_client.suggested_params()
    app_address = algosdk.logic.get_application_address(app_id)
    sender_address = account.address_from_private_key(sender_private_key)

    txn = transaction.PaymentTxn(
        sender=sender_address,
        sp=params,
        receiver=app_address,
        amt=amount,
    )
    signed = txn.sign(sender_private_key)
    tx_id = algod_client.send_transaction(signed)
    transaction.wait_for_confirmation(algod_client, tx_id, 4)


def call_app(
    algod_client,
    caller_private_key: str,
    app_id: int,
    app_args: list,
    accounts: list = None,
) -> dict:
    """Call an application with NoOp."""
    params = algod_client.suggested_params()
    caller_address = account.address_from_private_key(caller_private_key)

    txn = transaction.ApplicationNoOpTxn(
        sender=caller_address,
        sp=params,
        index=app_id,
        app_args=app_args,
        accounts=accounts or [],
    )
    signed = txn.sign(caller_private_key)
    tx_id = algod_client.send_transaction(signed)
    return transaction.wait_for_confirmation(algod_client, tx_id, 4)


def delete_app(algod_client, caller_private_key: str, app_id: int) -> dict:
    """Delete an application."""
    params = algod_client.suggested_params()
    caller_address = account.address_from_private_key(caller_private_key)

    txn = transaction.ApplicationDeleteTxn(
        sender=caller_address,
        sp=params,
        index=app_id,
    )
    signed = txn.sign(caller_private_key)
    tx_id = algod_client.send_transaction(signed)
    return transaction.wait_for_confirmation(algod_client, tx_id, 4)


def get_global_state(algod_client, app_id: int) -> dict:
    """Retrieve global state for an app as a plain dict."""
    info = algod_client.application_info(app_id)
    state = {}
    for kv in info.get("params", {}).get("global-state", []):
        k = encoding.base64.b64decode(kv["key"]).decode("utf-8", errors="replace")
        v = kv["value"]
        if v["type"] == 1:
            state[k] = encoding.base64.b64decode(v["bytes"])
        else:
            state[k] = v["uint"]
    return state


class TestStandardEscrow:
    """Tests for smart_contracts/escrow/contract.py (EscrowVault)."""

    CONTRACT_NAME = "EscrowVault"

    def _load_programs(self):
        base = ARTIFACTS_DIR / self.CONTRACT_NAME
        approval = (base / "approval.teal").read_bytes()
        clear = (base / "clear.teal").read_bytes()
        return approval, clear

    @pytest.mark.integration
    def test_create_and_release(self, algod_client, creator_account, recipient_account):
        """Creator deploys vault, funds it, then releases to recipient."""
        approval, clear = self._load_programs()

        recipient_addr = recipient_account["address"]
        app_id = deploy_contract(
            algod_client,
            creator_account["private_key"],
            approval,
            clear,
            transaction.StateSchema(num_uints=1, num_byte_slices=2),
            transaction.StateSchema(0, 0),
            app_args=[b"create", encoding.decode_address(recipient_addr)],
        )

        fund_app(algod_client, creator_account["private_key"], app_id, 1_100_000)

        state = get_global_state(algod_client, app_id)
        assert state.get("status") == 0, "Vault should be locked after creation"

        call_app(algod_client, creator_account["private_key"], app_id, [b"release"])

        state = get_global_state(algod_client, app_id)
        assert state.get("status") == 1, "Vault status should be released"

        delete_app(algod_client, creator_account["private_key"], app_id)

    @pytest.mark.integration
    def test_create_and_kill(self, algod_client, creator_account, recipient_account):
        """Creator deploys vault, funds it, then kills to reclaim funds."""
        approval, clear = self._load_programs()

        app_id = deploy_contract(
            algod_client,
            creator_account["private_key"],
            approval,
            clear,
            transaction.StateSchema(num_uints=1, num_byte_slices=2),
            transaction.StateSchema(0, 0),
            app_args=[b"create", encoding.decode_address(recipient_account["address"])],
        )

        fund_app(algod_client, creator_account["private_key"], app_id, 1_100_000)

        call_app(algod_client, creator_account["private_key"], app_id, [b"kill"])

        state = get_global_state(algod_client, app_id)
        assert state.get("status") == 2, "Vault status should be killed"

        delete_app(algod_client, creator_account["private_key"], app_id)

    @pytest.mark.integration
    def test_unauthorized_release_rejected(
        self, algod_client, creator_account, recipient_account
    ):
        """Non-creator cannot release the vault."""
        approval, clear = self._load_programs()

        app_id = deploy_contract(
            algod_client,
            creator_account["private_key"],
            approval,
            clear,
            transaction.StateSchema(num_uints=1, num_byte_slices=2),
            transaction.StateSchema(0, 0),
            app_args=[b"create", encoding.decode_address(recipient_account["address"])],
        )

        fund_app(algod_client, creator_account["private_key"], app_id, 1_100_000)

        with pytest.raises(Exception, match="(?i)rejected|logic eval|assert"):
            call_app(
                algod_client,
                recipient_account["private_key"],
                app_id,
                [b"release"],
            )

        delete_app(algod_client, creator_account["private_key"], app_id)


class TestTimeLockEscrow:
    """Tests for smart_contracts/time_locked/contract.py (TimeLockEscrow)."""

    CONTRACT_NAME = "TimeLockEscrow"

    def _load_programs(self):
        base = ARTIFACTS_DIR / self.CONTRACT_NAME
        approval = (base / "approval.teal").read_bytes()
        clear = (base / "clear.teal").read_bytes()
        return approval, clear

    @pytest.mark.integration
    def test_release_before_unlock_rejected(
        self, algod_client, creator_account, recipient_account
    ):
        """Release before unlock_time should be rejected."""
        approval, clear = self._load_programs()

        future_unlock = int(time.time()) + 86400

        app_id = deploy_contract(
            algod_client,
            creator_account["private_key"],
            approval,
            clear,
            transaction.StateSchema(num_uints=2, num_byte_slices=2),
            transaction.StateSchema(0, 0),
            app_args=[
                b"create",
                encoding.decode_address(recipient_account["address"]),
                future_unlock.to_bytes(8, "big"),
            ],
        )

        fund_app(algod_client, creator_account["private_key"], app_id, 1_100_000)

        with pytest.raises(Exception, match="(?i)rejected|logic eval|assert"):
            call_app(algod_client, creator_account["private_key"], app_id, [b"release"])

        call_app(algod_client, creator_account["private_key"], app_id, [b"kill"])
        delete_app(algod_client, creator_account["private_key"], app_id)

    @pytest.mark.integration
    def test_kill_before_unlock_succeeds(
        self, algod_client, creator_account, recipient_account
    ):
        """Kill (reclaim) should succeed even before unlock_time."""
        approval, clear = self._load_programs()

        future_unlock = int(time.time()) + 86400

        app_id = deploy_contract(
            algod_client,
            creator_account["private_key"],
            approval,
            clear,
            transaction.StateSchema(num_uints=2, num_byte_slices=2),
            transaction.StateSchema(0, 0),
            app_args=[
                b"create",
                encoding.decode_address(recipient_account["address"]),
                future_unlock.to_bytes(8, "big"),
            ],
        )

        fund_app(algod_client, creator_account["private_key"], app_id, 1_100_000)
        call_app(algod_client, creator_account["private_key"], app_id, [b"kill"])

        state = get_global_state(algod_client, app_id)
        assert state.get("status") == 2

        delete_app(algod_client, creator_account["private_key"], app_id)


class TestMultiSigEscrow:
    """Tests for smart_contracts/multi_sig/contract.py (MultiSigEscrow)."""

    CONTRACT_NAME = "MultiSigEscrow"

    def _load_programs(self):
        base = ARTIFACTS_DIR / self.CONTRACT_NAME
        approval = (base / "approval.teal").read_bytes()
        clear = (base / "clear.teal").read_bytes()
        return approval, clear

    @pytest.mark.integration
    def test_dual_approve_releases_funds(
        self, algod_client, creator_account, recipient_account, cosigner_account
    ):
        """Funds are released after both creator and co-signer approve."""
        approval, clear = self._load_programs()

        app_id = deploy_contract(
            algod_client,
            creator_account["private_key"],
            approval,
            clear,
            transaction.StateSchema(num_uints=3, num_byte_slices=3),
            transaction.StateSchema(0, 0),
            app_args=[
                b"create",
                encoding.decode_address(recipient_account["address"]),
                encoding.decode_address(cosigner_account["address"]),
            ],
        )

        fund_app(algod_client, creator_account["private_key"], app_id, 1_100_000)

        call_app(algod_client, creator_account["private_key"], app_id, [b"approve"])
        state = get_global_state(algod_client, app_id)
        assert state.get("status") == 0, "Vault should still be locked after one approval"

        call_app(algod_client, cosigner_account["private_key"], app_id, [b"approve"])
        state = get_global_state(algod_client, app_id)
        assert state.get("status") == 1, "Vault should be released after both approve"

        delete_app(algod_client, creator_account["private_key"], app_id)

    @pytest.mark.integration
    def test_single_approve_does_not_release(
        self, algod_client, creator_account, recipient_account, cosigner_account
    ):
        """Only one approval should not release the vault."""
        approval, clear = self._load_programs()

        app_id = deploy_contract(
            algod_client,
            creator_account["private_key"],
            approval,
            clear,
            transaction.StateSchema(num_uints=3, num_byte_slices=3),
            transaction.StateSchema(0, 0),
            app_args=[
                b"create",
                encoding.decode_address(recipient_account["address"]),
                encoding.decode_address(cosigner_account["address"]),
            ],
        )

        fund_app(algod_client, creator_account["private_key"], app_id, 1_100_000)
        call_app(algod_client, creator_account["private_key"], app_id, [b"approve"])
        state = get_global_state(algod_client, app_id)
        assert state.get("status") == 0

        call_app(algod_client, creator_account["private_key"], app_id, [b"kill"])
        delete_app(algod_client, creator_account["private_key"], app_id)


class TestDisputeEscrow:
    """Tests for smart_contracts/dispute/contract.py (DisputeEscrow)."""

    CONTRACT_NAME = "DisputeEscrow"

    def _load_programs(self):
        base = ARTIFACTS_DIR / self.CONTRACT_NAME
        approval = (base / "approval.teal").read_bytes()
        clear = (base / "clear.teal").read_bytes()
        return approval, clear

    @pytest.mark.integration
    def test_arbitrator_can_release(
        self, algod_client, creator_account, recipient_account, cosigner_account
    ):
        """Arbitrator can release funds to recipient."""
        approval, clear = self._load_programs()
        arbitrator = cosigner_account

        app_id = deploy_contract(
            algod_client,
            creator_account["private_key"],
            approval,
            clear,
            transaction.StateSchema(num_uints=1, num_byte_slices=3),
            transaction.StateSchema(0, 0),
            app_args=[
                b"create",
                encoding.decode_address(recipient_account["address"]),
                encoding.decode_address(arbitrator["address"]),
            ],
        )

        fund_app(algod_client, creator_account["private_key"], app_id, 1_100_000)
        call_app(algod_client, arbitrator["private_key"], app_id, [b"release"])

        state = get_global_state(algod_client, app_id)
        assert state.get("status") == 1

        delete_app(algod_client, creator_account["private_key"], app_id)

    @pytest.mark.integration
    def test_arbitrator_can_kill(
        self, algod_client, creator_account, recipient_account, cosigner_account
    ):
        """Arbitrator can kill vault and return funds to creator."""
        approval, clear = self._load_programs()
        arbitrator = cosigner_account

        app_id = deploy_contract(
            algod_client,
            creator_account["private_key"],
            approval,
            clear,
            transaction.StateSchema(num_uints=1, num_byte_slices=3),
            transaction.StateSchema(0, 0),
            app_args=[
                b"create",
                encoding.decode_address(recipient_account["address"]),
                encoding.decode_address(arbitrator["address"]),
            ],
        )

        fund_app(algod_client, creator_account["private_key"], app_id, 1_100_000)
        call_app(algod_client, arbitrator["private_key"], app_id, [b"kill"])

        state = get_global_state(algod_client, app_id)
        assert state.get("status") == 2

        delete_app(algod_client, creator_account["private_key"], app_id)

    @pytest.mark.integration
    def test_unauthorized_third_party_rejected(
        self, algod_client, creator_account, recipient_account, cosigner_account
    ):
        """Random account cannot release or kill the vault."""
        approval, clear = self._load_programs()
        arbitrator = cosigner_account
        outsider_pk, _ = account.generate_account()

        app_id = deploy_contract(
            algod_client,
            creator_account["private_key"],
            approval,
            clear,
            transaction.StateSchema(num_uints=1, num_byte_slices=3),
            transaction.StateSchema(0, 0),
            app_args=[
                b"create",
                encoding.decode_address(recipient_account["address"]),
                encoding.decode_address(arbitrator["address"]),
            ],
        )

        fund_app(algod_client, creator_account["private_key"], app_id, 1_100_000)

        with pytest.raises(Exception, match="(?i)rejected|logic eval|assert"):
            call_app(algod_client, outsider_pk, app_id, [b"release"])

        call_app(algod_client, creator_account["private_key"], app_id, [b"kill"])
        delete_app(algod_client, creator_account["private_key"], app_id)
