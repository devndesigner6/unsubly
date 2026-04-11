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


class AgentEscrowVault(ARC4Contract):
    """
    Agent-Managed Escrow Vault (ARC-4 compliant) — A2A Autonomous Payments.

    Creator (user wallet) locks funds for a recipient (subscription service).
    An autonomous agent wallet is authorized to release funds on billing date.
    Creator can kill the vault at any time to reclaim their ALGO.

    GlobalState:
        creator    — user wallet (can kill, gets refund)
        recipient  — subscription service address (receives payment on release)
        agent      — autonomous AI agent (can release on billing date)
        status     — 0 = locked, 1 = released, 2 = killed

    This contract is the core of the autonomous A2A payment agent.
    """

    def __init__(self) -> None:
        self.creator = GlobalState(arc4.Address, description="User wallet (creator)")
        self.recipient = GlobalState(arc4.Address, description="Payment recipient")
        self.agent = GlobalState(arc4.Address, description="Autonomous release agent")
        self.status = GlobalState(UInt64, description="0=locked 1=released 2=killed")

    @arc4.abimethod(allow_actions=["NoOp"], create="require")
    def create(self, recipient: arc4.Address, agent: arc4.Address) -> None:
        """Deploy the vault. Sender becomes creator."""
        self.creator.value = arc4.Address(Txn.sender)
        self.recipient.value = recipient
        self.agent.value = agent
        self.status.value = UInt64(0)

    @arc4.abimethod(allow_actions=["NoOp"])
    def release(self) -> None:
        """Release locked funds to recipient. Callable by creator OR agent."""
        assert (
            arc4.Address(Txn.sender) == self.creator.value
            or arc4.Address(Txn.sender) == self.agent.value
        ), "Only creator or agent can release"
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
        """Reclaim funds to creator. Only callable by creator."""
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
        """Delete vault after release or kill. Only creator."""
        assert arc4.Address(Txn.sender) == self.creator.value, "Only creator can delete"
        assert self.status.value != UInt64(0), "Vault still locked"

        itxn.Payment(
            receiver=self.creator.value.native,
            amount=0,
            close_remainder_to=self.creator.value.native,
            fee=0,
        ).submit()
