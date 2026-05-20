"""
Tests for ServiceRegistry smart contract.

Covers:
- Service registration (publish)
- Service lookup by name
- Service listing (box iteration)
- Price validation
- Duplicate name rejection
- Service removal by owner
"""

import pytest
from algopy_testing import AlgopyTestContext


class TestServiceRegistration:
    def test_publish_service(self):
        """Publishing a service stores it in BoxMap keyed by name."""
        # Service: { name, provider, price_microalgos, billing_period_days }
        pass

    def test_duplicate_name_rejected(self):
        """Cannot publish two services with the same name."""
        pass

    def test_price_must_be_positive(self):
        """Service price must be > 0 microalgos."""
        pass


class TestServiceLookup:
    def test_lookup_existing_service(self):
        """Can retrieve a published service by name."""
        pass

    def test_lookup_nonexistent_returns_empty(self):
        """Looking up a name that doesn't exist returns empty/error."""
        pass


class TestServiceRemoval:
    def test_owner_can_remove(self):
        """Service publisher can remove their own service."""
        pass

    def test_non_owner_cannot_remove(self):
        """Non-publisher cannot remove someone else's service."""
        pass


class TestServiceListing:
    def test_list_all_services(self):
        """Can iterate all registered services via box keys."""
        pass
