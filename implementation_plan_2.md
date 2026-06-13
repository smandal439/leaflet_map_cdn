# Implementation Plan - Multi-Device Tracking Dashboard

This plan transitions the existing single-ESP32 tracking dashboard into a scalable tracking system capable of monitoring hundreds of devices.

## Proposed Changes

### 1. Leaflet & Marker Clustering
- **Leaflet MarkerCluster Plugin:** Integrate the MarkerCluster plugin via CDN in [index.html](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/index.html) so that markers auto-group dynamically when zoomed out, preventing UI lag and map clutter.
- **Dynamic Marker Map:** Replace single-device variables in [app.js](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/app.js) with a state dictionary (`activeDevices`) holding coordinates, tooltips, path history, and stats for each device.
- **On-Demand Path Rendering:** To prevent map clutter and save CPU cycles, the trailing path history is drawn *only* for the currently selected/active device.

### 2. UI/UX: Searchable Device List Sidebar
- **Active Devices Card:** Add a new card in the sidebar showing the total count of active devices and a list of all devices sending data.
- **Visual Status indicators:** Device list items will show a last-active status pill (Green/Active, Yellow/Idle, Red/Offline), update count, and RSSI strength.
- **Fly-to Focus:** Clicking a device in the sidebar will select that device, zoom the map to it, and display its specific tracking path and telemetry.
- **Telemetry Card Update:** Adapt the telemetry card to show stats of the currently selected device, or display a prompt if no device is selected.

### 3. Firmware Sketch Update
- **MAC-Address-based dynamic topic:** Update the embedded ESP32 code inside [esp32_mqtt_gps.ino](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/esp32_mqtt_gps.ino) and the code block modal in the HTML to generate a unique `device_id` and topic string `esp32/<MAC_ADDRESS>/location` at runtime.

### 4. Multi-Device GPS Simulator
- **Simulating Concurrent Devices:** Rewrite the simulator in [app.js](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/app.js) to generate data for multiple virtual devices (e.g., `ESP32-DEV-A` through `ESP32-DEV-E`) moving independently, allowing real-world load testing directly inside the browser.

---

### [Component Changes]

#### [MODIFY] [index.html](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/index.html)
- Add CDN links for Leaflet MarkerCluster CSS & JS.
- Modify default MQTT topic value to `esp32/+/location`.
- Add active device list panel container.
- Update ESP32 Arduino source code inside the modal to use dynamic MAC address naming.

#### [MODIFY] [app.js](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/app.js)
- Refactor global variables: remove single-marker variables and add `activeDevices` state Map.
- Initialize `markerClusterGroup` on setup.
- Update `processIncomingGPS` to support dynamic registration and updates of device coordinates, markers, list items, and stats.
- Implement selection behavior (`selectDevice(id)`): show selected device's history path, update telemetry cards, and pan map.
- Update GPS Simulator to manage and publish coordinates for 5 simulated devices concurrently.

#### [MODIFY] [style.css](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/style.css)
- Add styling for `.device-list`, `.device-item`, status dots, scrollbars, and hover animations.

#### [MODIFY] [esp32_mqtt_gps.ino](file:///c:/Users/SUSHANTA/Desktop/leaflet%20map/esp32_mqtt_gps.ino)
- Update code to query ESP32 chip MAC Address dynamically and format the MQTT client ID and topic accordingly.

---

## Verification Plan

### Automated Tests / Compilation
- Verify that `esp32_mqtt_gps.ino` compiles correctly by reviewing dynamic ID generation syntax.

### Manual Verification
- Open the dashboard, connect to local loopback (offline) or public broker.
- Start the multi-device simulator.
- Verify that multiple device markers appear on the map and group into clusters as you zoom out.
- Verify that clicking a device in the sidebar list highlights it, zooms the map to it, draws its trailing path, and updates the telemetry card.
- Verify that when the simulator runs, the sidebar items dynamically update their last-active timestamps and update counts.
