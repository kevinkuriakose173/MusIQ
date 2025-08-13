import os
from dotenv import load_dotenv
load_dotenv()

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"
    SPOTIFY_CLIENT_ID = os.environ["SPOTIFY_CLIENT_ID"]
    SPOTIFY_CLIENT_SECRET = os.environ["SPOTIFY_CLIENT_SECRET"]
    REDIRECT_URI = os.environ["REDIRECT_URI"]
    FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "")
    SESSION_COOKIE_NAME = "session"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False
