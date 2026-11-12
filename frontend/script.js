let availableComparisonRoutes = [];

// ============================================
// RISK AWARE AI - FRONTEND JAVASCRIPT
// ============================================

const API_URL = "http://127.0.0.1:8000";

// ============================================
// CURRENT DASHBOARD CONTEXT FOR CHATBOT
// ============================================

let currentDashboardContext = {
    route_status: "Not calculated yet",
    start: null,
    destination: null,
    emergency: "None",
    affected_road: null,
    closed_road: null,
    recommended_route: null,
    distance_km: null,
    time_minutes: null,
    risk_score: null,
    route_score: null,
    warnings: []
};


// ============================================
// CHECK BACKEND CONNECTION
// ============================================

async function checkServer() {

    const statusText = document.getElementById("serverStatus");
    const statusDot = document.querySelector(".status-dot");

    try {

        const response = await fetch(`${API_URL}/health`);

        if (!response.ok) {
            throw new Error("Server error");
        }

        statusText.textContent = "Backend Connected";
        statusDot.style.background = "#22c55e";

    } catch (error) {

        statusText.textContent = "Backend Disconnected";
        statusDot.style.background = "#ef4444";

    }
}


// ============================================
// FIND BEST ROUTE
// ============================================

function updateEmergencyAlert(disruptionType, roadFrom, roadTo) {

    const alertBox = document.getElementById("emergencyAlertMessage");

    if (!alertBox) return;

    if (!disruptionType) {

        alertBox.classList.remove("active-alert");

        alertBox.textContent =
            "No active emergencies. All simulated roads are operating normally.";

        return;
    }

    const road = `${roadFrom} → ${roadTo}`;

    const alerts = {

        flood:
            `🌊 FLOOD WARNING: Road ${road} has high flood risk. The route planner will seek a safer alternative.`,

        accident:
            `🚨 ACCIDENT ALERT: An accident has been reported on road ${road}. The route planner will evaluate the increased risk.`,

        road_closure:
            `⛔ ROAD CLOSURE: Road ${road} is marked as blocked and will be avoided.`,

        heavy_rainfall:
            `🌧️ HEAVY RAINFALL WARNING: Road ${road} has increased weather-related risk. A safer alternative will be evaluated.`

    };

    alertBox.classList.add("active-alert");

    alertBox.textContent =
        alerts[disruptionType] || "⚠️ Emergency condition selected.";
}

