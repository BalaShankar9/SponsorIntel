"""
Tests for authentication: password hashing, JWT tokens.
"""

import time
from datetime import timedelta

import pytest
from jose import jwt, JWTError

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_returns_string(self):
        hashed = hash_password("mysecret")
        assert isinstance(hashed, str)
        assert hashed != "mysecret"

    def test_verify_correct_password(self):
        hashed = hash_password("mysecret")
        assert verify_password("mysecret", hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("mysecret")
        assert verify_password("wrongpassword", hashed) is False

    def test_different_hashes_for_same_password(self):
        h1 = hash_password("mysecret")
        h2 = hash_password("mysecret")
        # bcrypt salts should make them different
        assert h1 != h2

    def test_both_verify(self):
        h1 = hash_password("mysecret")
        h2 = hash_password("mysecret")
        assert verify_password("mysecret", h1) is True
        assert verify_password("mysecret", h2) is True


class TestJWTTokens:
    def test_create_and_decode(self):
        token = create_access_token(data={"sub": "user123"})
        payload = decode_access_token(token)
        assert payload["sub"] == "user123"
        assert "exp" in payload

    def test_custom_expiry(self):
        token = create_access_token(
            data={"sub": "user123"},
            expires_delta=timedelta(minutes=5),
        )
        payload = decode_access_token(token)
        assert payload["sub"] == "user123"

    def test_expired_token_raises(self):
        token = create_access_token(
            data={"sub": "user123"},
            expires_delta=timedelta(seconds=-1),
        )
        with pytest.raises(JWTError):
            decode_access_token(token)

    def test_invalid_token_raises(self):
        with pytest.raises(JWTError):
            decode_access_token("not.a.valid.token")

    def test_tampered_token_raises(self):
        token = create_access_token(data={"sub": "user123"})
        # Tamper with the token
        parts = token.split(".")
        parts[1] = parts[1] + "TAMPERED"
        tampered = ".".join(parts)
        with pytest.raises(JWTError):
            decode_access_token(tampered)

    def test_payload_preserved(self):
        token = create_access_token(
            data={"sub": "abc", "role": "admin", "extra": 42}
        )
        payload = decode_access_token(token)
        assert payload["sub"] == "abc"
        assert payload["role"] == "admin"
        assert payload["extra"] == 42
