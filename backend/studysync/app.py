import logging
import os

from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

from . import db
from .config import configure_app
from .routes import BLUEPRINTS

logger = logging.getLogger("studysync")


def create_app(test_config=None):
    app = Flask(__name__)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1)
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

    @app.after_request
    def add_audio_upload_cors_headers(response):
        if request.path == "/api/notes/audio":
            origin = request.headers.get("Origin")
            if origin and origin.rstrip("/") == app.config["FRONTEND_URL"].rstrip("/"):
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "Content-Type"
                response.headers["Access-Control-Max-Age"] = "600"
                response.vary.add("Origin")
        return response

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=int(os.getenv("PORT", "8000")),
        debug=os.getenv("FLASK_DEBUG") == "1",
    )
