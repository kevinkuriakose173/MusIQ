import os
from flask import Flask
from flask_cors import CORS
from .config import Config
from .routes.ai_routes import bp as ai_routes_bp
from .routes.spotify_api import bp as api_bp
from .routes.auth import bp as auth_bp
from .spotify_tools import bp as spotify_tools_bp  # or .routes.spotify_tools

def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    # CORS (frontend <-> backend with cookies)
    origin = app.config.get("FRONTEND_ORIGIN")  # e.g. http://localhost:3000
    if origin:
        CORS(
            app,
            supports_credentials=True,
            resources={
                r"/api/*": {"origins": [origin]},
                r"/spotify-tools/*": {"origins": [origin]},
                r"/health": {"origins": [origin]},
            },
        )

    # Register blueprints
    app.register_blueprint(auth_bp)                 # your /login, /callback, etc.
    app.register_blueprint(api_bp, url_prefix="/api")  # /api/me, /api/search, ...
    app.register_blueprint(spotify_tools_bp)           # /spotify-tools/...
    app.register_blueprint(ai_routes_bp)               # /api/ai/chat

    @app.get("/healthz")
    def health():
        return "", 200

    return app
