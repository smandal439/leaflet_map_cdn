// Real-time GPS Tracking Dashboard Client Logic

// Global State
let map;
let client = null;
const activeDevices = new Map(); // Key: deviceId, Value: Device State Object
let selectedDeviceId = null; // Currently selected device ID
let markerClusterGroup = null; // Leaflet MarkerCluster Group
let pathPolyline = null; // (legacy - replaced by per-device polylines)

// Unique path color palette — one color assigned per device
const DEVICE_PATH_COLORS = [
  '#0ea5e9', // cyan
  '#10b981', // emerald
  '#a78bfa', // violet
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#facc15', // yellow
  '#ef4444', // red
];
let deviceColorIndex = 0;

// Browser persistence state
let db = null;
let dbReady = false;
const dbName = 'esp32_gps_dashboard';
const dbVersion = 1;
let dbStatusPill = null;
let dbRecordCountEl = null;
let dbLastSavedEl = null;

// UI elements for device tracking
let deviceListContainer;
let deviceCountElement;
let selectedDeviceText;

// Configuration Defaults
const defaultLat = 22.5726;
const defaultLng = 88.3639;
const storagePrefix = "esp32_gps_";

// Map Tile Layers
const streetTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
});

const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 20,
  attribution: '© OpenStreetMap contributors, © CartoDB'
});

const satelliteTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Tiles © Esri, Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
});

let currentBaseLayer = darkTiles;

// UI Elements
const connPill = document.getElementById('connection-pill');
const connStatusText = document.getElementById('connection-status-text');
const connectBtn = document.getElementById('connect-btn');
const brokerInput = document.getElementById('mqtt-broker');
const topicInput = document.getElementById('mqtt-topic');
const usernameInput = document.getElementById('mqtt-username');
const passwordInput = document.getElementById('mqtt-password');

const valLat = document.getElementById('val-lat');
const valLng = document.getElementById('val-lng');
const valBattery = document.getElementById('val-battery');
const valDistance = document.getElementById('val-distance');
const valUpdates = document.getElementById('val-updates');
const valTime = document.getElementById('val-time');
const payloadDisplay = document.getElementById('payload-display');

const hudDarkMode = document.getElementById('hud-dark-mode');
const hudPanActive = document.getElementById('hud-pan-active');
const hudClearPath = document.getElementById('hud-clear-path');
let clearStorageBtn = null;

const simStartBtn = document.getElementById('sim-start-btn');
const simStopBtn = document.getElementById('sim-stop-btn');
const simCard = document.getElementById('simulator-card');

// Modal Elements
const codeModal = document.getElementById('code-modal');
const viewCodeBtn = document.getElementById('view-code-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const copyCodeBtn = document.getElementById('copy-code-btn');
const arduinoCodeElement = document.getElementById('esp32-arduino-code');

// HUD State
let isDarkMode = true;
let isPanActive = true;

// Simulator State
let simIntervalId = null;
let simLat = defaultLat;
let simLng = defaultLng;

// Initialize Application
window.addEventListener('DOMContentLoaded', () => {
  // Bind UI elements
  deviceListContainer = document.getElementById('device-list');
  deviceCountElement = document.getElementById('device-count');
  selectedDeviceText = document.getElementById('selected-device-id');
  dbStatusPill = document.getElementById('db-status-pill');
  dbRecordCountEl = document.getElementById('db-record-count');
  dbLastSavedEl = document.getElementById('db-last-saved');
  clearStorageBtn = document.getElementById('clear-storage-btn');

  // Initialize Lucide Icons
  lucide.createIcons();

  // Load Settings from LocalStorage
  loadSettings();

  // Initialize browser storage
  initDatabase();

  // Initialize Map
  initMap();

  // Bind Buttons & Events
  connectBtn.addEventListener('click', toggleConnection);
  if (hudDarkMode) {
    hudDarkMode.addEventListener('click', toggleDarkMode);
  }
  hudPanActive.addEventListener('click', togglePanActive);
  hudClearPath.addEventListener('click', clearPathHistory);

  // Add base layer control for map views
  const baseMaps = {
    'Street': streetTiles,
    'Dark': darkTiles,
    'Satellite': satelliteTiles
  };
  L.control.layers(baseMaps, null, { position: 'topleft' }).addTo(map);

  // Simulator Events
  simStartBtn.addEventListener('click', startSimulator);
  simStopBtn.addEventListener('click', stopSimulator);
  if (clearStorageBtn) {
    clearStorageBtn.addEventListener('click', clearStoredData);
  }

  // Modal Events
  viewCodeBtn.addEventListener('click', () => showModal(true));
  closeModalBtn.addEventListener('click', () => showModal(false));
  codeModal.addEventListener('click', (e) => {
    if (e.target === codeModal) showModal(false);
  });
  copyCodeBtn.addEventListener('click', copyArduinoCode);

  // Periodically refresh sidebar status times (1Hz)
  setInterval(updateSidebar, 1000);
});

// Setup Leaflet Map
function initMap() {
  // Centered initially at defaults
  map = L.map('map', {
    zoomControl: true,
    layers: [darkTiles] // Default is Dark Mode
  }).setView([defaultLat, defaultLng], 13);

  currentBaseLayer = darkTiles;

  // Initialize Marker Cluster Group
  markerClusterGroup = L.markerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    maxClusterRadius: 40
  }).addTo(map);
}

