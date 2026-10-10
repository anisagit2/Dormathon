import logging
import os

from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

from . import db
from .config import configure_app
from .routes import BLUEPRINTS

logger = logging.getLogger("studysync")


def create_app(test_config=None):
    app = Flask(__name__)
    configure_app(app, test_config)
    db.initialize()

    for blueprint in BLUEPRINTS:
        app.register_blueprint(blueprint)

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        return jsonify({"error": error.description}), error.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        logger.exception("Unhandled StudySync API error")
        return jsonify({
            "error": "The local backend encountered an unexpected error. Check its terminal for details."
        }), 500

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=int(os.getenv("PORT", "8000")),
        debug=os.getenv("FLASK_DEBUG") == "1",
    )
