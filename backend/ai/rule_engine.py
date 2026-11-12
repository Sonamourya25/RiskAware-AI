
# RULE-BASED REASONING ENGINE

def apply_safety_rules(edge):

    rainfall = edge["rainfall"]
    road_condition = edge["road_condition"]
    flood_risk = edge["flood_risk"]
    traffic = edge["traffic"]
    incidents = edge["incidents"]

    decision = "SAFE"
    penalty = 0
    warnings = []

    # Rule 1: Extremely high rainfall
    if rainfall >= 90:
        decision = "HIGH CAUTION"
        penalty += 30
        warnings.append("Very high rainfall")

    # Rule 2: High flood risk and poor road
    if flood_risk == 1 and road_condition == 3:
        decision = "HIGH CAUTION"
        penalty += 60
        warnings.append("High flood risk and poor road condition")

    # Rule 3: Heavy traffic
    if traffic == 3:
        if decision != "AVOID":
            decision = "HIGH CAUTION"
        penalty += 20
        warnings.append("Heavy traffic")

    # Rule 4: Multiple previous incidents
    if incidents >= 4:
        if decision != "AVOID":
            decision = "HIGH CAUTION"
        penalty += 25
        warnings.append("Multiple previous incidents")

    # Rule 5: Poor road condition
    if road_condition == 3:
        if decision != "AVOID":
            decision = "HIGH CAUTION"
        penalty += 20
        warnings.append("Poor road condition")

    return {
        "decision": decision,
        "penalty": penalty,
        "warnings": warnings
    }