async function getBestRoute() {

    const start = document.getElementById("start").value;
    const destination = document.getElementById("destination").value;

    console.log("Selected Starting Point:", start);
    console.log("Selected Destination:", destination);

    const button = document.getElementById("routeButton");
    const message = document.getElementById("routeMessage");
    const results = document.getElementById("routeResults");

    if (start === destination) {

        message.textContent =
            "Starting point and destination cannot be the same.";

        return;
    }

    button.disabled = true;
    button.textContent = "Finding Route...";

    message.textContent = "Connecting to AI route planner...";

    results.textContent = "Calculating the recommended route...";


    // Clear old chatbot history when calculating a new route
    chatHistory = [];


    // Reset dashboard context for the new calculation
    currentDashboardContext = {

        route_status: "Route calculation in progress",

        start: start,

        destination: destination,

        emergency: "None",

        affected_road: null,

        closed_road: null,

        recommended_route: null,

        distance_km: null,

        time_minutes: null,

        risk_score: null,

        route_score: null,

        warnings: []

    };


    // Get emergency information
    const disruptionType =
        document.getElementById("disruptionType").value;

    const roadFrom =
        document.getElementById("roadFrom").value;

    const roadTo =
        document.getElementById("roadTo").value;

    // Update Emergency Alert Center
    updateEmergencyAlert(
        disruptionType,
        roadFrom,
        roadTo
    );

    try {

        // Prepare API parameters
        const params = new URLSearchParams({

            start: start,

            destination: destination

        });


        // Add emergency parameters if selected
        if (disruptionType) {

            if (roadFrom === roadTo) {

                throw new Error(
                    "Affected road locations must be different."
                );

            }

            params.append("disruption_type", disruptionType);

            params.append("road_from", roadFrom);

            params.append("road_to", roadTo);

        }


        // Send request to FastAPI
        const response = await fetch(
            `${API_URL}/best-route?${params.toString()}`
        );

        const data = await response.json();


        // =====================================
        // HANDLE NO SAFE ROUTE
        // =====================================

        if (!response.ok || data.error) {

            const errorMessage =
                data.error ||
                data.detail ||
                "Unable to find route.";


            // Save latest failed route information
            currentDashboardContext = {

                route_status: "No acceptable safe route available",

                start: start,

                destination: destination,

                emergency: disruptionType || "None",

                affected_road: disruptionType
                    ? `${roadFrom} → ${roadTo}`
                    : null,

                closed_road: disruptionType &&
                    disruptionType.toLowerCase().includes("clos")
                    ? `${roadFrom} → ${roadTo}`
                    : null,

                recommended_route: null,

                distance_km: null,

                time_minutes: null,

                risk_score: null,

                route_score: null,

                warnings: [errorMessage],

                chatbot_instruction:
                    "The latest route calculation failed. Do not describe an older recommended route as current. State the affected road from affected_road or closed_road. If closed_road is present, identify it explicitly. Explain that no route met the backend safety rules."

            };


            // Reset dashboard analytics
            resetAnalytics();


            // Clear previous route comparison
            displayRouteComparison([]);


            // Clear previous road network
            drawRoadNetwork([]);


            // Update map to show disrupted road
            updateLpuMap(
                [],
                disruptionType,
                roadFrom,
                roadTo
            );


            // Display error message
            results.innerHTML = `

                <div class="warning">

                    <strong>⚠️ Route Not Available</strong>

                    <p>${errorMessage}</p>

                    <p>
                        Please change your starting point,
                        destination, or emergency conditions.
                    </p>

                </div>

            `;


            document.getElementById("routeComparison").innerHTML =
                `<div class="empty-state">${errorMessage}</div>`;


            document.getElementById("roadNetwork").innerHTML =
                `<p class="empty-state">${errorMessage}</p>`;


            message.textContent = "No acceptable route found.";

            return;

        }


        // =====================================
        // HANDLE SUCCESSFUL ROUTE
        // =====================================

        const route = data.recommended_route;

        const agent = data.agent_decision;


        // Save latest successful route information
        currentDashboardContext = {

            route_status: "Route found",

            start: start,

            destination: destination,

            emergency: disruptionType || "None",

            affected_road: disruptionType
                ? `${roadFrom} → ${roadTo}`
                : null,

            closed_road: disruptionType &&
                disruptionType.toLowerCase().includes("clos")
                ? `${roadFrom} → ${roadTo}`
                : null,

            recommended_route: route?.route || null,

            distance_km: route?.distance_km ?? null,

            time_minutes: route?.time_minutes ?? null,

            risk_score: route?.ai_risk_percent ?? null,

            route_score: route?.route_score ?? null,

            warnings: route?.warnings || [],

            chatbot_instruction:
                "Use this latest route result. Do not substitute the default project route."

        };


        // Update dashboard analytics
        updateAnalytics(data.all_routes);


        // Display route comparison
        displayRouteComparison(data.all_routes);


        if (!route) {

            throw new Error(
                "No recommended route was returned."
            );

        }

        // =====================================
// UPDATE VEHICLE TRACKING ROUTE
// =====================================

// Stop previous vehicle movement if running
if (vehicleTimer !== null) {
    clearInterval(vehicleTimer);
    vehicleTimer = null;
}

// Use the AI recommended route
vehicleRoute = route.route;

vehicleEstimatedTime = route.time_minutes;

document.getElementById("vehicleETA").textContent =
    vehicleEstimatedTime + " minutes";

// Reset vehicle position
vehicleStep = 0;

vehicleStatus.textContent = "Ready to start";

vehicleLocation.textContent = vehicleRoute[0];

// Reset delivery progress
document.getElementById("vehicleProgressBar").style.width = "0%";

document.getElementById("vehicleProgressText").textContent = "0%";

// Reset next stop
document.getElementById("vehicleNextStop").textContent =
    vehicleRoute[1] || "Destination reached";

// Reset estimated delivery time
document.getElementById("vehicleETA").textContent =
    vehicleEstimatedTime + " minutes";

// Move truck marker to the starting location
vehicleMarker.setLatLng(lpuNodes[vehicleRoute[0]]);

// Show the starting location on the map
lpuMap.panTo(lpuNodes[vehicleRoute[0]]);


        // Draw recommended road network
        drawRoadNetwork(route.route);


        // Update interactive LPU map
        updateLpuMap(
            route.route,
            disruptionType,
            roadFrom,
            roadTo
        );


        // =====================================
        // DISPLAY RECOMMENDED ROUTE
        // =====================================

        results.innerHTML = `

            <div class="result-grid">

                <div class="result-card">

                    <small>Total Distance</small>

                    <strong>
                        ${route.distance_km} km
                    </strong>

                </div>


                <div class="result-card">

                    <small>Estimated Time</small>

                    <strong>
                        ${route.time_minutes} min
                    </strong>

                </div>


                <div class="result-card">

                    <small>AI Risk Score</small>

                    <strong>
                        ${route.ai_risk_percent}/100
                    </strong>

                </div>

            </div>


            <div class="route-path">

                <strong>Recommended Path:</strong>

                <br>

                ${route.route.join(" → ")}

            </div>


            <div class="route-path">

                <strong>Goal-Based Agent</strong>

                <br>

                Goal: ${agent.goal}

                <br>

                Status: ${agent.status}

                <br>

                Action: ${agent.action}

            </div>


            <div class="route-path">

                <strong>Route Score:</strong>

                ${route.route_score}

            </div>


            <h4 style="margin-top:18px;">
                Road Safety Analysis
            </h4>


            ${route.road_details.map(road => `

                <div class="route-path">

                    <strong>
                        ${road.from} → ${road.to}
                    </strong>

                    <br>

                    Risk Score: ${road.risk}/100

                    <br>

                    Safety Decision:

                    <span class="${
                        road.decision === "SAFE"
                            ? "success"
                            : "danger"
                    }">

                        ${road.decision}

                    </span>

                    <br>

                    Rule Penalty: ${road.penalty}

                    ${
                        road.warnings.length
                            ? `<br>Warnings: ${road.warnings.join(", ")}`
                            : "<br>No safety warnings"
                    }

                </div>

            `).join("")}


            ${
                route.warnings.length

                    ? `<div class="warning">

                        <strong>Route Warnings:</strong>

                        <br>

                        ${route.warnings.join("<br>")}

                       </div>`

                    : `<p class="success" style="margin-top:15px;">

                        No safety warnings on the recommended route.

                       </p>`
            }

        `;


        message.textContent =
            "Route planning completed successfully.";


    } catch (error) {

        console.error("Route error:", error);


        // Save error information for chatbot
        currentDashboardContext = {

            route_status: "Route calculation error",

            start: start,

            destination: destination,

            emergency: disruptionType || "None",

            affected_road: disruptionType
                ? `${roadFrom} → ${roadTo}`
                : null,

            closed_road: disruptionType &&
                disruptionType.toLowerCase().includes("clos")
                ? `${roadFrom} → ${roadTo}`
                : null,

            recommended_route: null,

            distance_km: null,

            time_minutes: null,

            risk_score: null,

            route_score: null,

            warnings: [error.message],

            chatbot_instruction:
                "The latest route calculation encountered an error. Do not report an older route as current."

        };


        chatHistory = [];


        results.innerHTML = `

            <div class="warning">

                <strong>Route Error</strong>

                <p>${error.message}</p>

            </div>

        `;


        message.textContent =
            "Could not calculate the route.";


    } finally {

        button.disabled = false;

        button.textContent = "Find Best Route";

    }

}

