"""HTTP route blueprints."""

from .alerts import alerts_bp
from .core import core_bp
from .emails import emails_bp
from .google import google_bp
from .items import items_bp
from .notes import notes_bp
from .plans import plans_bp
from .settings import settings_bp
from .system import system_bp

# Register routes in domain order to keep endpoint ownership explicit.
BLUEPRINTS = (
    core_bp,
    google_bp,
    emails_bp,
    notes_bp,
    plans_bp,
    alerts_bp,
    items_bp,
    settings_bp,
    system_bp,
)