// Save/Load Settings
function saveSettings() {
  localStorage.setItem(storagePrefix + 'broker', brokerInput.value);
  localStorage.setItem(storagePrefix + 'topic', topicInput.value);
  localStorage.setItem(storagePrefix + 'username', usernameInput.value);
}

function loadSettings() {
  const broker = localStorage.getItem(storagePrefix + 'broker');
  const topic = localStorage.getItem(storagePrefix + 'topic');
  const username = localStorage.getItem(storagePrefix + 'username');
  
  if (broker) brokerInput.value = broker;
  if (topic) topicInput.value = topic;
  if (username) usernameInput.value = username;
}

function initDatabase() {
  if (!('indexedDB' in window)) {
    console.warn('IndexedDB is not supported by this browser.');
    updateDatabaseStatus('unsupported');
    return;
  }

  updateDatabaseStatus('initializing');
  const request = indexedDB.open(dbName, dbVersion);

  request.onupgradeneeded = (event) => {
    const database = event.target.result;
    if (!database.objectStoreNames.contains('gpsRecords')) {
      const store = database.createObjectStore('gpsRecords', { keyPath: 'id', autoIncrement: true });
      store.createIndex('deviceId', 'deviceId', { unique: false });
      store.createIndex('timestamp', 'timestamp', { unique: false });
    }
  };

  request.onsuccess = (event) => {
    db = event.target.result;
    dbReady = true;
    updateDatabaseStatus('ready');
    countStoredRecords();
  };

  request.onerror = (event) => {
    console.error('IndexedDB open error:', event.target.error);
    updateDatabaseStatus('error');
  };
}

function updateDatabaseStatus(status) {
  if (!dbStatusPill) return;
  dbStatusPill.className = `status-pill ${status}`;

  switch (status) {
    case 'ready':
      dbStatusPill.innerText = 'Ready';
      break;
    case 'initializing':
      dbStatusPill.innerText = 'Initializing';
      break;
    case 'saving':
      dbStatusPill.innerText = 'Saving';
      break;
    case 'error':
      dbStatusPill.innerText = 'Error';
      break;
    case 'unsupported':
      dbStatusPill.innerText = 'Unsupported';
      break;
    default:
      dbStatusPill.innerText = status;
  }
}

function countStoredRecords() {
  if (!dbReady || !db) return;
  const transaction = db.transaction('gpsRecords', 'readonly');
  const store = transaction.objectStore('gpsRecords');
  const countRequest = store.count();

  countRequest.onsuccess = () => {
    if (dbRecordCountEl) {
      dbRecordCountEl.innerText = countRequest.result.toString();
    }
  };

  countRequest.onerror = (event) => {
    console.error('IndexedDB count error:', event.target.error);
  };
}

function clearStoredData() {
  if (!dbReady || !db) return;
  if (!confirm('Clear all stored GPS data from IndexedDB? This cannot be undone.')) {
    return;
  }

  updateDatabaseStatus('saving');
  const transaction = db.transaction('gpsRecords', 'readwrite');
  const store = transaction.objectStore('gpsRecords');
  const clearRequest = store.clear();

  clearRequest.onsuccess = () => {
    updateDatabaseStatus('ready');
    if (dbRecordCountEl) {
      dbRecordCountEl.innerText = '0';
    }
    if (dbLastSavedEl) {
      dbLastSavedEl.innerText = 'Never';
    }
    countStoredRecords();
  };

  clearRequest.onerror = (event) => {
    console.error('Failed to clear stored data:', event.target.error);
    updateDatabaseStatus('error');
  };
}

