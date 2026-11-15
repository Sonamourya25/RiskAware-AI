from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import joblib
import os
import json
import urllib.request
import urllib.error

from ai.route_engine import find_best_route
from typing import Optional

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = Field(default_factory=list)
    context: dict = Field(default_factory=dict)

app = FastAPI(
    title="Risk-Aware Essential Supply Delivery System",
    description="AI-based system for risk prediction and safest route planning",
    version="1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load trained AI model
MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "ai",
    "risk_model.pkl"
)

model = joblib.load(MODEL_PATH)


@app.get("/health")
def health_check():
    return {
        "status": "success",
        "message": "Risk-Aware Delivery System is running"
    }


@app.post("/predict-risk")
def predict_risk(
    rainfall: float,
    slope: float,
    road_condition: int,
    flood_risk: int,
    traffic: int,
    past_incidents: int
):

    # AI prediction
    prediction = model.predict([[
        rainfall,
        slope,
        road_condition,
        flood_risk,
        traffic,
        past_incidents
    ]])

    risk_value = int(prediction[0])

    # Convert prediction into readable risk level
    if risk_value == 0:
        risk_level = "LOW"
    elif risk_value == 1:
        risk_level = "MEDIUM"
    else:
        risk_level = "HIGH"

    return {
        "risk_value": risk_value,
        "risk_level": risk_level
    }



@app.get("/best-route")
def best_route(
    start: str = "Warehouse",
    destination: str = "Hospital",
    disruption_type: str | None = None,
    road_from: str | None = None,
    road_to: str | None = None
):

    disruptions = []

    # Check whether an emergency was selected
    if any([disruption_type, road_from, road_to]):

        if not all([disruption_type, road_from, road_to]):
            return {
                "error": "Please provide disruption_type, road_from and road_to."
            }

        allowed_types = [
            "road_closure",
            "flood",
            "accident",
            "heavy_rainfall",
            "total_blockage",
            "destination_cutoff"
        ]

        if disruption_type.lower() not in allowed_types:
            return {
                "error": "Invalid disruption type.",
                "allowed_types": allowed_types
            }

        disruptions.append({
            "type": disruption_type,
            "road_from": road_from,
            "road_to": road_to
        })

    # Find the best route with or without an emergency
    result = find_best_route(
        start,
        destination,
        disruptions=disruptions
    )

    return result



@app.post("/chat")
def chat_with_ai(request: ChatRequest):

    # Get the general project information
    project_info = get_project_information()

    # Get current dashboard information from frontend
    current_context = request.context

    messages = [
        {
            "role": "system",
            "content": (
                "You are the AI assistant for the Risk-Aware Essential "
                "Supply Delivery System. Answer in simple, helpful language. "

                "You can answer questions about AI, technology, "
                "programming, education and this project. "

                "GENERAL PROJECT INFORMATION: "
                + json.dumps(project_info, indent=2)

                + "\n\nCURRENT DASHBOARD INFORMATION: "
                + json.dumps(current_context, indent=2)

                + "\n\nIMPORTANT INSTRUCTIONS: "
                "Use CURRENT DASHBOARD INFORMATION when answering "
                "questions about the user's latest route search. "

                "If the current dashboard says delivery failed or no route is available, "
                "clearly state that delivery failed and explain the exact failure reason, "
                "referencing the affected roads, closed corridors, or safety hazards from CURRENT DASHBOARD INFORMATION. "
                "Respond in the same language the user uses (English, Hindi, or Hinglish). "

                "If no current route information is available, "
                "say that the user should calculate a route first. "

                "Do not confuse the default route with the user's "
                "latest selected route. "

                "Never invent route results or claim that illustrative "
                "risk scores are real-world probabilities. "

                "Explain technical concepts in beginner-friendly language."
            )
        }
    ]

    # Include recent conversation history
    for item in request.history[-10:]:
        if item.role in ["user", "assistant"]:
            messages.append({
                "role": item.role,
                "content": item.content
            })

    # Add latest user message
    messages.append({
        "role": "user",
        "content": request.message
    })

    # Connect to local Ollama model
    payload = {
        "model": "qwen2.5:3b",
        "messages": messages,
        "stream": False
    }

    data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        "http://localhost:11434/api/chat",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))

        return {
            "reply": result["message"]["content"]
        }

    except urllib.error.URLError as error:
        raise HTTPException(
            status_code=503,
            detail=f"Could not connect to Ollama: {error}"
        )

    except (KeyError, json.JSONDecodeError):
        raise HTTPException(
            status_code=500,
            detail="Invalid response received from AI model."
        )

def get_project_information():

    route_result = find_best_route(
        "Warehouse",
        "Hospital"
    )

    return {
        "project_name": "Risk-Aware Essential Supply Delivery System",
        "purpose": "Find safer routes for delivering essential supplies.",
        "technology": [
            "Random Forest Machine Learning",
            "A* Search Algorithm",
            "K Shortest Simple Paths",
            "NetworkX",
            "Rule-Based Reasoning",
            "Goal-Based Agent"
        ],
        "route_result": route_result
    }