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


class TimeLockEscrow(ARC4Contract):
    """
    Time-Locked Escrow Vault (ARC-4 compliant).

    Identical to standard escrow but release() is blocked until
    Global.latest_timestamp >= unlock_time.

    GlobalState:
        creator      — account that deployed and funded the vault
        recipient    — account that receives funds on release
        status       — 0 = locked, 1 = released, 2 = killed
        unlock_time  — Unix timestamp after which release is allowed
    """

    def __init__(self) -> None:
        self.creator = GlobalState(arc4.Address, description="Vault creator address")
        self.recipient = GlobalState(arc4.Address, description="Fund recipient address")
        self.status = GlobalState(UInt64, description="0=locked 1=released 2=killed")
        self.unlock_time = GlobalState(UInt64, description="Unix timestamp for earliest release")

    @arc4.abimethod(allow_actions=["NoOp"], create="require")
    def create(self, recipient: arc4.Address, unlock_time: UInt64) -> None:
        """Deploy the vault with a time-lock."""
        self.creator.value = arc4.Address(Txn.sender)
        self.recipient.value = recipient
        self.status.value = UInt64(0)
        self.unlock_time.value = unlock_time

    @arc4.abimethod(allow_actions=["NoOp"])
    def release(self) -> None:
        """Release funds to recipient after time-lock expires."""
        assert arc4.Address(Txn.sender) == self.creator.value, "Only creator can release"
        assert self.status.value == UInt64(0), "Vault is not locked"
        assert Global.latest_timestamp >= self.unlock_time.value, "Time-lock not expired yet"

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
        """Reclaim funds back to creator (no time restriction on kill)."""
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
        """Delete the application after release or kill."""
        assert arc4.Address(Txn.sender) == self.creator.value, "Only creator can delete"
        assert self.status.value != UInt64(0), "Vault still locked"

        itxn.Payment(
            receiver=self.creator.value.native,
            amount=0,
            close_remainder_to=self.creator.value.native,
            fee=0,
        ).submit()