function saveIncomingRecord(data, receivedTopic, rawPayload) {
  if (!dbReady || !db) return;
  updateDatabaseStatus('saving');

  const transaction = db.transaction('gpsRecords', 'readwrite');
  const store = transaction.objectStore('gpsRecords');

  // Normalize battery level from either top-level or nested hd:wgps payload
  let batteryLevelValue = null;
  if (data.battery_level !== undefined && data.battery_level !== null && data.battery_level !== '') {
    batteryLevelValue = parseFloat(data.battery_level);
  } else if (data.pc && data.pc['hd:wgps']) {
    const ng = data.pc['hd:wgps'];
    const nestedBatteryRaw = ng.btper ?? ng.btPer ?? ng.bt_per ?? ng.bt ?? null;
    if (nestedBatteryRaw !== null && nestedBatteryRaw !== undefined && nestedBatteryRaw !== '') {
      batteryLevelValue = parseFloat(nestedBatteryRaw);
    }
  }

  const record = {
    receivedAt: Date.now(),
    topic: receivedTopic || '',
    payload: rawPayload || '',
    deviceId: data.device_id || 'ESP32-UNKNOWN',
    latitude: parseFloat(data.latitude),
    longitude: parseFloat(data.longitude),
    batteryLevel: batteryLevelValue,
    timestamp: data.timestamp || null,
    wifi_rssi: data.wifi_rssi,
    rawData: data
  };

  const request = store.add(record);
  request.onsuccess = () => {
    updateDatabaseStatus('ready');
    if (dbLastSavedEl) {
      dbLastSavedEl.innerText = new Date().toLocaleTimeString();
    }
    countStoredRecords();
  };

  request.onerror = (event) => {
    console.error('Failed to write GPS record:', event.target.error);
    updateDatabaseStatus('error');
  };
}

// Connection Toggle Action
function toggleConnection() {
  if (client && client.connected) {
    disconnectFromBroker();
  } else {
    connectToBroker();
  }
}

// Convert standard MQTT TCP URLs (mqtt://..., tcp://...) to Browser WebSockets URLs (ws://, wss://)
function parseMqttUrl(inputUrl) {
  let url = inputUrl.trim();
  if (!url) return '';

  // Already a WebSockets URL
  if (url.startsWith('ws://') || url.startsWith('wss://')) {
    return url;
  }

  let protocol = 'wss'; // Default to secure WebSockets
  let hostAndPort = url;

  // Extract protocol if exists
  const protocolMatch = url.match(/^([a-z]+):\/\/(.*)/i);
  if (protocolMatch) {
    const proto = protocolMatch[1].toLowerCase();
    hostAndPort = protocolMatch[2];
    
    if (proto === 'mqtt' || proto === 'tcp' || proto === 'ws') {
      protocol = 'ws';
    } else if (proto === 'mqtts' || proto === 'ssl' || proto === 'wss') {
      protocol = 'wss';
    }
  }

  // Handle path mapping
  let host = hostAndPort;
  let path = '/mqtt'; // Default path for common brokers
  const pathIndex = hostAndPort.indexOf('/');
  if (pathIndex !== -1) {
    host = hostAndPort.substring(0, pathIndex);
    path = hostAndPort.substring(pathIndex);
  }

  // Extract port
  let port = null;
  const portMatch = host.match(/:(\d+)$/);
  if (portMatch) {
    port = parseInt(portMatch[1]);
    host = host.substring(0, host.indexOf(':'));
  }

  // Intelligent Port/Protocol Mapping
  if (port === null) {
    if (host.includes('emqx.io')) {
      port = (protocol === 'wss') ? 8084 : 8083;
    } else if (host.includes('hivemq.com')) {
      port = (protocol === 'wss') ? 8884 : 8000;
    } else if (host.includes('mosquitto.org')) {
      port = (protocol === 'wss') ? 8081 : 8080;
    } else {
      port = (protocol === 'wss') ? 443 : 80;
    }
  } else {
    // If standard TCP ports were entered, map to corresponding WS ports
    if (host.includes('emqx.io')) {
      if (port === 1883) { protocol = 'ws'; port = 8083; }
      else if (port === 8883) { protocol = 'wss'; port = 8084; }
    } else if (host.includes('hivemq.com')) {
      if (port === 1883) { protocol = 'ws'; port = 8000; }
      else if (port === 8883) { protocol = 'wss'; port = 8884; }
    } else if (host.includes('mosquitto.org')) {
      if (port === 1883) { protocol = 'ws'; port = 8080; }
      else if (port === 8883) { protocol = 'wss'; port = 8081; }
    } else {
      // General fallback
      if (port === 1883) { protocol = 'ws'; port = 8083; }
      else if (port === 8883) { protocol = 'wss'; port = 8084; }
    }
  }

  return `${protocol}://${host}:${port}${path}`;
}

