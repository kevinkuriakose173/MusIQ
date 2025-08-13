import os
from flask import Flask
from flask_cors import CORS
from .config import Config

def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    origin = app.config.get("FRONTEND_ORIGIN")
    if origin:
        CORS(app, supports_credentials=True, resources={r"/*": {"origins": [origin]}})

    from .routes.auth import bp as auth_bp
    from .routes.spotify_api import bp as api_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(api_bp, url_prefix="/api")

    @app.get("/health")
    def health():
        return {"ok": True}

    return app
