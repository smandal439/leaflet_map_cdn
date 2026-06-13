/*
 * ESP32 MQTT GPS Tracker
 * -----------------------
 * This sketch connects an ESP32 to a Wi-Fi network and publishes GPS coordinates
 * in JSON format to an MQTT broker over TCP port 1883.
 * 
 * Hardware Setup (Optional - Neo-6M GPS Module):
 * - GPS VCC  -> ESP32 3.3V or 5V
 * - GPS GND  -> ESP32 GND
 * - GPS TX   -> ESP32 GPIO 16 (RX2)
 * - GPS RX   -> ESP32 GPIO 17 (TX2)
 * 
 * Required Libraries (Install via Library Manager):
 * - PubSubClient (by Nick O'Leary)
 * - ArduinoJson (by Benoit Blanchon)
 * - TinyGPS++ (by Mikal Hart) - Optional (only if using physical GPS module)
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ==================== CONFIGURATION ====================
// 1. Wi-Fi Settings
const char* ssid = "Wokwi-GUEST";
const char* password = "";

// 2. MQTT Broker Settings (Standard TCP port 1883)
const char* mqtt_server = "broker.emqx.io";
const int mqtt_port = 1883;

// Dynamic device identification variables
String device_id;
String mqtt_topic;

// 3. LED Indicator Pin (GPIO 2 is the built-in LED on most ESP32 Dev Kits)
const int LED_PIN = 2;

// 4. GPS Pin Setup (Hardware Serial 2)
#define RXD2 16
#define TXD2 17
#define GPS_BAUD 9600
// =======================================================

WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastPublishTime = 0;
const unsigned long publishInterval = 5000; // Publish every 5 seconds (5000 ms)

// Simulated GPS coordinate variables (centered near Kolkata by default)
float simulatedLat = 22.5726;
float simulatedLng = 88.3639;

// True if using real GPS module. If false, it will fall back to simulated coordinates.
bool useRealGPS = false; 

void setup() {
  // Initialize standard hardware serial for debugging output
  Serial.begin(115200);
  
  // Initialize Hardware Serial 2 for Neo-6M GPS Module
  Serial2.begin(GPS_BAUD, SERIAL_8N1, RXD2, TXD2);
  
  // Set onboard LED as output
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Serial.println("\n--- ESP32 MQTT GPS Tracker Starting ---");
  
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);

  // Generate Unique Device ID & Topic using MAC Address
  uint64_t chipid = ESP.getEfuseMac();
  char devId[30];
  snprintf(devId, sizeof(devId), "ESP32-%04X%08X", (uint16_t)(chipid>>32), (uint32_t)chipid);
  device_id = String(devId);
  mqtt_topic = "esp32/" + device_id + "/location";
  
  Serial.print("Device ID: ");
  Serial.println(device_id);
  Serial.print("MQTT Topic: ");
  Serial.println(mqtt_topic);
}

void setup_wifi() {
  delay(10);
  Serial.print("Connecting to Wi-Fi SSID: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  // Blink LED while connecting to Wi-Fi
  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(LED_PIN, HIGH);
    delay(250);
    digitalWrite(LED_PIN, LOW);
    delay(250);
    Serial.print(".");
  }

  digitalWrite(LED_PIN, HIGH); // Steady LED when connected to Wi-Fi
  Serial.println("\nWi-Fi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection to broker...");
    
    // Attempt to connect
    if (client.connect(device_id.c_str())) {
      Serial.println("CONNECTED to MQTT Broker.");
      // If we need to subscribe to topics on ESP32, do it here:
      // client.subscribe("esp32/commands");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" - trying again in 5 seconds.");
      
      // Blink LED quickly to indicate connection failure
      for(int i=0; i<5; i++) {
        digitalWrite(LED_PIN, HIGH);
        delay(100);
        digitalWrite(LED_PIN, LOW);
        delay(100);
      }
      delay(4000);
    }
  }
}

void loop() {
  // Ensure MQTT client stays connected
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Read GPS Serial stream (checks if actual Neo-6M data is arriving)
  while (Serial2.available() > 0) {
    char c = Serial2.read();
    // In production, uncomment the line below to feed characters to TinyGPS++
    // gps.encode(c);
    useRealGPS = true; // Set flag to true if we are reading bytes from GPS port
  }

  unsigned long currentMillis = millis();
  if (currentMillis - lastPublishTime >= publishInterval) {
    lastPublishTime = currentMillis;

    float finalLat = 0.0;
    float finalLng = 0.0;
    bool locationValid = false;

    if (useRealGPS) {
      // Real GPS logic (uncomment when using TinyGPS++ library)
      /*
      if (gps.location.isValid()) {
        finalLat = gps.location.lat();
        finalLng = gps.location.lng();
        locationValid = true;
        Serial.print("Real GPS Lock: ");
      } else {
        Serial.println("Real GPS module detected but waiting for satellite lock...");
      }
      */
    }
    
    // Fall back to simulation if real GPS coordinates are invalid or not present
    if (!locationValid) {
      // Simulate random walk
      simulatedLat += ((float)random(-150, 150) / 100000.0);
      simulatedLng += ((float)random(-150, 150) / 100000.0);
      finalLat = simulatedLat;
      finalLng = simulatedLng;
      locationValid = true;
      Serial.print("Simulated GPS: ");
    }

    if (locationValid) {
      // Create JSON payload
      StaticJsonDocument<200> doc;
      doc["latitude"] = finalLat;
      doc["longitude"] = finalLng;
      doc["device_id"] = device_id;
      doc["timestamp"] = currentMillis;
      
      // Additional telemetry metadata can be added easily:
      doc["wifi_rssi"] = WiFi.RSSI();

      char jsonBuffer[256];
      serializeJson(doc, jsonBuffer);

      Serial.print("Publishing to ");
      Serial.print(mqtt_topic);
      Serial.print(": ");
      Serial.println(jsonBuffer);

      // Publish the JSON packet to MQTT
      if (client.publish(mqtt_topic.c_str(), jsonBuffer)) {
        // Flash built-in LED briefly to show successful transmission
        digitalWrite(LED_PIN, LOW);
        delay(100);
        digitalWrite(LED_PIN, HIGH);
      } else {
        Serial.println("MQTT Publish failed!");
      }
    }
  }
}