// MQTT WebSockets Connection
function connectToBroker() {
  const rawUrl = brokerInput.value.trim();
  const topic = topicInput.value.trim();
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!rawUrl || !topic) {
    alert("Broker URL and Topic are required.");
    return;
  }

  // Map URL if it is in TCP/MQTT form
  const wsUrl = parseMqttUrl(rawUrl);
  if (rawUrl !== wsUrl) {
    console.log(`Automatically translated broker URL "${rawUrl}" to WebSocket URL "${wsUrl}"`);
    brokerInput.value = wsUrl; // Update field so the user sees it
  }

  saveSettings();
  updateStatusUI('connecting');
  connectBtn.disabled = true;
  connectBtn.innerText = "Connecting...";

  // Random Client ID
  const clientId = 'web_gps_' + Math.random().toString(16).substr(2, 8);

  const options = {
    clientId: clientId,
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 4000
  };

  if (username) options.username = username;
  if (password) options.password = password;

  try {
    console.log(`Connecting to MQTT Broker: ${wsUrl} (Client: ${clientId})`);
    client = mqtt.connect(wsUrl, options);

    client.on('connect', () => {
      console.log('Successfully connected to MQTT Broker');
      updateStatusUI('connected');
      client.subscribe(topic, (err) => {
        if (err) {
          console.error(`Subscription failed for topic: ${topic}`, err);
          alert(`Could not subscribe to topic: ${topic}`);
        } else {
          console.log(`Subscribed to topic: ${topic}`);
        }
      });
      connectBtn.disabled = false;
      connectBtn.innerText = "Disconnect Broker";
      connectBtn.className = "btn btn-danger";
    });

    client.on('message', (receivedTopic, payload) => {
      processIncomingGPS(payload, receivedTopic);
    });

    client.on('error', (err) => {
      console.error('MQTT Connection Error:', err);
      updateStatusUI('disconnected');
      resetConnectionButton();
    });

    client.on('close', () => {
      console.log('MQTT Connection Closed');
      updateStatusUI('disconnected');
      resetConnectionButton();
    });

  } catch (err) {
    console.error("MQTT Connect Exception: ", err);
    updateStatusUI('disconnected');
    resetConnectionButton();
  }
}

function disconnectFromBroker() {
  if (client) {
    client.end();
    client = null;
  }
  updateStatusUI('disconnected');
  resetConnectionButton();
}

function resetConnectionButton() {
  connectBtn.disabled = false;
  connectBtn.innerText = "Connect Broker";
  connectBtn.className = "btn btn-primary";
}

function updateStatusUI(status) {
  connPill.className = `status-pill ${status}`;
  connStatusText.innerText = status.charAt(0).toUpperCase() + status.slice(1);
}

