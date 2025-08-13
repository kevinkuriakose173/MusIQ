from app import create_app

app = create_app()

if __name__ == "__main__":
    # flask run also works, but this keeps it explicit
    app.run(host="127.0.0.1", port=8080, debug=app.config.get("DEBUG", False))
