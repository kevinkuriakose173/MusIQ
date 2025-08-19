from app import create_app

app = create_app()

if __name__ == "__main__":
    # flask run also works, but this keeps it explicit
    port = int(os.environ.get("PORT", 5000))  # use Render's PORT if available
    app.run(host="0.0.0.0", port=port, debug=app.config.get("DEBUG", False))