// Process GPS JSON Data
function processIncomingGPS(payloadData, receivedTopic = '') {
  let payloadString = '';

  if (typeof payloadData === 'string') {
    payloadString = payloadData;
  } else if (payloadData instanceof Uint8Array || payloadData instanceof ArrayBuffer) {
    payloadString = new TextDecoder('utf-8').decode(payloadData);
  } else if (payloadData && typeof payloadData.toString === 'function') {
    payloadString = payloadData.toString();
  }

  payloadString = payloadString.trim();
  if (payloadString.charCodeAt(0) === 0xfeff) {
    payloadString = payloadString.slice(1);
  }

  // Normalize MQTT payload wrappers and stray quoting from different broker clients
  if ((payloadString.startsWith("b'") && payloadString.endsWith("'")) ||
      (payloadString.startsWith('b"') && payloadString.endsWith('"'))) {
    payloadString = payloadString.slice(2, -1);
  }
  if ((payloadString.startsWith('"') && payloadString.endsWith('"')) ||
      (payloadString.startsWith("'") && payloadString.endsWith("'"))) {
    payloadString = payloadString.slice(1, -1);
  }

  // Try to extract JSON substring from noisy payloads
  const firstBrace = payloadString.indexOf('{');
  const lastBrace = payloadString.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    payloadString = payloadString.substring(firstBrace, lastBrace + 1);
  }

  try {
    let data = JSON.parse(payloadString);
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    
    // Determine device ID
    let deviceId = data.device_id || data.fr || data.to;
    if (!deviceId && receivedTopic) {
      const parts = receivedTopic.split('/');
      if (parts.length >= 2) {
        deviceId = parts[1];
      }
    }
    if (!deviceId) {
      deviceId = "ESP32-UNKNOWN";
    }

    // Normalize GPS payload from nested HD WGPS structure if present
    let latValue = data.latitude;
    let lngValue = data.longitude;
    let batteryLevel = data.battery_level !== undefined ? parseFloat(data.battery_level) : null;
    let rssi = data.wifi_rssi;

    const nestedGps = data.pc && data.pc['hd:wgps'];
    if (nestedGps) {
      latValue = nestedGps.lat ?? latValue;
      lngValue = nestedGps.lng ?? lngValue;
      rssi = nestedGps.rssi ?? rssi;
      // Support multiple casing/variants for battery percentage keys (btper, btPer, bt_per, bt)
      const nestedBatteryRaw = nestedGps.btper ?? nestedGps.btPer ?? nestedGps.bt_per ?? nestedGps.bt ?? null;
      if (nestedBatteryRaw !== null && nestedBatteryRaw !== undefined && nestedBatteryRaw !== '') {
        batteryLevel = parseFloat(nestedBatteryRaw);
      }

      const latDir = (nestedGps.latD || '').toUpperCase();
      const lngDir = (nestedGps.lngD || '').toUpperCase();
      if (typeof latValue === 'string') {
        latValue = latValue.trim();
      }
      if (typeof lngValue === 'string') {
        lngValue = lngValue.trim();
      }
      if (typeof batteryLevel === 'string') {
        batteryLevel = batteryLevel.trim();
      }

      if (latDir === 'S' && !String(latValue).startsWith('-')) {
        latValue = '-' + latValue;
      }
      if (lngDir === 'W' && !String(lngValue).startsWith('-')) {
        lngValue = '-' + lngValue;
      }
    }

    saveIncomingRecord(data, receivedTopic, payloadString);

    const formattedPayload = JSON.stringify(data, null, 2);

    // Display raw payload in JSON box only if it's the selected device or no device is selected yet
    if (!selectedDeviceId || selectedDeviceId === deviceId) {
      payloadDisplay.innerText = formattedPayload;
      payloadDisplay.classList.add('highlight');
      setTimeout(() => payloadDisplay.classList.remove('highlight'), 300);
    }

    const lat = parseFloat(latValue);
    const lng = parseFloat(lngValue);
    const battery = batteryLevel !== null ? parseFloat(batteryLevel) : null;

    if (isNaN(lat) || isNaN(lng)) {
      console.warn("Invalid coordinate payload received:", data);
      return;
    }

    updateGPSPosition(deviceId, lat, lng, rssi, formattedPayload, batteryLevel);

  } catch (err) {
    console.error("Failed to parse JSON MQTT payload:", err);
    payloadDisplay.innerText = "Error parsing JSON:\n" + payloadString;
  }
}

