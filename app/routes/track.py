"""
Track routes - Backward compatibility wrapper.

This module has been refactored. The implementation is now in:
- app/routes/track/router.py (endpoints)
- app/routes/track/builders.py (response builders)
- app/routes/track/parsers.py (request parsers)
- app/routes/track/errors.py (error handling)

This file maintains backward compatibility by re-exporting the router.
"""

from app.routes.track.router import router

__all__ = ["router"]
