from algopy import (
    ARC4Contract,
    GlobalState,
    Txn,
    Global,
    arc4,
    itxn,
    UInt64,
    op,
)


class DisputeEscrow(ARC4Contract):
    """
    Dispute-Resolution Escrow Vault (ARC-4 compliant).

    A neutral arbitrator is designated at creation. Either the original
    creator OR the arbitrator can call release() or kill() to resolve a
    dispute — giving the arbitrator power to decide the outcome.

    GlobalState:
        creator     — account that deployed and funded the vault
        recipient   — account that receives funds on release
        arbitrator  — neutral third party with release/kill powers
        status      — 0 = locked, 1 = released, 2 = killed
    """

    def __init__(self) -> None:
        self.creator = GlobalState(arc4.Address, description="Vault creator")
        self.recipient = GlobalState(arc4.Address, description="Fund recipient")
        self.arbitrator = GlobalState(arc4.Address, description="Dispute arbitrator")
        self.status = GlobalState(UInt64, description="0=locked 1=released 2=killed")

    @arc4.abimethod(allow_actions=["NoOp"], create="require")
    def create(self, recipient: arc4.Address, arbitrator: arc4.Address) -> None:
        """Deploy the vault with a designated arbitrator."""
        self.creator.value = arc4.Address(Txn.sender)
        self.recipient.value = recipient
        self.arbitrator.value = arbitrator
        self.status.value = UInt64(0)

    @arc4.abimethod(allow_actions=["NoOp"])
    def release(self) -> None:
        """Release funds to recipient. Callable by creator or arbitrator."""
        sender_bytes = Txn.sender
        is_creator = sender_bytes == self.creator.value.bytes
        is_arbitrator = sender_bytes == self.arbitrator.value.bytes
        assert is_creator or is_arbitrator, "Only creator or arbitrator can release"
        assert self.status.value == UInt64(0), "Vault is not locked"

        balance = op.balance(Global.current_application_address)
        min_balance = op.min_balance(Global.current_application_address)
        payout = balance - min_balance

        itxn.Payment(
            receiver=self.recipient.value.bytes,
            amount=payout,
            fee=0,
        ).submit()

        self.status.value = UInt64(1)

    @arc4.abimethod(allow_actions=["NoOp"])
    def kill(self) -> None:
        """Reclaim funds to creator. Callable by creator or arbitrator."""
        sender_bytes = Txn.sender
        is_creator = sender_bytes == self.creator.value.bytes
        is_arbitrator = sender_bytes == self.arbitrator.value.bytes
        assert is_creator or is_arbitrator, "Only creator or arbitrator can kill"
        assert self.status.value == UInt64(0), "Vault is not locked"

        balance = op.balance(Global.current_application_address)
        min_balance = op.min_balance(Global.current_application_address)
        payout = balance - min_balance

        itxn.Payment(
            receiver=self.creator.value.bytes,
            amount=payout,
            fee=0,
        ).submit()

        self.status.value = UInt64(2)

    @arc4.abimethod(allow_actions=["DeleteApplication"])
    def delete(self) -> None:
        """Delete the application after it is no longer locked."""
        assert Txn.sender == self.creator.value.bytes, "Only creator can delete"
        assert self.status.value != UInt64(0), "Vault still locked"

        itxn.Payment(
            receiver=self.creator.value.bytes,
            amount=0,
            close_remainder_to=self.creator.value.bytes,
            fee=0,
        ).submit()
