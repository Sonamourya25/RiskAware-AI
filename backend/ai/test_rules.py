
from rule_engine import apply_safety_rules

# Test road information
road = {
    "rainfall": 90,
    "slope": 25,
    "road_condition": 3,
    "flood_risk": 1,
    "traffic": 3,
    "incidents": 5
}

result = apply_safety_rules(road)

print("Rule-Based Decision:")
print(result)
