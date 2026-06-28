"""Tests for concierge rate limiting."""

from api.services.agent_rate_limit import MAX_ASKS, peek_remaining, record_ask


def test_rate_limit_allows_three_then_blocks():
    key = "test-session-unique-1"
    assert peek_remaining(key) == MAX_ASKS
    for i in range(MAX_ASKS):
        remaining = record_ask(key)
        assert remaining == MAX_ASKS - i - 1
    assert peek_remaining(key) == 0
