"""
Shared test fixtures for smart contract tests.

Uses algopy-testing for unit tests and AlgoKit LocalNet for integration tests.
"""

import pytest


@pytest.fixture(scope="session")
def algod_client():
    """Create an algod client connected to LocalNet."""
    import algosdk
    client = algosdk.v2client.algod.AlgodClient(
        algod_token="a" * 64,
        algod_address="http://localhost:4001",
    )
    return client


@pytest.fixture(scope="session")
def funded_account(algod_client):
    """Create and fund a test account on LocalNet."""
    import algosdk
    private_key, address = algosdk.account.generate_account()
    return {"address": address, "private_key": private_key}