// Predict road risk using Machine Learning
async function predictRisk() {
    const rainfall = document.getElementById("rainfall").value;
    const slope = document.getElementById("slope").value;
    const roadCondition = document.getElementById("roadCondition").value;
    const floodRisk = document.getElementById("floodRisk").value;
    const traffic = document.getElementById("traffic").value;
    const incidents = document.getElementById("incidents").value;

    const button = document.getElementById("riskButton");
    const message = document.getElementById("riskMessage");
    const results = document.getElementById("riskResults");

    const values = [rainfall, slope, incidents];

    if (values.some(value => value.trim() === "")) {
        message.textContent = "Please fill in all numeric fields.";
        return;
    }

    if (
        Number(rainfall) < 0 || Number(rainfall) > 100 ||
        Number(slope) < 0 || Number(slope) > 100 ||
        Number(incidents) < 0
    ) {
        message.textContent = "Enter valid values within the specified ranges.";
        return;
    }

    button.disabled = true;
    button.textContent = "Predicting...";
    message.textContent = "Machine Learning model is predicting...";
    results.textContent = "Analyzing road conditions...";

    try {
        const params = new URLSearchParams({
            rainfall: rainfall,
            slope: slope,
            road_condition: roadCondition,
            flood_risk: floodRisk,
            traffic: traffic,
            past_incidents: incidents
        });

        const response = await fetch(
            `${API_URL}/predict-risk?${params.toString()}`,
            { method: "POST" }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Risk prediction failed.");
        }

        let riskClass = "success";

        if (data.risk_level === "HIGH") {
            riskClass = "danger";
        } else if (data.risk_level === "MEDIUM") {
            riskClass = "";
        }

        results.innerHTML = `
            <div class="result-grid">
                <div class="result-card">
                    <small>Predicted Risk Level</small>
                    <strong class="${riskClass}">
                        ${data.risk_level}
                    </strong>
                </div>

                <div class="result-card">
                    <small>Predicted Class</small>
                    <strong>${data.risk_value}</strong>
                </div>
            </div>

            <div class="route-path">
                <strong>Analysis Result</strong><br>
                The Random Forest model classified the entered road
                conditions as ${data.risk_level} risk.
            </div>

            <p style="margin-top:12px; font-size:12px; color:#64748b;">
                Academic prototype: this is a model classification,
                not a calibrated real-world risk probability.
            </p>
        `;

        message.textContent = "Risk prediction completed successfully.";

    } catch (error) {
        results.textContent = error.message;
        message.textContent = "Could not predict risk.";
    } finally {
        button.disabled = false;
        button.textContent = "Predict Risk";
    }
}


