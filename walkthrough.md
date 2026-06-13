# Walkthrough: ESP32 GPS Tracker MQTT Dashboard

We have successfully built a real-time Leaflet-based GPS tracking webpage that integrates with an ESP32 publishing JSON coordinates via MQTT over WebSockets.

---

## 🛠️ Components Created

### 1. Frontend Web App
- [index.html](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/index.html) — Structuring the layout, including Leaflet, MQTT.js, and Lucide CDNs.
- [style.css](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/style.css) — Custom stylesheet providing a glassmorphism dark-mode UI, responsive sidebar, custom marker animations, and glowing traces.
- [app.js](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/app.js) — Subscribes to the WebSockets MQTT broker (defaulting to EMQX), parses JSON latitude/longitude, calculates cumulative distance using the Haversine formula, and updates the map. Also contains a loopback simulator that broadcasts location drift to the broker.

### 2. ESP32 Arduino Code
- [esp32_mqtt_gps.ino](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/esp32_mqtt_gps.ino) — Ready-to-flash C++ code for ESP32. It handles connecting to WiFi and an MQTT Broker, packages coordinates as JSON, and publishes them every 5 seconds. Includes full instructions to connect a NEO-6M GPS module, with automatic simulation fallback if no hardware GPS lock is present.

---

## 📸 Visual Results & Verification

We verified the dashboard's features by running a local web server and interacting with the UI.

### Live Tracking Interface
Here is the tracking dashboard in action during the loopback simulation. Notice the live path polyline (blue dots), the marker, the real-time distance calculation, and the live MQTT JSON payload stream:

![GPS Tracking Dashboard Screenshot](file:///C:/Users/SUSHANTA/.gemini/antigravity/brain/7818e9ad-0626-44b5-968c-8308d34c830b/.system_generated/click_feedback/click_feedback_1781356094894.png)

### Actions & Verification Playback
A full recording of the subagent verifying the MQTT client connecting, simulated coordinates publishing and plotting on the map, and the ESP32 code modal being inspected:

![GPS Tracker Action Recording](file:///C:/Users/SUSHANTA/.gemini/antigravity/brain/7818e9ad-0626-44b5-968c-8308d34c830b/gps_tracker_verification_1781355891050.webp)

---

## 🚀 How to Run the Project

### 1. View the Tracking Page
1. Locate the [index.html](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/index.html) file.
2. Double-click it to open it in any web browser.
3. Click **Connect Broker** to establish a WebSocket connection.
4. Click **Start Sim** to see simulated GPS updates move the marker.

### 2. Set Up the ESP32
1. Open the [esp32_mqtt_gps.ino](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/esp32_mqtt_gps.ino) file in your Arduino IDE.
2. Install the required libraries in the IDE library manager:
   - **PubSubClient**
   - **ArduinoJson**
3. Replace `"YOUR_WIFI_SSID"` and `"YOUR_WIFI_PASSWORD"` with your Wi-Fi credentials.
4. If you have a NEO-6M GPS module, wire it up as described in the code comments. If you don't, the code will automatically simulate movement.
5. Upload the sketch to your ESP32.
6. Once the ESP32 powers on and connects to Wi-Fi, it will start publishing coordinates.
7. Open the tracking page and look at your ESP32's location update live!
