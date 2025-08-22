import os
from flask import Blueprint, request, jsonify, current_app
from openai import OpenAI

bp = Blueprint("ai", __name__, url_prefix="/api/ai")

# Initialize OpenAI client (your API key must already be in env var)


@bp.route("/chat", methods=["POST"])
def chat():
    client = OpenAI(api_key=current_app.config["OPENAI_API_KEY"])
    
    data = request.get_json() or {}
    user_prompt = data.get("prompt")

    if not user_prompt:
        return jsonify({"error": "Missing prompt"}), 400

    try:
        # Call OpenAI with structured response format
        resp = client.chat.completions.create(
            model="gpt-4o-mini",  # cheap + fast, good for structured JSON
            messages=[
                {"role": "system", "content": (
                    "You are an assistant that helps recommend Spotify songs/artists. "
                    "Always respond in strict JSON with a 'candidates' array, "
                    "where each element is {\"artist\": <name>, \"track\": <optional track name>}."
                )},
                {"role": "user", "content": user_prompt},
            ],
            response_format={ "type": "json_object" }
        )

        # The model will give us raw JSON text
        content = resp.choices[0].message.content
        return jsonify(content)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