// Run when page loads
// Check backend connection when dashboard loads
checkServer();

// Refresh connection status every 5 seconds
setInterval(checkServer, 5000);


// Draw the interactive road network
function drawRoadNetwork(route) {

    const container = document.getElementById("roadNetwork");

    // Positions of all locations
    const nodes = {
        Warehouse: { x: 45, y: 150 },
        A: { x: 145, y: 55 },
        B: { x: 145, y: 245 },
        C: { x: 275, y: 55 },
        D: { x: 275, y: 245 },
        Hospital: { x: 375, y: 150 }
    };

    // Existing roads in your backend graph
    const roads = [
        ["Warehouse", "A"],
        ["Warehouse", "B"],
        ["A", "C"],
        ["B", "C"],
        ["A", "D"],
        ["C", "D"],
        ["B", "D"],
        ["C", "Hospital"],
        ["D", "Hospital"]
    ];

    const routeEdges = new Set();

    // Identify the roads belonging to the recommended route
    for (let i = 0; i < route.length - 1; i++) {
        const key = [route[i], route[i + 1]].sort().join("-");
        routeEdges.add(key);
    }

    // Draw all roads
    const roadLines = roads.map(([from, to]) => {

        const start = nodes[from];
        const end = nodes[to];

        const key = [from, to].sort().join("-");
        const isRecommended = routeEdges.has(key);

        return `
            <line
                x1="${start.x}"
                y1="${start.y}"
                x2="${end.x}"
                y2="${end.y}"
                class="road-line ${isRecommended ? "recommended" : ""}"
            />
        `;
    }).join("");

    // Highlight locations on the selected route
    const activeNodes = new Set(route);

    const roadNodes = Object.entries(nodes).map(([name, position]) => {

        const active = activeNodes.has(name);

        return `
            <circle
                cx="${position.x}"
                cy="${position.y}"
                r="10"
                class="road-node ${active ? "active" : ""}"
            />

            <text
                x="${position.x}"
                y="${position.y + 25}"
                class="node-label"
            >
                ${name}
            </text>
        `;
    }).join("");

    container.innerHTML = `
        <svg viewBox="0 0 420 310"
             role="img"
             aria-label="Road network with recommended route highlighted">

            ${roadLines}
            ${roadNodes}

        </svg>
    `;
}


