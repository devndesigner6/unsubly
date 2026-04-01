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


class MultiSigEscrow(ARC4Contract):
    """
    Multi-Signature Escrow Vault (ARC-4 compliant).

    Both creator AND co-signer must call approve(). When both have approved,
    funds are automatically released to recipient.

    GlobalState:
        creator              — account that deployed and funded the vault
        recipient            — account that receives funds on release
        co_signer            — second approver
        status               — 0 = locked, 1 = released, 2 = killed
        creator_approved     — 0/1 flag
        cosigner_approved    — 0/1 flag
    """

    def __init__(self) -> None:
        self.creator = GlobalState(arc4.Address, description="Vault creator")
        self.recipient = GlobalState(arc4.Address, description="Fund recipient")
        self.co_signer = GlobalState(arc4.Address, description="Co-signer address")
        self.status = GlobalState(UInt64, description="0=locked 1=released 2=killed")
        self.creator_approved = GlobalState(UInt64, description="1 if creator approved")
        self.cosigner_approved = GlobalState(UInt64, description="1 if cosigner approved")

    @arc4.abimethod(allow_actions=["NoOp"], create="require")
    def create(self, recipient: arc4.Address, co_signer: arc4.Address) -> None:
        """Deploy the vault and record both parties."""
        self.creator.value = arc4.Address(Txn.sender)
        self.recipient.value = recipient
        self.co_signer.value = co_signer
        self.status.value = UInt64(0)
        self.creator_approved.value = UInt64(0)
        self.cosigner_approved.value = UInt64(0)

    @arc4.abimethod(allow_actions=["NoOp"])
    def approve(self) -> None:
        """Record approval from creator or co-signer. Auto-releases when both approve."""
        assert self.status.value == UInt64(0), "Vault is not locked"

        sender_bytes = Txn.sender

        if sender_bytes == self.creator.value.bytes:
            self.creator_approved.value = UInt64(1)
        elif sender_bytes == self.co_signer.value.bytes:
            self.cosigner_approved.value = UInt64(1)
        else:
            assert False, "Unauthorized approver"

        if self.creator_approved.value == UInt64(1) and self.cosigner_approved.value == UInt64(1):
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
        """Creator can kill the vault and reclaim funds."""
        assert Txn.sender == self.creator.value.bytes, "Only creator can kill"
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
