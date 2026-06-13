# ESP32 Leaflet MQTT Tracking Dashboard

We will create a premium web dashboard that connects to an MQTT broker over WebSockets, subscribes to a topic, and plots the real-time location of an ESP32 device on an interactive Leaflet map. It will also feature a live simulation mode and include sample ESP32 code to publish JSON GPS data.

## Proposed Layout & Visuals
- **Dark Glassmorphism Theme**: Sleek, modern interface using custom CSS styling, smooth gradients, blur backdrops, and pulsing live indicators.
- **Split-Screen Dashboard**:
  - **Left Sidebar**: MQTT broker configuration, live telemetry (lat/lng, distance, status, timestamp), simulation controls, and ESP32 code references.
  - **Right Area**: Full-screen interactive Leaflet map with support for standard (street) and dark-mode tile styles.
- **Custom Pulse Marker**: A modern CSS animated Leaflet marker representing the ESP32 device, trailing a clean glowing polyline showing its path history.

---

## Proposed Files

### 1. [index.html](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/index.html) [NEW]
Contains the HTML structure of the page, linking:
- Leaflet JS & CSS
- MQTT.js (via unpkg CDN for modern WebSockets MQTT connection)
- Lucide Icons (for clean dashboard icons)
- Google Fonts (Outfit and JetBrains Mono)
- `style.css` and `app.js`

### 2. [style.css](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/style.css) [NEW]
Defines a responsive grid layout, customized dark mode themes, glassmorphism card panels, styling for Leaflet custom markers, and smooth hover/pulser animations.

### 3. [app.js](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/app.js) [NEW]
Handles application logic:
- Connects to an MQTT Broker over WebSockets (`broker.hivemq.com` or `broker.emqx.io` as default).
- Subscribes to the configured topic (e.g., `esp32/gps/location`).
- Receives JSON payload, parses it (e.g., `{"latitude": 22.5726, "longitude": 88.3639}`), and updates the Leaflet marker.
- Calculates cumulative distance traveled using the Haversine formula.
- Plots and updates the historical path polyline.
- Controls the Simulator, which can generate and publish coordinates to the MQTT broker for testing.
- Saves the last settings to localStorage.

### 4. [esp32_mqtt_gps.ino](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/esp32_mqtt_gps.ino) [NEW]
A complete, ready-to-flash Arduino sketch for ESP32. It uses `WiFi.h`, `PubSubClient.h`, and `ArduinoJson.h` to demonstrate:
- Connecting to Wi-Fi.
- Connecting to the MQTT Broker.
- Structuring and publishing the JSON location payload at intervals.

---

## Verification Plan

### Manual Verification
1. Open the webpage in a browser.
2. Verify MQTT client connection to public WebSocket broker (`wss://broker.emqx.io:8084/mqtt`).
3. Click "Start Simulator" to broadcast virtual coordinate updates to the broker.
4. Verify that the map updates dynamically with a pulsing red marker and traces a path.
5. Verify telemetry reads out current lat, lng, timestamp, and calculated cumulative distance.
6. Stop simulator, connect client manually, and test configuration saving.
7. Verify that the ESP32 code block displays correctly and is easily copyable.