// Display all available route options
function displayRouteComparison(routes) {

    const container = document.getElementById("routeComparison");

    if (!container) {
        console.error("Route comparison container not found!");
        return;
    }

    if (!routes || routes.length === 0) {
        availableComparisonRoutes = [];
        container.textContent = "No alternative routes available.";
        return;
    }

    // Store all available routes
    availableComparisonRoutes = routes;

    // Create route cards
    container.innerHTML = routes.map((route, index) => {

        const isRecommended = index === 0;

        return `
            <div class="route-option ${isRecommended ? "recommended" : ""}"
                 data-route-index="${index}"
                 style="cursor: pointer;">

                <span class="route-rank">
                    ${isRecommended ? "RECOMMENDED ROUTE" : `RANK ${route.rank}`}
                </span>

                <h4>Route ${route.rank}</h4>

                <div class="route-path">
                    <strong>Path:</strong><br>
                    ${route.route.join(" → ")}
                </div>

                <div class="result-grid">

                    <div class="result-card">
                        <small>Distance</small>
                        <strong>${route.distance_km} km</strong>
                    </div>

                    <div class="result-card">
                        <small>Estimated Time</small>
                        <strong>${route.time_minutes} min</strong>
                    </div>

                    <div class="result-card">
                        <small>AI Risk Score</small>
                        <strong>${route.ai_risk_percent}/100</strong>
                    </div>

                </div>

                <div class="route-path">
                    <strong>Route Score:</strong> ${route.route_score}
                </div>

                <div class="route-path">
                    <strong>Safety:</strong>
                    ${route.warnings && route.warnings.length
                        ? route.warnings.join(", ")
                        : "No safety warnings"}
                </div>

                <p>
                    <strong>Click to highlight this route on the road network.</strong>
                </p>

            </div>
        `;

    }).join("");


    // Make route cards clickable
    container.querySelectorAll(".route-option").forEach(card => {

        card.addEventListener("click", function () {

            const index = Number(this.dataset.routeIndex);
            const selectedRoute = availableComparisonRoutes[index];

            if (!selectedRoute) return;

            // Highlight selected route
            drawRoadNetwork(selectedRoute.route);

            // Update selected card appearance
            container.querySelectorAll(".route-option").forEach(item => {
                item.classList.remove("selected-route");
            });

            this.classList.add("selected-route");

        });

    });


    // Highlight the first route by default
    drawRoadNetwork(routes[0].route);

    container.querySelector(".route-option")?.classList.add("selected-route");
}



// =================================
// ANALYTICS DASHBOARD
// =================================

let routeChartInstance = null;
let riskChartInstance = null;

function updateAnalytics(routes) {

    if (!routes || routes.length === 0) return;

    // Calculate dashboard statistics
    const totalRoutes = routes.length;

    const safeRoutes = routes.filter(route =>
        route.warnings.length === 0
    ).length;

    const highRiskRoutes = routes.filter(route =>
        route.ai_risk_percent >= 70 ||
        route.warnings.length > 0
    ).length;

    const averageRisk = routes.reduce(
        (total, route) => total + route.ai_risk_percent, 0
    ) / totalRoutes;

    document.getElementById("routesEvaluated").textContent =
        totalRoutes;

    document.getElementById("safeRoutes").textContent =
        safeRoutes;

    document.getElementById("highRiskRoutes").textContent =
        highRiskRoutes;

    document.getElementById("averageRisk").textContent =
        averageRisk.toFixed(1) + "/100";


    // Route score comparison
    const routeLabels = routes.map(route =>
        "Route " + route.rank
    );

    const routeScores = routes.map(route =>
        route.route_score
    );

    if (routeChartInstance) {
        routeChartInstance.destroy();
    }

    routeChartInstance = new Chart(
        document.getElementById("routeChart"),
        {
            type: "bar",
            data: {
                labels: routeLabels,
                datasets: [{
                    label: "Route Score",
                    data: routeScores,
                    backgroundColor: [
                        "#16a34a",
                        "#0d9488",
                        "#64748b"
                    ],
                    borderRadius: 8,
                    barThickness: 35
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "Route Score"
                        }
                    }
                }
            }
        }
    );


    // Road risk distribution
    const roadSegments = routes.flatMap(route =>
        route.road_details || []
    );

    const uniqueRoads = new Map();

    roadSegments.forEach(road => {

        const key = [road.from, road.to]
            .sort()
            .join("-");

        // Count each physical road only once
        if (!uniqueRoads.has(key)) {
            uniqueRoads.set(key, road);
        }
    });

    const roads = [...uniqueRoads.values()];

    const lowRisk = roads.filter(road =>
        road.risk < 40
    ).length;

    const mediumRisk = roads.filter(road =>
        road.risk >= 40 && road.risk < 70
    ).length;

    const highRisk = roads.filter(road =>
        road.risk >= 70
    ).length;

    if (riskChartInstance) {
        riskChartInstance.destroy();
    }

    riskChartInstance = new Chart(
        document.getElementById("riskChart"),
        {
            type: "doughnut",
            data: {
                labels: [
                    "Low Risk",
                    "Medium Risk",
                    "High Risk"
                ],
                datasets: [{
                    data: [
                        lowRisk,
                        mediumRisk,
                        highRisk
                    ],
                    backgroundColor: [
                        "#16a34a",
                        "#f59e0b",
                        "#dc2626"
                    ],
                    borderWidth: 2,
                    borderColor: "#ffffff"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom"
                    }
                }
            }
        }
    );
}


