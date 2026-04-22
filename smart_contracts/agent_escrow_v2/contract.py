from algopy import (
    ARC4Contract,
    BoxMap,
    GlobalState,
    Global,
    Txn,
    UInt64,
    arc4,
    itxn,
    op,
)


class BillingRecord(arc4.Struct):
    """Per-release billing record."""
    timestamp: arc4.UInt64
    amount: arc4.UInt64
    cycle_index: arc4.UInt64


class AgentEscrowVaultV2(ARC4Contract):
    """
    Agent Escrow Vault v2 — A2A Autonomous Payments with on-chain billing history.

    Same authorization model as v1 (creator OR agent can release), but instead
    of clobbering one global "status" slot per release, every release writes a
    BillingRecord into Box Storage keyed by the cycle index. The full payment
    history is permanently auditable on-chain.

    State:
        GlobalState.creator     — user wallet (only one who can kill)
        GlobalState.recipient   — service provider address
        GlobalState.agent       — autonomous agent wallet
        GlobalState.cycle_index — monotonic counter, incremented on each release
        GlobalState.killed      — 0 = alive, 1 = killed by creator
        Box "h:<cycle_index>"   — BillingRecord for that release
    """

    def __init__(self) -> None:
        self.creator = GlobalState(arc4.Address, description="User wallet (creator)")
        self.recipient = GlobalState(arc4.Address, description="Payment recipient")
        self.agent = GlobalState(arc4.Address, description="Autonomous release agent")
        self.cycle_index = GlobalState(UInt64, description="Monotonic billing cycle")
        self.killed = GlobalState(UInt64, description="0=alive 1=killed")
        self.history = BoxMap(arc4.UInt64, BillingRecord, key_prefix="h:")

    @arc4.abimethod(allow_actions=["NoOp"], create="require")
    def create(self, recipient: arc4.Address, agent: arc4.Address) -> None:
        """Deploy the v2 vault."""
        self.creator.value = arc4.Address(Txn.sender)
        self.recipient.value = recipient
        self.agent.value = agent
        self.cycle_index.value = UInt64(0)
        self.killed.value = UInt64(0)

    @arc4.abimethod()
    def release(self, amount: arc4.UInt64) -> arc4.UInt64:
        """
        Release `amount` microalgos to recipient and append a BillingRecord.
        Returns the new cycle index. Callable by creator OR agent.
        """
        assert self.killed.value == UInt64(0), "Vault is killed"
        assert (
            arc4.Address(Txn.sender) == self.creator.value
            or arc4.Address(Txn.sender) == self.agent.value
        ), "Only creator or agent can release"

        app_addr = Global.current_application_address
        balance = op.balance(app_addr)
        min_balance = op.min_balance(app_addr)
        spendable = balance - min_balance
        payout = amount.native
        assert payout > UInt64(0) and payout <= spendable, "Invalid payout amount"

        itxn.Payment(
            receiver=self.recipient.value.native,
            amount=payout,
            fee=0,
        ).submit()

        new_index = self.cycle_index.value + UInt64(1)
        self.cycle_index.value = new_index

        # Append to box-stored history
        self.history[arc4.UInt64(new_index)] = BillingRecord(
            timestamp=arc4.UInt64(Global.latest_timestamp),
            amount=arc4.UInt64(payout),
            cycle_index=arc4.UInt64(new_index),
        )

        return arc4.UInt64(new_index)

    @arc4.abimethod()
    def kill(self) -> None:
        """Refund remaining balance to creator and mark vault killed."""
        assert arc4.Address(Txn.sender) == self.creator.value, "Only creator can kill"
        assert self.killed.value == UInt64(0), "Already killed"

        app_addr = Global.current_application_address
        balance = op.balance(app_addr)
        min_balance = op.min_balance(app_addr)
        payout = balance - min_balance

        itxn.Payment(
            receiver=self.creator.value.native,
            amount=payout,
            fee=0,
        ).submit()

        self.killed.value = UInt64(1)

    @arc4.abimethod(readonly=True)
    def get_history(self, cycle: arc4.UInt64) -> BillingRecord:
        """Read a single release record."""
        assert cycle in self.history, "Cycle not found"
        return self.history[cycle].copy()

    @arc4.abimethod(readonly=True)
    def get_cycle_count(self) -> arc4.UInt64:
        """Total number of releases."""
        return arc4.UInt64(self.cycle_index.value)

    @arc4.abimethod(allow_actions=["DeleteApplication"])
    def delete(self) -> None:
        """Delete the vault. Only after kill, only by creator."""
        assert arc4.Address(Txn.sender) == self.creator.value, "Only creator can delete"
        assert self.killed.value == UInt64(1), "Kill before delete"

        itxn.Payment(
            receiver=self.creator.value.native,
            amount=0,
            close_remainder_to=self.creator.value.native,
            fee=0,
        ).submit()
