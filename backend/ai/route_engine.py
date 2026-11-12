
import networkx as nx
import joblib
import os


from ai.rule_engine import apply_safety_rules


# =========================================================
# 1. LOAD TRAINED RANDOM FOREST MODEL
# =========================================================

MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "risk_model.pkl"
)

model = joblib.load(MODEL_PATH)

MAX_ACCEPTABLE_RISK = 70


# =========================================================
# 2. CREATE ROAD NETWORK
# =========================================================

def create_road_network():

    graph = nx.Graph()

    # Warehouse to A
    graph.add_edge(
        "Warehouse", "A",
        distance=10, time=15, rainfall=40,
        slope=10, road_condition=1,
        flood_risk=0, traffic=1, incidents=0
    )

    # Warehouse to B
    graph.add_edge(
        "Warehouse", "B",
        distance=8, time=12, rainfall=80,
        slope=25, road_condition=3,
        flood_risk=1, traffic=3, incidents=3
    )

    # A to C
    graph.add_edge(
        "A", "C",
        distance=12, time=18, rainfall=45,
        slope=12, road_condition=1,
        flood_risk=0, traffic=2, incidents=0
    )

    # B to C
    graph.add_edge(
        "B", "C",
        distance=9, time=14, rainfall=85,
        slope=28, road_condition=3,
        flood_risk=1, traffic=3, incidents=4
    )

    # A to D
    graph.add_edge(
        "A", "D",
        distance=15, time=22, rainfall=50,
        slope=15, road_condition=2,
        flood_risk=0, traffic=2, incidents=1
    )

    # C to D
    graph.add_edge(
        "C", "D",
        distance=7, time=10, rainfall=55,
        slope=18, road_condition=2,
        flood_risk=0, traffic=2, incidents=1
    )

    # B to D
    graph.add_edge(
        "B", "D",
        distance=20, time=28, rainfall=90,
        slope=30, road_condition=3,
        flood_risk=1, traffic=3, incidents=5
    )

    # C to Hospital
    graph.add_edge(
        "C", "Hospital",
        distance=10, time=15, rainfall=35,
        slope=8, road_condition=1,
        flood_risk=0, traffic=1, incidents=0
    )

    # D to Hospital
    graph.add_edge(
        "D", "Hospital",
        distance=8, time=12, rainfall=40,
        slope=10, road_condition=1,
        flood_risk=0, traffic=1, incidents=0
    )

    return graph


# =========================================================
# 3. EMERGENCY DISRUPTION SIMULATOR
# =========================================================

def apply_disruptions(graph, disruptions):

    for event in disruptions:

        event_type = event.get("type", "").lower()
        road_from = event.get("road_from")
        road_to = event.get("road_to")

        if not road_from or not road_to:
            continue

        if not graph.has_edge(road_from, road_to):
            continue

        edge = graph[road_from][road_to]

        if event_type == "road_closure":

            edge["blocked"] = True
            edge["disruption"] = "ROAD_CLOSED"

        elif event_type == "flood":

            edge["rainfall"] = 100
            edge["flood_risk"] = 1
            edge["disruption"] = "FLOOD"

        elif event_type == "accident":

            edge["incidents"] += 5
            edge["traffic"] = 3
            edge["disruption"] = "ACCIDENT"

        elif event_type == "heavy_rainfall":

            edge["rainfall"] = 100
            edge["flood_risk"] = 1
            edge["disruption"] = "HEAVY_RAINFALL"

    return graph


# =========================================================
# 4. RANDOM FOREST RISK PREDICTION
# =========================================================

def predict_edge_risk(edge):

    features = [
        edge["rainfall"],
        edge["slope"],
        edge["road_condition"],
        edge["flood_risk"],
        edge["traffic"],
        edge["incidents"]
    ]

    # Use feature names if the model was trained with a DataFrame.
    if hasattr(model, "feature_names_in_"):

        try:
            import pandas as pd

            input_data = pd.DataFrame(
                [features],
                columns=model.feature_names_in_
            )

        except ImportError:
            input_data = [features]

    else:
        input_data = [features]

    prediction = model.predict(input_data)

    risk_value = int(prediction[0])

    # Illustrative risk scores, not real probabilities.
    risk_scores = {
        0: 20,
        1: 55,
        2: 90
    }

    return risk_scores.get(risk_value, 90)


# =========================================================
# 5. CALCULATE ROAD COST
# =========================================================

