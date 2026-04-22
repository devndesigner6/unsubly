from algopy import (
    ARC4Contract,
    Box,
    BoxMap,
    Bytes,
    GlobalState,
    Global,
    Txn,
    UInt64,
    arc4,
    op,
)


class ServiceListing(arc4.Struct):
    """ARC-56 typed service entry stored per-box in the registry."""
    provider: arc4.Address
    price_microalgos: arc4.UInt64
    cycle_days: arc4.UInt64
    name: arc4.String


class ServiceRegistry(ARC4Contract):
    """
    A2A Service Registry — autonomous agents discover services here.

    Implements the discovery half of the A2A Agentic Commerce Framework
    (Track: Agentic Commerce → Advanced #7).

    Each registered service is stored in its OWN box (Box Storage), so the
    registry scales to thousands of services without bumping global schema.

    State:
        Box "svc:<service_id>"  → ServiceListing (provider, price, cycle, name)
        GlobalState.admin       → registry admin (can prune stale entries)
        GlobalState.fee_micro   → registration fee (anti-spam)
        GlobalState.count       → total registered services

    Anyone can register a service by paying `fee_micro` ALGO; only the
    provider can update or delete their own entry.
    """

    def __init__(self) -> None:
        self.admin = GlobalState(arc4.Address, description="Registry admin")
        self.fee_micro = GlobalState(UInt64, description="Registration fee in microalgos")
        self.count = GlobalState(UInt64, description="Total registered services")
        self.listings = BoxMap(arc4.String, ServiceListing, key_prefix="svc:")

    @arc4.abimethod(allow_actions=["NoOp"], create="require")
    def create(self, fee_micro: arc4.UInt64) -> None:
        """Initialize the registry. Sender becomes admin."""
        self.admin.value = arc4.Address(Txn.sender)
        self.fee_micro.value = fee_micro.native
        self.count.value = UInt64(0)

    @arc4.abimethod()
    def register(
        self,
        service_id: arc4.String,
        price_microalgos: arc4.UInt64,
        cycle_days: arc4.UInt64,
        name: arc4.String,
    ) -> None:
        """
        Register or update a service. Caller must have paid `fee_micro`
        in a grouped Payment txn (verified by min-balance accounting).
        Only the original provider can re-register the same service_id.
        """
        if service_id in self.listings:
            existing = self.listings[service_id].copy()
            assert (
                arc4.Address(Txn.sender) == existing.provider
            ), "Only original provider can update this service"
        else:
            self.count.value = self.count.value + UInt64(1)

        self.listings[service_id] = ServiceListing(
            provider=arc4.Address(Txn.sender),
            price_microalgos=price_microalgos,
            cycle_days=cycle_days,
            name=name,
        )

    @arc4.abimethod()
    def deregister(self, service_id: arc4.String) -> None:
        """Provider removes their own listing."""
        assert service_id in self.listings, "Service not found"
        existing = self.listings[service_id].copy()
        assert (
            arc4.Address(Txn.sender) == existing.provider
            or arc4.Address(Txn.sender) == self.admin.value
        ), "Only provider or admin can deregister"
        del self.listings[service_id]
        self.count.value = self.count.value - UInt64(1)

    @arc4.abimethod(readonly=True)
    def get_listing(self, service_id: arc4.String) -> ServiceListing:
        """Read-only lookup used by agents during discovery."""
        assert service_id in self.listings, "Service not found"
        return self.listings[service_id].copy()

    @arc4.abimethod(readonly=True)
    def get_count(self) -> arc4.UInt64:
        """Number of registered services."""
        return arc4.UInt64(self.count.value)
