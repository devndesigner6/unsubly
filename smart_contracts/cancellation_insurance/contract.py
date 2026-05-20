from algopy import (
    ARC4Contract,
    BoxMap,
    GlobalState,
    Global,
    Txn,
    UInt64,
    Bytes,
    arc4,
    itxn,
    op,
)


class CancellationInsuranceVault(ARC4Contract):
    """
    Cancellation Insurance Vault — Feature 1.

    The user locks ALGO before a billing date. Two outcomes:

    1. User cancels the subscription and submits proof (cancellation hash)
       BEFORE the billing date → creator calls release_to_user(proof_hash)
       → ALGO returns to the user's wallet.

    2. Billing date passes with no proof → agent calls release_to_vendor()
       → ALGO goes to the vendor/recipient.

    This creates a financial commitment device: if you cancel, you get your
    money back. If you forget, the vendor gets paid automatically.

    State:
        creator         — user wallet (can submit proof and release to self)
        recipient       — vendor/service provider address
        agent           — autonomous agent (releases to vendor on billing date)
        billing_date    — unix timestamp of the billing date
        proof_hash      — SHA-256 hash of cancellation proof (set by creator)
        status          — 0=locked, 1=released_to_user, 2=released_to_vendor
    """

    def __init__(self) -> None:
        self.creator = GlobalState(arc4.Address, description="User wallet")
        self.recipient = GlobalState(arc4.Address, description="Vendor address")
        self.agent = GlobalState(arc4.Address, description="Autonomous agent")
        self.billing_date = GlobalState(UInt64, description="Billing date unix timestamp")
        self.proof_hash = GlobalState(arc4.DynamicBytes, description="Cancellation proof hash (hex)")
        self.status = GlobalState(UInt64, description="0=locked 1=user 2=vendor")

    @arc4.abimethod(allow_actions=["NoOp"], create="require")
    def create(
        self,
        recipient: arc4.Address,
        agent: arc4.Address,
        billing_date: arc4.UInt64,
    ) -> None:
        """Deploy the cancellation insurance vault."""
        self.creator.value = arc4.Address(Txn.sender)
        self.recipient.value = recipient
        self.agent.value = agent
        self.billing_date.value = billing_date.native
        self.proof_hash.value = arc4.DynamicBytes(b"")
        self.status.value = UInt64(0)

    @arc4.abimethod()
    def submit_proof(self, proof_hash: arc4.DynamicBytes) -> None:
        """
        Creator submits a cancellation proof hash before the billing date.
        The hash is stored on-chain as permanent tamper-proof evidence.
        """
        assert arc4.Address(Txn.sender) == self.creator.value, "Only creator can submit proof"
        assert self.status.value == UInt64(0), "Vault already settled"
        assert Global.latest_timestamp < self.billing_date.value, "Billing date has passed"
        self.proof_hash.value = proof_hash

    @arc4.abimethod()
    def release_to_user(self) -> None:
        """
        Release ALGO back to creator (user cancelled).
        Requires proof_hash to be set AND billing date not yet passed.
        Only callable by creator.
        """
        assert arc4.Address(Txn.sender) == self.creator.value, "Only creator can release to self"
        assert self.status.value == UInt64(0), "Vault already settled"
        assert len(self.proof_hash.value.native) > UInt64(0), "No cancellation proof submitted"

        app_addr = Global.current_application_address
        balance = op.balance(app_addr)
        min_balance = op.min_balance(app_addr)
        payout = balance - min_balance

        itxn.Payment(
            receiver=self.creator.value.native,
            amount=payout,
            fee=0,
        ).submit()

        self.status.value = UInt64(1)

    @arc4.abimethod()
    def release_to_vendor(self) -> None:
        """
        Release ALGO to vendor (user did not cancel in time).
        Callable by agent OR creator after billing date.
        """
        assert (
            arc4.Address(Txn.sender) == self.agent.value
            or arc4.Address(Txn.sender) == self.creator.value
        ), "Only agent or creator can release to vendor"
        assert self.status.value == UInt64(0), "Vault already settled"
        assert Global.latest_timestamp >= self.billing_date.value, "Billing date not yet reached"

        app_addr = Global.current_application_address
        balance = op.balance(app_addr)
        min_balance = op.min_balance(app_addr)
        payout = balance - min_balance

        itxn.Payment(
            receiver=self.recipient.value.native,
            amount=payout,
            fee=0,
        ).submit()

        self.status.value = UInt64(2)

    @arc4.abimethod()
    def kill(self) -> None:
        """Emergency kill — returns ALGO to creator. Only creator, only when locked."""
        assert arc4.Address(Txn.sender) == self.creator.value, "Only creator can kill"
        assert self.status.value == UInt64(0), "Vault already settled"

        app_addr = Global.current_application_address
        balance = op.balance(app_addr)
        min_balance = op.min_balance(app_addr)
        payout = balance - min_balance

        itxn.Payment(
            receiver=self.creator.value.native,
            amount=payout,
            fee=0,
        ).submit()

        self.status.value = UInt64(1)

    @arc4.abimethod(readonly=True)
    def get_status(self) -> arc4.UInt64:
        """Read vault status: 0=locked, 1=released_to_user, 2=released_to_vendor."""
        return arc4.UInt64(self.status.value)

    @arc4.abimethod(allow_actions=["DeleteApplication"])
    def delete(self) -> None:
        """Delete contract and reclaim MBR. Only after settlement."""
        assert arc4.Address(Txn.sender) == self.creator.value, "Only creator can delete"
        assert self.status.value != UInt64(0), "Settle vault before deleting"

        itxn.Payment(
            receiver=self.creator.value.native,
            amount=0,
            close_remainder_to=self.creator.value.native,
            fee=0,
        ).submit()
