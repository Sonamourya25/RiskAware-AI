import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import joblib


# -----------------------------
# 1. Create training dataset
# -----------------------------

data = {
    "rainfall": [
        10, 20, 30, 40, 50,
        60, 70, 80, 90, 100,
        15, 25, 35, 45, 55,
        65, 75, 85, 95, 110
    ],

    "slope": [
        5, 8, 10, 12, 15,
        18, 20, 22, 25, 30,
        6, 9, 11, 14, 16,
        19, 21, 24, 28, 35
    ],

    "road_condition": [
        1, 1, 1, 2, 2,
        2, 2, 3, 3, 3,
        1, 1, 2, 2, 2,
        3, 3, 3, 3, 3
    ],

    "flood_risk": [
        0, 0, 0, 0, 0,
        0, 1, 1, 1, 1,
        0, 0, 0, 0, 1,
        1, 1, 1, 1, 1
    ],

    "traffic": [
        1, 1, 2, 2, 2,
        2, 3, 3, 3, 3,
        1, 2, 2, 2, 3,
        3, 3, 3, 3, 3
    ],

    "past_incidents": [
        0, 0, 1, 1, 1,
        2, 2, 2, 3, 4,
        0, 1, 1, 2, 2,
        3, 3, 4, 4, 5
    ],

    "risk": [
        0, 0, 0, 0, 0,
        1, 1, 1, 2, 2,
        0, 0, 0, 1, 1,
        1, 2, 2, 2, 2
    ]
}


df = pd.DataFrame(data)


# -----------------------------
# 2. Separate features/target
# -----------------------------

X = df[
    [
        "rainfall",
        "slope",
        "road_condition",
        "flood_risk",
        "traffic",
        "past_incidents"
    ]
]

y = df["risk"]


# -----------------------------
# 3. Split dataset
# -----------------------------

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)


# -----------------------------
# 4. Train Random Forest
# -----------------------------

model = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)

model.fit(X_train, y_train)


# -----------------------------
# 5. Test the model
# -----------------------------

predictions = model.predict(X_test)

accuracy = accuracy_score(y_test, predictions)

print("Model trained successfully!")
print("Model Accuracy:", round(accuracy * 100, 2), "%")


# -----------------------------
# 6. Save the trained model
# -----------------------------

joblib.dump(model, "risk_model.pkl")

print("Model saved as risk_model.pkl") 