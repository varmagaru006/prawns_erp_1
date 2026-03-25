"""
MongoDB Motor client options for reliable TLS to MongoDB Atlas.

Many macOS + Python builds hit ``TLSV1_ALERT_INTERNAL_ERROR`` with the default
OpenSSL CA / OCSP behaviour. We point PyMongo at **certifi**'s CA bundle and
(by default) disable OCSP endpoint checks for SRV connections.

**Note:** PyMongo 4.5 does not support a ``tlsContext`` / custom ``SSLContext``
keyword on ``MongoClient`` (unlike some other drivers). Use ``tlsCAFile`` only.

Env overrides (all optional):
- MONGO_TLS_DISABLE_OCSP — default ``1``. Set ``0`` / ``false`` to enforce OCSP.
- MONGO_TLS_ALLOW_INVALID — set ``1`` only for local debugging (weakens cert checks).
- MONGO_TLS_MAX_1_2 — reserved; PyMongo 4.5 cannot cap TLS version via kwargs here.
  Upgrade PyMongo or tune the system OpenSSL if you need TLS 1.2-only.
"""
from __future__ import annotations

import os
from typing import Any, Dict


def _env_truthy(name: str) -> bool:
    v = (os.environ.get(name) or "").strip().lower()
    return v in ("1", "true", "yes", "on")


def motor_client_kwargs(mongo_url: str) -> Dict[str, Any]:
    url = (mongo_url or "").strip()
    if not url:
        return {}
    low = url.lower()
    if "mongodb+srv://" not in low and "tls=true" not in low and "ssl=true" not in low:
        return {}

    import certifi

    kwargs: Dict[str, Any] = {}
    # Explicit CA bundle avoids missing/ stale system roots on macOS.
    kwargs["tlsCAFile"] = certifi.where()

    allow_invalid = _env_truthy("MONGO_TLS_ALLOW_INVALID")
    # PyMongo disallows combining tlsAllowInvalidCertificates with tlsDisableOCSPEndpointCheck.
    # If invalid certs are allowed (debug-only), skip explicit OCSP toggle.
    if not allow_invalid:
        _ocsp_off = (os.environ.get("MONGO_TLS_DISABLE_OCSP", "1") or "1").strip().lower()
        if _ocsp_off not in ("0", "false", "no", "off"):
            kwargs["tlsDisableOCSPEndpointCheck"] = True

    if allow_invalid:
        kwargs["tlsAllowInvalidCertificates"] = True

    return kwargs