def calculate_road_cost(distance, time, risk, penalty):

    cost = (
        distance * 0.4
        + time * 0.2
        + risk * 0.4
        + penalty
    )

    return round(cost, 2)


# =========================================================
# 6. GOAL-BASED AGENT
# =========================================================

def goal_based_agent(start, destination, route):

    goal = (
        f"Deliver essential supplies from "
        f"{start} to {destination}"
    )

    if not route:

        return {
            "goal": goal,
            "status": "FAILED",
            "action": "NO_ROUTE_AVAILABLE",
            "reason": "No safe route was found."
        }

    warnings = route["warnings"]

    if warnings:
        action = "PROCEED_WITH_CAUTION"
    else:
        action = "FOLLOW_RECOMMENDED_ROUTE"

    return {
        "goal": goal,
        "status": "PLAN_FOUND",
        "action": action,
        "selected_route": route["route"],
        "reason": (
            "Route selected using A* Search, "
            "ML risk prediction and safety rules."
        )
    }


# =========================================================
# 7. BUILD ROUTE DETAILS
# =========================================================

def build_route_details(graph, path, route_number):

    total_distance = 0
    total_time = 0
    total_risk = 0
    total_cost = 0

    route_warnings = []
    road_details = []

    for i in range(len(path) - 1):

        u = path[i]
        v = path[i + 1]

        edge = graph[u][v]

        total_distance += edge["distance"]
        total_time += edge["time"]
        total_risk += edge["ai_risk_percent"]
        total_cost += edge["route_cost"]

        route_warnings.extend(edge["warnings"])

        road_details.append({
            "from": u,
            "to": v,
            "distance_km": edge["distance"],
            "time_minutes": edge["time"],
            "risk": edge["ai_risk_percent"],
            "decision": edge["rule_decision"],
            "penalty": edge["rule_penalty"],
            "warnings": edge["warnings"]
        })

    number_of_edges = len(path) - 1

    average_risk = (
        total_risk / number_of_edges
        if number_of_edges > 0 else 0
    )

    return {
        "route_id": route_number,
        "route": path,
        "distance_km": total_distance,
        "time_minutes": total_time,
        "ai_risk_percent": round(average_risk, 2),
        "route_score": round(total_cost, 2),
        "warnings": route_warnings,
        "road_details": road_details
    }


# =========================================================
# 8. MAIN ROUTE FINDING FUNCTION
# =========================================================

