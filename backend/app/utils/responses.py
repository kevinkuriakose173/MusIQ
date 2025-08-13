def json_error(message: str, status: int = 400):
    return {"error": message}, status
