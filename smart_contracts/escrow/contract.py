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


class EscrowVault(ARC4Contract):
    """
    Standard Escrow Vault (ARC-4 compliant).

    Creator locks funds for a recipient. Creator can release funds to the
    recipient or kill the vault to reclaim them.

    GlobalState:
        creator      — account that deployed and funded the vault
        recipient    — account that receives funds on release
        status       — 0 = locked, 1 = released, 2 = killed
    """

    def __init__(self) -> None:
        self.creator = GlobalState(arc4.Address, description="Vault creator address")
        self.recipient = GlobalState(arc4.Address, description="Fund recipient address")
        self.status = GlobalState(UInt64, description="0=locked 1=released 2=killed")

    @arc4.abimethod(allow_actions=["NoOp"], create="require")
    def create(self, recipient: arc4.Address) -> None:
        """Deploy the vault and set creator + recipient."""
        self.creator.value = arc4.Address(Txn.sender)
        self.recipient.value = recipient
        self.status.value = UInt64(0)

    @arc4.abimethod(allow_actions=["NoOp"])
    def release(self) -> None:
        """Release locked funds to recipient. Only callable by creator."""
        assert arc4.Address(Txn.sender) == self.creator.value, "Only creator can release"
        assert self.status.value == UInt64(0), "Vault is not locked"

        app_addr = Global.current_application_address
        balance = op.balance(app_addr)
        min_balance = op.min_balance(app_addr)
        payout = balance - min_balance

        itxn.Payment(
            receiver=self.recipient.value.native,
            amount=payout,
            fee=0,
        ).submit()

        self.status.value = UInt64(1)

    @arc4.abimethod(allow_actions=["NoOp"])
    def kill(self) -> None:
        """Reclaim funds back to creator. Only callable by creator."""
        assert arc4.Address(Txn.sender) == self.creator.value, "Only creator can kill"
        assert self.status.value == UInt64(0), "Vault is not locked"

        app_addr = Global.current_application_address
        balance = op.balance(app_addr)
        min_balance = op.min_balance(app_addr)
        payout = balance - min_balance

        itxn.Payment(
            receiver=self.creator.value.native,
            amount=payout,
            fee=0,
        ).submit()

        self.status.value = UInt64(2)

    @arc4.abimethod(allow_actions=["DeleteApplication"])
    def delete(self) -> None:
        """Delete the application. Only allowed after release or kill."""
        assert arc4.Address(Txn.sender) == self.creator.value, "Only creator can delete"
        assert self.status.value != UInt64(0), "Vault still locked — release or kill first"

        itxn.Payment(
            receiver=self.creator.value.native,
            amount=0,
            close_remainder_to=self.creator.value.native,
            fee=0,
        ).submit()