def find_best_route(start, destination, disruptions=None):

    print("\n========== ROUTE CALCULATION STARTED ==========")

    # Create a fresh road network.
    graph = create_road_network()

    if disruptions is None:
        disruptions = []

    # Apply emergency events.
    graph = apply_disruptions(graph, disruptions)

    print("DEBUG - Received disruptions:", disruptions)

    if graph.has_edge("A", "C"):
        print("DEBUG - A to C road:", graph["A"]["C"])

    # Validate locations.
    if start not in graph:

        return {
            "error": f"Unknown start location: {start}"
        }

    if destination not in graph:

        return {
            "error": f"Unknown destination: {destination}"
        }

    # -----------------------------------------------------
    # STEP 1: ML RISK PREDICTION + SAFETY RULES
    # -----------------------------------------------------

    for u, v, edge in graph.edges(data=True):

        risk = predict_edge_risk(edge)

        # Increase risk for simulated emergencies.
        if edge.get("disruption") in ["FLOOD", "ACCIDENT"]:

            risk = max(risk, 90)

        elif edge.get("disruption") == "HEAVY_RAINFALL":

            risk = max(risk, 75)

        # Apply rule-based reasoning.
        safety = apply_safety_rules(edge)

        # Calculate combined road cost.
        cost = calculate_road_cost(
            edge["distance"],
            edge["time"],
            risk,
            safety["penalty"]
        )

        # Store road information.
        edge["ai_risk_percent"] = risk
        edge["rule_decision"] = safety["decision"]
        edge["rule_penalty"] = safety["penalty"]
        edge["warnings"] = list(safety["warnings"])
        edge["route_cost"] = cost

    print("Step 1 completed: ML and safety rules evaluated.")

    # -----------------------------------------------------
    # STEP 2: BUILD SAFE ROUTE GRAPH
    # -----------------------------------------------------

    safe_graph = graph.copy()

    for u, v, edge in list(safe_graph.edges(data=True)):

        # Completely block closed or AVOID roads.
        if (
            edge["rule_decision"] == "AVOID"
            or edge.get("blocked", False)
        ):

            safe_graph.remove_edge(u, v)

        # Keep HIGH CAUTION roads but increase their cost.
        elif edge["ai_risk_percent"] > MAX_ACCEPTABLE_RISK:

            edge["warnings"].append(
                "High AI-predicted road risk: proceed with caution"
            )

            edge["route_cost"] += (
                edge["ai_risk_percent"] - MAX_ACCEPTABLE_RISK
            ) * 2

    print("Step 2 completed: Safe graph created.")

    print("Available roads:", list(safe_graph.edges()))

    print("Road safety decisions:", [
        (
            u,
            v,
            edge["rule_decision"],
            edge["ai_risk_percent"]
        )
        for u, v, edge in graph.edges(data=True)
    ])

    # -----------------------------------------------------
    # STEP 3: CHECK CONNECTIVITY
    # -----------------------------------------------------

    if start == destination:

        route_results = [
            build_route_details(graph, [start], 1)
        ]

        recommended_route = route_results[0]

        return {
            "algorithm": "A* Search + K Shortest Simple Paths",
            "agent_decision": goal_based_agent(
                start,
                destination,
                recommended_route
            ),
            "recommended_route": recommended_route,
            "all_routes": route_results
        }

    if not nx.has_path(safe_graph, start, destination):

        print("No connected route exists.")

        return {
            "error": (
                "No safe route is available "
                "between these locations."
            )
        }

    print("Step 3 completed: A route exists.")

    # -----------------------------------------------------
    # STEP 4: A* HEURISTIC
    # -----------------------------------------------------

    distance_map = nx.single_source_dijkstra_path_length(
        safe_graph,
        destination,
        weight="distance"
    )

    def heuristic(node, goal):

        return distance_map.get(node, 0) * 0.4

    print("Step 4 completed: Heuristic prepared.")

    # -----------------------------------------------------
    # STEP 5: FIND BEST ROUTE USING A*
    # -----------------------------------------------------

    try:

        best_path = nx.astar_path(
            safe_graph,
            start,
            destination,
            heuristic=heuristic,
            weight="route_cost"
        )

        print("A* completed. Best path:", best_path)

    except nx.NetworkXNoPath:

        return {
            "error": (
                "No safe route is available "
                "between these locations."
            )
        }

    # -----------------------------------------------------
    # STEP 6: FIND UP TO 3 ALTERNATIVE ROUTES
    # -----------------------------------------------------

    all_paths = []

    try:

        path_generator = nx.shortest_simple_paths(
            safe_graph,
            start,
            destination,
            weight="route_cost"
        )

        for path in path_generator:

            all_paths.append(path)

            print("Alternative path found:", path)

            if len(all_paths) >= 3:
                break

    except nx.NetworkXNoPath:

        return {
            "error": (
                "No safe route is available "
                "between these locations."
            )
        }

    # Ensure A* route is included.
    if best_path not in all_paths:

        all_paths.append(best_path)

    print("Step 6 completed: Alternative routes generated.")

    # -----------------------------------------------------
    # STEP 7: BUILD ROUTE DETAILS
    # -----------------------------------------------------

    route_results = []

    for index, path in enumerate(all_paths, start=1):

        route_data = build_route_details(
            graph,
            path,
            index
        )

        route_results.append(route_data)

    print("Step 7 completed: Route details calculated.")

    # -----------------------------------------------------
    # STEP 8: SORT ROUTES BY COST
    # -----------------------------------------------------

    route_results.sort(
        key=lambda route: route["route_score"]
    )

    # Assign final rankings.
    for index, route in enumerate(route_results, start=1):

        route["rank"] = index

    print("Step 8 completed: Routes ranked.")

    # -----------------------------------------------------
    # STEP 9: SELECT RECOMMENDED ROUTE
    # -----------------------------------------------------

    recommended_route = route_results[0]

    print(
        "Recommended route:",
        recommended_route["route"]
    )

    # -----------------------------------------------------
    # STEP 10: GOAL-BASED AGENT DECISION
    # -----------------------------------------------------

    agent_decision = goal_based_agent(
        start,
        destination,
        recommended_route
    )

    print("Step 10 completed: Agent decision generated.")

    # -----------------------------------------------------
    # FINAL RESPONSE
    # -----------------------------------------------------

    print("========== ROUTE CALCULATION COMPLETED ==========\n")

    return {
        "algorithm": "A* Search + K Shortest Simple Paths",
        "agent_decision": agent_decision,
        "recommended_route": recommended_route,
        "all_routes": route_results
    }
