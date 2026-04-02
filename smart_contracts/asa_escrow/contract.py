from algopy import (
    ARC4Contract,
    GlobalState,
    Txn,
    Global,
    arc4,
    itxn,
    UInt64,
    Asset,
    op,
)


class ASAEscrow(ARC4Contract):
    """
    Algorand Standard Asset (ASA / Token) Escrow Vault (ARC-4 compliant).

    Handles escrow of ASA tokens instead of native ALGO. The application
    must opt in to the ASA before tokens can be transferred to it.

    GlobalState:
        creator    — account that deployed the vault
        recipient  — account that receives tokens on release
        asa_id     — ASA / token ID being held in escrow
        status     — 0 = locked, 1 = released, 2 = killed
    """

    def __init__(self) -> None:
        self.creator = GlobalState(arc4.Address, description="Vault creator")
        self.recipient = GlobalState(arc4.Address, description="Token recipient")
        self.asa_id = GlobalState(UInt64, description="ASA ID held in escrow")
        self.status = GlobalState(UInt64, description="0=locked 1=released 2=killed")

    @arc4.abimethod(allow_actions=["NoOp"], create="require")
    def create(self, recipient: arc4.Address, asa_id: UInt64) -> None:
        """Deploy the ASA vault and record creator, recipient, and asset."""
        self.creator.value = arc4.Address(Txn.sender)
        self.recipient.value = recipient
        self.asa_id.value = asa_id
        self.status.value = UInt64(0)

    @arc4.abimethod(allow_actions=["NoOp"])
    def optin(self) -> None:
        """
        Opt the application account into the ASA so it can receive tokens.
        Must be called (and funded) by creator before transferring tokens.
        """
        assert arc4.Address(Txn.sender) == self.creator.value, "Only creator can opt in"

        asset = Asset(self.asa_id.value)

        itxn.AssetTransfer(
            xfer_asset=asset,
            asset_receiver=Global.current_application_address,
            asset_amount=UInt64(0),
            fee=0,
        ).submit()

    @arc4.abimethod(allow_actions=["NoOp"])
    def release(self) -> None:
        """Transfer all held ASA tokens to recipient. Only callable by creator."""
        assert arc4.Address(Txn.sender) == self.creator.value, "Only creator can release"
        assert self.status.value == UInt64(0), "Vault is not locked"

        asset = Asset(self.asa_id.value)
        app_address = Global.current_application_address
        token_balance, asset_exists = op.AssetHoldingGet.asset_balance(app_address, asset)

        itxn.AssetTransfer(
            xfer_asset=asset,
            asset_receiver=self.recipient.value.native,
            asset_amount=token_balance,
            asset_close_to=self.recipient.value.native,
            fee=0,
        ).submit()

        self.status.value = UInt64(1)

    @arc4.abimethod(allow_actions=["NoOp"])
    def kill(self) -> None:
        """Return all held ASA tokens to creator. Only callable by creator."""
        assert arc4.Address(Txn.sender) == self.creator.value, "Only creator can kill"
        assert self.status.value == UInt64(0), "Vault is not locked"

        asset = Asset(self.asa_id.value)
        app_address = Global.current_application_address
        token_balance, asset_exists = op.AssetHoldingGet.asset_balance(app_address, asset)

        itxn.AssetTransfer(
            xfer_asset=asset,
            asset_receiver=self.creator.value.native,
            asset_amount=token_balance,
            asset_close_to=self.creator.value.native,
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