// =================================
// RESET DASHBOARD ANALYTICS
// =================================

function resetAnalytics() {

    document.getElementById("routesEvaluated").textContent = "0";

    document.getElementById("safeRoutes").textContent = "0";

    document.getElementById("highRiskRoutes").textContent = "0";

    document.getElementById("averageRisk").textContent = "N/A";


    // Clear previous route score chart
    if (routeChartInstance) {
        routeChartInstance.destroy();
        routeChartInstance = null;
    }

    // Clear previous road risk chart
    if (riskChartInstance) {
        riskChartInstance.destroy();
        riskChartInstance = null;
    }
}


// =====================================
// LPU INTERACTIVE DELIVERY MAP
// =====================================

// Approximate LPU campus center
const lpuCenter = [31.2559, 75.7033];

// Create map
const lpuMap = L.map("lpuMap").setView(lpuCenter, 16);

// Load OpenStreetMap
L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution:
            '&copy; OpenStreetMap contributors'
    }
).addTo(lpuMap);

// Demo delivery locations
const lpuNodes = {
    "Warehouse": [31.2559, 75.7033],
    "A": [31.2570, 75.7045],
    "B": [31.2548, 75.7050],
    "C": [31.2560, 75.7060],
    "D": [31.2538, 75.7038],
    "Hospital": [31.2550, 75.7018]
};

// Add location markers
Object.entries(lpuNodes).forEach(([name, coordinates]) => {

    L.marker(coordinates)
        .addTo(lpuMap)
        .bindPopup(`<b>${name}</b><br>Demo delivery location`);

});

// Sample road connections
const lpuRoads = [
    ["Warehouse", "A"],
    ["Warehouse", "B"],
    ["A", "C"],
    ["B", "C"],
    ["A", "D"],
    ["C", "D"],
    ["B", "D"],
    ["C", "Hospital"],
    ["D", "Hospital"]
];

// Store road layers so we can update their colours
const lpuRoadLayers = {};

// Draw roads
lpuRoads.forEach(([from, to]) => {

    const roadKey = [from, to].sort().join("-");

    const roadLine = L.polyline(
        [lpuNodes[from], lpuNodes[to]],
        {
            color: "#64748b",
            weight: 4,
            opacity: 0.7
        }
    ).addTo(lpuMap);

    lpuRoadLayers[roadKey] = roadLine;

});

// Fit map around all demo locations
lpuMap.fitBounds(
    L.latLngBounds(Object.values(lpuNodes)),
    { padding: [30, 30] }
);


// =====================================
// UPDATE LPU MAP WITH AI ROUTE
// =====================================


function updateLpuMap(route, disruptionType, roadFrom, roadTo) {

    // 1. Reset all roads to grey
    Object.values(lpuRoadLayers).forEach(road => {
        road.setStyle({
            color: "#64748b",
            weight: 4,
            opacity: 0.7,
            dashArray: null
        });
    });

    const highlightedCoordinates = [];

    // 2. Highlight recommended route in green
    if (route && route.length > 1) {

        for (let i = 0; i < route.length - 1; i++) {

            const roadKey = [
                route[i],
                route[i + 1]
            ].sort().join("-");

            const road = lpuRoadLayers[roadKey];

            if (road) {
                road.setStyle({
                    color: "#16a34a",
                    weight: 7,
                    opacity: 1,
                    dashArray: null
                });
            }
        }

        route.forEach(location => {
            if (lpuNodes[location]) {
                highlightedCoordinates.push(
                    lpuNodes[location]
                );
            }
        });
    }

    // 3. Highlight affected road in red
    if (
        disruptionType &&
        disruptionType.toLowerCase() !== "none" &&
        roadFrom &&
        roadTo &&
        roadFrom !== roadTo
    ) {

        const disruptedKey = [
            roadFrom,
            roadTo
        ].sort().join("-");

        const disruptedRoad = lpuRoadLayers[disruptedKey];

        if (disruptedRoad) {

            disruptedRoad.setStyle({
                color: "#dc2626",
                weight: 8,
                opacity: 1,
                dashArray: "8, 8"
            });

            [roadFrom, roadTo].forEach(location => {
                if (lpuNodes[location]) {
                    highlightedCoordinates.push(
                        lpuNodes[location]
                    );
                }
            });
        }
    }

    // 4. Fit map to recommended route and affected road
    if (highlightedCoordinates.length > 0) {

        lpuMap.fitBounds(
            L.latLngBounds(highlightedCoordinates),
            { padding: [40, 40] }
        );
    }
}