// Update Map & Telemetry UI
function updateGPSPosition(deviceId, lat, lng, rssi, formattedPayload, batteryLevel) {
  const currentLatLng = L.latLng(lat, lng);
  const now = Date.now();

  let dev = activeDevices.get(deviceId);

  if (!dev) {
    // Assign a unique color from the palette for this device's path and marker
    const pathColor = DEVICE_PATH_COLORS[deviceColorIndex % DEVICE_PATH_COLORS.length];
    deviceColorIndex++;

    // Create per-device polyline (dimmed by default; brightened when selected)
    const polyline = L.polyline([[lat, lng]], {
      color: pathColor,
      weight: 2,
      opacity: 0.35,
      lineJoin: 'round',
    }).addTo(map);

    // Custom GPS Pulse Marker (represented by a divIcon)
    const pulseIcon = createPulseIcon(false);

    const marker = L.marker(currentLatLng, { icon: pulseIcon });
    marker.bindTooltip(deviceId, {
      permanent: false,
      direction: 'top',
      className: 'custom-tooltip',
      offset: [0, -10]
    });

    // Handle click to inspect device
    marker.on('click', () => {
      selectDevice(deviceId);
    });

    // Add marker to cluster group
    markerClusterGroup.addLayer(marker);

    dev = {
      deviceId: deviceId,
      marker: marker,
      polyline: polyline,
      pathColor: pathColor,
      pathHistory: [[lat, lng]],
      lastLatLng: currentLatLng,
      totalDistance: 0,
      updates: 1,
      lastActiveTime: now,
      rssi: rssi,
      lastPayload: formattedPayload,
      batteryLevel: batteryLevel
    };

    activeDevices.set(deviceId, dev);

    // Auto-select first device
    if (!selectedDeviceId) {
      selectDevice(deviceId);
    } else {
      updateSidebar();
    }

  } else {
    // Update existing device coordinates
    const stepDistance = haversineDistance(dev.lastLatLng, currentLatLng);
    if (stepDistance > 0.002) { // filter micro GPS drift
      dev.totalDistance += stepDistance;
    }

    dev.lastLatLng = currentLatLng;
    dev.pathHistory.push([lat, lng]);
    dev.updates++;
    dev.lastActiveTime = now;
    dev.lastPayload = formattedPayload;
    if (rssi !== undefined) {
      dev.rssi = rssi;
    }

    // Extend this device's own path polyline (guarded in case polyline is not yet ready)
    if (dev.polyline) {
      dev.polyline.addLatLng(currentLatLng);
    }

    // Move marker and tell Cluster Group to refresh it
    dev.marker.setLatLng(currentLatLng);
    // Ensure the icon always reflects the current selected state before refreshLayers re-renders it
    dev.marker.setIcon(createPulseIcon(selectedDeviceId === deviceId));
    markerClusterGroup.refreshLayers(dev.marker);

    // If selected, update telemetry
    if (selectedDeviceId === deviceId) {
      updateTelemetryUI(dev);
      if (isPanActive) {
        map.panTo(currentLatLng);
      }
    }
  }
}

