# ESP32 GPS Tracker + Leaflet MQTT Map

A lightweight real-time GPS tracking dashboard built with Leaflet and MQTT over WebSockets, paired with an ESP32 sketch that publishes location telemetry.

## Project Contents

- `index.html` — web dashboard layout and modal for ESP32 Arduino code.
- `style.css` — dashboard styling and dark glassmorphism UI.
- `app.js` — MQTT WebSocket client, Leaflet map logic, device list, telemetry display, and simulator.
- `esp32_mqtt_gps.ino` — ESP32 Arduino sketch that sends JSON GPS messages to an MQTT broker.

## What this project does

- Connects a browser dashboard to an MQTT broker using WebSockets.
- Parses JSON location updates and displays them on a Leaflet map.
- Shows live device telemetry, device list, payload JSON, and map history.
- Includes a built-in simulator for testing without an ESP32.
- Provides optional physical ESP32 + GPS support via the included Arduino sketch.

## Dependencies for another PC

### Browser / frontend
- A modern browser with JavaScript and WebSocket support (Chrome, Edge, Firefox, etc.).
- Internet access to load external CDN libraries used by `index.html`:
  - Leaflet
  - Leaflet MarkerCluster
  - MQTT.js
  - Lucide icons
  - Google Fonts
- Recommended: run the app via a local HTTP server rather than opening `index.html` with `file://`.

### MQTT broker
- A broker that supports MQTT over WebSockets.
- Default broker in the app: `wss://broker.emqx.io:8084/mqtt`.
- If using a custom broker, update the broker URL in the dashboard and ensure the broker path and port are correct.

### ESP32 development
- Arduino IDE or compatible editor with ESP32 board support installed.
- ESP32 board definitions installed in Arduino IDE.
- Required Arduino libraries:
  - `PubSubClient`
  - `ArduinoJson`
  - `TinyGPS++` (optional, only if using a physical GPS module)
- ESP32 device to run the `esp32_mqtt_gps.ino` sketch.

### Optional hardware
- ESP32 development board.
- Optional NEO-6M GPS module connected to Serial2 pins if you want real GPS coordinates.

## Setup on another PC

1. Copy or clone the project folder.
2. Open the folder in your editor.
3. Start a local web server from the project directory:
   - Python: `python -m http.server 8000`
   - Or use VS Code Live Server.
4. Open `http://127.0.0.1:8000/` in your browser.
5. In the dashboard, enter a WebSocket MQTT broker URL and topic.
6. Click `Connect Broker`.
7. Use `Start Sim` to test simulated GPS updates, or connect an ESP32 publishing to the broker.

## ESP32 setup

1. Open `esp32_mqtt_gps.ino` in Arduino IDE.
2. Install the libraries mentioned above.
3. Set your Wi-Fi credentials in the sketch.
4. Optionally wire a GPS module as described in the sketch comments.
5. Upload the sketch to the ESP32.
6. Confirm the ESP32 connects to Wi-Fi and the MQTT broker.
7. Open the dashboard and verify location messages appear.

## Important notes

- If the app does not connect from the browser, verify the broker URL and WebSocket path.
- `file://` access may prevent MQTT.js from working properly, so use `http://localhost` or a web server.
- If you do not have a GPS module, the ESP32 sketch automatically uses simulated coordinates.
- For custom topics, ensure the dashboard topic filter matches the ESP32 publish topic.

## Recommended future improvements

- Add offline support by bundling dependencies locally instead of CDN.
- Add broker authentication and secure access instructions.
- Add support for custom MQTT topics and payload validation.
- Expand the ESP32 sketch to use actual TinyGPS++ GPS decoding when the module is connected.