// ==============================
// AI CHATBOT FUNCTIONALITY
// ==============================

const chatbotToggle = document.getElementById("chatbotToggle");
const chatbotWindow = document.getElementById("chatbotWindow");
const closeChatbot = document.getElementById("closeChatbot");

const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendChat = document.getElementById("sendChat");

// Store previous conversation
let chatHistory = [];

// Open chatbot
chatbotToggle.addEventListener("click", () => {
    chatbotWindow.classList.toggle("hidden");
    chatInput.focus();
});

// Close chatbot
closeChatbot.addEventListener("click", () => {
    chatbotWindow.classList.add("hidden");
});

// Display a message
function appendChatMessage(message, sender) {

    const messageDiv = document.createElement("div");

    messageDiv.classList.add(`${sender}-message`);

    messageDiv.textContent = message;

    chatMessages.appendChild(messageDiv);

    chatMessages.scrollTop = chatMessages.scrollHeight;

    return messageDiv;
}

// Send message to AI
async function sendChatMessage() {

    const message = chatInput.value.trim();

    if (!message) {
        return;
    }

    // Display user message
    appendChatMessage(message, "user");

    chatInput.value = "";

    sendChat.disabled = true;

    // Show thinking message
    const typingMessage = appendChatMessage(
        "Thinking...",
        "bot"
    );

    try {

        // Debug: inspect the exact dashboard state sent to FastAPI.
        console.log("RiskAware AI chatbot context:", currentDashboardContext);

        const response = await fetch(`${API_URL}/chat`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                message: message,
                history: chatHistory,
                context: currentDashboardContext
            })

        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail || "Chat request failed."
            );
        }

        const reply = data.reply || "No response received.";

        // Remove thinking message
        typingMessage.remove();

        // Display AI response
        appendChatMessage(reply, "bot");

        // Save conversation history
        chatHistory.push(
            { role: "user", content: message },
            { role: "assistant", content: reply }
        );

        // Keep only recent messages
        chatHistory = chatHistory.slice(-10);

    }

    catch (error) {

        typingMessage.remove();

        appendChatMessage(
            "Sorry! I couldn't connect to the AI assistant. Please check whether the backend and Ollama are running.",
            "bot"
        );

        console.error("Chatbot Error:", error);

    }

    finally {

        sendChat.disabled = false;

        chatInput.focus();

    }
}

// Send button
sendChat.addEventListener("click", sendChatMessage);

// Send using Enter key
chatInput.addEventListener("keydown", (event) => {

    if (event.key === "Enter") {
        sendChatMessage();
    }

});


// FIELD REPORT SYSTEM

const fieldReportForm = document.getElementById("fieldReportForm");
const fieldReportList = document.getElementById("fieldReportList");
const fieldReportMessage = document.getElementById("fieldReportMessage");

// Load previously saved reports
let fieldReports = JSON.parse(
    localStorage.getItem("riskAwareFieldReports") || "[]"
);

function displayFieldReports() {
    fieldReportList.innerHTML = "";

    if (fieldReports.length === 0) {
        fieldReportList.textContent = "No field reports submitted yet.";
        return;
    }

    fieldReports.forEach((report) => {
        const card = document.createElement("div");
        card.className = "field-report-card";

        const heading = document.createElement("h4");
        heading.textContent = report.type;

        const road = document.createElement("p");
        road.textContent = `Road: ${report.from} → ${report.to}`;

        const description = document.createElement("p");
        description.textContent = report.description;

        const date = document.createElement("small");
        date.textContent = report.date;

        card.append(heading, road, description, date);
        fieldReportList.appendChild(card);
    });
}

fieldReportForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const type = document.getElementById("reportType").value;
    const from = document.getElementById("reportRoadFrom").value;
    const to = document.getElementById("reportRoadTo").value;
    const description = document.getElementById("reportDescription").value.trim();

    if (from === to) {
        fieldReportMessage.textContent =
            "Please select two different locations.";
        return;
    }

    const report = {
        type: type,
        from: from,
        to: to,
        description: description,
        date: new Date().toLocaleString()
    };

    fieldReports.unshift(report);

    try {
        localStorage.setItem(
            "riskAwareFieldReports",
            JSON.stringify(fieldReports)
        );
    } catch (error) {
        fieldReports.shift();
        fieldReportMessage.textContent =
            "Could not save the report in this browser.";
        return;
    }

    displayFieldReports();

// Update Emergency Alert Center
const alertBox = document.getElementById("emergencyAlertMessage");

if (alertBox) {
    alertBox.classList.add("active-alert");

    alertBox.textContent =
        `🚨 FIELD REPORT ALERT: ${type} reported on road ${from} → ${to}. ${description}`;
}

fieldReportMessage.textContent = "Field report submitted successfully!";

fieldReportForm.reset();
});

// Display saved reports when the page opens
displayFieldReports();




// =====================================
// VEHICLE TRACKING SYSTEM
// =====================================

let vehicleTimer = null;
let vehicleStep = 0;
let vehicleEstimatedTime = null;

const vehicleStatus = document.getElementById("vehicleStatus");
const vehicleLocation = document.getElementById("vehicleLocation");
const startTrackingBtn = document.getElementById("startTrackingBtn");
const stopTrackingBtn = document.getElementById("stopTrackingBtn");

// Demo delivery route
let vehicleRoute = [
    "Warehouse",
    "A",
    "C",
    "Hospital"
];
// Create a moving vehicle marker on the LPU map
const vehicleMarker = L.marker(lpuNodes["Warehouse"], {
    title: "Vehicle VAN-001",
    icon: L.divIcon({
        html: "🚚",
        className: "vehicle-map-icon",
        iconSize: [35, 35],
        iconAnchor: [17, 17]
    })
}).addTo(lpuMap);

vehicleMarker.bindPopup("🚚 Vehicle VAN-001");

// Start vehicle tracking
startTrackingBtn.addEventListener("click", function () {

    if (vehicleTimer !== null) return;

    if (vehicleStep >= vehicleRoute.length) {
        vehicleStep = 0;
    }

    vehicleStatus.textContent = "Moving";

    function moveVehicle() {

        const currentLocation = vehicleRoute[vehicleStep];

// Update the location text
vehicleLocation.textContent = currentLocation;
// Calculate estimated remaining delivery time
const totalStops = vehicleRoute.length - 1;

const remainingTime = Math.ceil(
    vehicleEstimatedTime *
    (totalStops - vehicleStep) / totalStops
);

document.getElementById("vehicleETA").textContent =
    remainingTime + " minutes remaining";

// Display the next delivery stop
document.getElementById("vehicleNextStop").textContent =
    vehicleRoute[vehicleStep + 1] || "Destination reached";

// Update delivery progress
const progress = Math.round(
    (vehicleStep / (vehicleRoute.length - 1)) * 100
);

document.getElementById("vehicleProgressBar").style.width =
    progress + "%";

document.getElementById("vehicleProgressText").textContent =
    progress + "%";

// Move the vehicle marker on the map
vehicleMarker.setLatLng(lpuNodes[currentLocation]);

// Keep the moving vehicle visible
lpuMap.panTo(lpuNodes[currentLocation]);

vehicleStep++;

        if (vehicleStep >= vehicleRoute.length) {
            clearInterval(vehicleTimer);
            vehicleTimer = null;

            vehicleStatus.textContent = "Delivered";
            vehicleLocation.textContent = "Hospital";
            document.getElementById("vehicleETA").textContent =
    "0 minutes remaining";
            document.getElementById("vehicleNextStop").textContent =
    "Completed";
        }
    }

    moveVehicle();

    vehicleTimer = setInterval(moveVehicle, 3000);
});

// Stop vehicle tracking
stopTrackingBtn.addEventListener("click", function () {

    if (vehicleTimer !== null) {
        clearInterval(vehicleTimer);
        vehicleTimer = null;
    }

    vehicleStatus.textContent = "Delayed";
});