// Factory: returns a divIcon with or without the 'selected' class baked in.
// Using setIcon() instead of DOM manipulation ensures the state survives
// any cluster re-render or refreshLayers call.
function createPulseIcon(isSelected) {
  const cls = isSelected ? 'custom-pulse-marker selected' : 'custom-pulse-marker';
  return L.divIcon({
    className: 'custom-marker-container',
    html: `<div class="pulse-marker-wrapper"><div class="${cls}"></div></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

// Apply selected/deselected icon to a marker
function applyMarkerStyle(marker, isSelected) {
  marker.setIcon(createPulseIcon(isSelected));
}

// Select a specific device to track
function selectDevice(deviceId) {
  // Deselect the previously selected marker + dim its path
  if (selectedDeviceId && selectedDeviceId !== deviceId) {
    const prevDev = activeDevices.get(selectedDeviceId);
    if (prevDev) {
      applyMarkerStyle(prevDev.marker, false);
      prevDev.polyline.setStyle({ weight: 2, opacity: 0.35, dashArray: null });
    }
  }

  selectedDeviceId = deviceId;
  const dev = activeDevices.get(deviceId);
  if (!dev) return;

  // Highlight the newly selected marker
  applyMarkerStyle(dev.marker, true);

  // Brighten and bring selected device path to front
  dev.polyline.setStyle({
    weight: 4,
    opacity: 0.88,
    dashArray: '1, 5',
  });
  dev.polyline.bringToFront();

  // Update telemetry details
  updateTelemetryUI(dev);
  if (dev.lastPayload) {
    payloadDisplay.innerText = dev.lastPayload;
  }

  // Fly to device with smooth zoom animation (street-level zoom 16)
  if (isPanActive) {
    map.flyTo(dev.lastLatLng, 16, {
      animate: true,
      duration: 0.8,   // seconds
      easeLinearity: 0.25
    });
  }

  // Visual highlights
  updateSidebar();
}

// Refresh active device sidebar list
function updateSidebar() {
  if (!deviceListContainer) return;
  const now = Date.now();

  if (activeDevices.size === 0) {
    deviceListContainer.innerHTML = '<div class="no-devices">No devices active. Connect broker or start simulation.</div>';
    deviceCountElement.innerText = "0";
    deviceCountElement.className = "status-pill disconnected";
    return;
  }

  const sortedDevices = Array.from(activeDevices.values()).sort((a, b) => b.lastActiveTime - a.lastActiveTime);
  let html = '';
  let activeCount = 0;

  sortedDevices.forEach(dev => {
    const elapsedSec = Math.floor((now - dev.lastActiveTime) / 1000);
    
    let statusClass = 'active';
    let statusText = 'Active';
    if (elapsedSec > 300) { // 5 mins
      statusClass = 'offline';
      statusText = 'Offline';
    } else if (elapsedSec > 60) { // 1 min
      statusClass = 'idle';
      statusText = 'Idle';
    }

    if (statusClass === 'active') {
      activeCount++;
    }

    const isSelected = selectedDeviceId === dev.deviceId ? 'selected' : '';
    const rssiText = dev.rssi !== undefined ? `<i data-lucide="wifi" style="width: 10px; height: 10px;"></i> ${dev.rssi} dBm` : '';
    
    let timeStr = 'Just now';
    if (elapsedSec >= 60) {
      timeStr = `${Math.floor(elapsedSec / 60)}m ago`;
    } else if (elapsedSec > 5) {
      timeStr = `${elapsedSec}s ago`;
    }

    html += `
      <div class="device-item ${isSelected}" onclick="selectDevice('${dev.deviceId}')">
        <div class="device-item-left">
          <div class="device-status-dot ${statusClass}" title="${statusText}"></div>
          <div class="device-details">
            <div class="device-name">${dev.deviceId}</div>
            <div class="device-time">${timeStr}</div>
          </div>
        </div>
        <div class="device-item-right">
          <div class="device-updates">${dev.updates} msgs</div>
          ${rssiText ? `<div class="device-rssi">${rssiText}</div>` : ''}
        </div>
      </div>
    `;
  });

  deviceListContainer.innerHTML = html;
  deviceCountElement.innerText = activeCount;
  deviceCountElement.className = activeCount > 0 ? "status-pill connected" : "status-pill disconnected";

  lucide.createIcons();

  // Always keep the telemetry card in sync with the selected device (1Hz safety net)
  if (selectedDeviceId) {
    updateTelemetryUI(activeDevices.get(selectedDeviceId));
  }
}

// Update UI Telemetry Card
function updateTelemetryUI(dev) {
  if (!dev) {
    selectedDeviceText.innerText = "Select Device";
    valLat.innerText = "--.------";
    valLng.innerText = "--.------";
    valBattery.innerText = "--%";
    valDistance.innerText = "0.00 km";
    valUpdates.innerText = "0";
    valTime.innerText = "Never";
    return;
  }

  selectedDeviceText.innerText = dev.deviceId;
  valLat.innerText = dev.lastLatLng.lat.toFixed(6);
  valLng.innerText = dev.lastLatLng.lng.toFixed(6);
  valBattery.innerText = dev.batteryLevel !== null ? dev.batteryLevel.toFixed(0) + "%" : "--%";
  valDistance.innerText = dev.totalDistance.toFixed(2) + " km";
  valUpdates.innerText = dev.updates;
  valTime.innerText = new Date(dev.lastActiveTime).toLocaleTimeString();
}

// Haversine Formula for distance calculation
function haversineDistance(pt1, pt2) {
  const R = 6371; // Earth's Radius in km
  const dLat = (pt2.lat - pt1.lat) * Math.PI / 180;
  const dLng = (pt2.lng - pt1.lng) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(pt1.lat * Math.PI / 180) * Math.cos(pt2.lat * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// HUD Controls Functions
function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  if (isDarkMode) {
    if (currentBaseLayer !== darkTiles) {
      map.removeLayer(currentBaseLayer);
      map.addLayer(darkTiles);
      currentBaseLayer = darkTiles;
    }
    if (hudDarkMode) {
      hudDarkMode.classList.add('active');
    }
  } else {
    if (currentBaseLayer !== streetTiles) {
      map.removeLayer(currentBaseLayer);
      map.addLayer(streetTiles);
      currentBaseLayer = streetTiles;
    }
    if (hudDarkMode) {
      hudDarkMode.classList.remove('active');
    }
  }
}

// HUD Pan Active Function
function togglePanActive() {
  isPanActive = !isPanActive;
  if (isPanActive) {
    hudPanActive.classList.add('active');
    if (selectedDeviceId && activeDevices.has(selectedDeviceId)) {
      map.panTo(activeDevices.get(selectedDeviceId).lastLatLng);
    }
  } else {
    hudPanActive.classList.remove('active');
  }
}

// Clear Path History for Selected Device
function clearPathHistory() {
  if (!selectedDeviceId) return;
  const dev = activeDevices.get(selectedDeviceId);
  if (dev) {
    dev.pathHistory = [[dev.lastLatLng.lat, dev.lastLatLng.lng]];
    dev.totalDistance = 0;
    dev.polyline.setLatLngs([[dev.lastLatLng.lat, dev.lastLatLng.lng]]);
    updateTelemetryUI(dev);
  }
}

// Modal Control Functions
function showModal(show) {
  if (show) {
    codeModal.classList.add('active');
  } else {
    codeModal.classList.remove('active');
  }
}

function copyArduinoCode() {
  const code = arduinoCodeElement.innerText;
  navigator.clipboard.writeText(code).then(() => {
    const originalText = copyCodeBtn.innerHTML;
    copyCodeBtn.innerHTML = `<i data-lucide="check" style="width: 12px; height: 12px;"></i> Copied!`;
    lucide.createIcons();
    setTimeout(() => {
      copyCodeBtn.innerHTML = originalText;
      lucide.createIcons();
    }, 2000);
  }).catch(err => {
    console.error("Could not copy Arduino source:", err);
  });
}

// GPS Simulator Controls
let simDevices = [];

function startSimulator() {
  if (simIntervalId) return;

  simStartBtn.disabled = true;
  simStopBtn.disabled = false;
  simCard.classList.add('sim-active-border');

  // Initialize 10 simulated devices around map center or default
  const centerLat = map.getCenter().lat;
  const centerLng = map.getCenter().lng;

  simDevices = [];
  for (let i = 1; i <= 10; i++) {
    const offsetLat = (Math.random() - 0.5) * 0.01;
    const offsetLng = (Math.random() - 0.5) * 0.01;
    simDevices.push({
      deviceId: `ESP32-SIM-${String(i).padStart(2, '0')}`,
      lat: centerLat + offsetLat,
      lng: centerLng + offsetLng
    });
  }

  console.log("Multi-device GPS simulation started.");

  simIntervalId = setInterval(() => {
    // Update each device coordinates and publish
    simDevices.forEach(simDev => {
      const driftLat = (Math.random() - 0.5) * 0.0004;
      const driftLng = (Math.random() - 0.5) * 0.0004;
      
      simDev.lat += driftLat;
      simDev.lng += driftLng;

      const payloadObj = {
        latitude: parseFloat(simDev.lat.toFixed(6)),
        longitude: parseFloat(simDev.lng.toFixed(6)),
        device_id: simDev.deviceId,
        battery_level: parseFloat((Math.random() * 100).toFixed(1)), // 0.0% to 100.0%
        timestamp: Date.now(),
        wifi_rssi: -Math.floor(Math.random() * 30 + 55) // -55 to -85 dBm
      };

      const payloadString = JSON.stringify(payloadObj);
      const deviceTopic = `esp32/${simDev.deviceId}/location`;

      // If connected to MQTT broker, publish simulation payload
      if (client && client.connected) {
        client.publish(deviceTopic, payloadString);
      } else {
        // Local loopback offline injection
        processIncomingGPS(payloadString, deviceTopic);
      }
    });
  }, 2000); // Updates every 2 seconds
}

function stopSimulator() {
  if (!simIntervalId) return;

  clearInterval(simIntervalId);
  simIntervalId = null;

  simStartBtn.disabled = false;
  simStopBtn.disabled = true;
  simCard.classList.remove('sim-active-border');
  console.log("GPS simulation stopped.");
}
