"""ASGI entrypoint for the canonical FastAPI application.

Cookie and bearer authentication are returned by the same core routes so
router implementation changes cannot shadow the cross-origin token response.
"""

from server import app as app
