#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <esp_mac.h>
#include "../web/WebConfigServer.h"
namespace midi_cont {
// Saved network configuration starts setup automatically at boot.
class NetworkManager {
 public:
  void begin() {
    WiFi.persistent(false);
    connection_.load();
    WiFi.mode(WIFI_OFF);

    if (connection_.settings().complete) {
      startSetup();
    }
  }
  bool startSetup() {
    if (active_) { printStatus(); return true; }
    if (!WiFi.mode(WIFI_AP)) return fail();
    uint8_t mac[6] = {};
    if (esp_read_mac(mac, ESP_MAC_WIFI_SOFTAP) != ESP_OK) return fail();
    snprintf(ssid_, sizeof(ssid_), "MIDICon4-%02X%02X%02X", mac[3], mac[4], mac[5]);
    // Readable setup password, kept consistent across AP sessions.
    strcpy(password_, "midisetup");
    const IPAddress address(192, 168, 4, 1), mask(255, 255, 255, 0);
    if (!WiFi.softAPConfig(address, address, mask) || !WiFi.softAP(ssid_, password_)) return fail();
    web_.begin(); active_ = true; clients_ = 0;
    connection_.startSaved();
    printStatus();
    return true;
  }
  void tick() {
    if (!active_) return;
    connection_.tick();
    web_.tick();

    const bool apRunning = (WiFi.getMode() & WIFI_MODE_AP) != 0;
    if (apRunning && connection_.shouldStopAp()) {
      if (WiFi.mode(WIFI_STA)) {
        Serial.println("# LAN connected; setup AP OFF.");
      }
    } else if (!apRunning &&
               (String(connection_.state()) == "failed" ||
                String(connection_.state()) == "standalone")) {
      const IPAddress address(192, 168, 4, 1);
      const IPAddress mask(255, 255, 255, 0);
      if (WiFi.enableAP(true) &&
          WiFi.softAPConfig(address, address, mask) &&
          WiFi.softAP(ssid_, password_)) {
        Serial.println("# Setup AP restored.");
      } else {
        Serial.println("# Could not restore setup AP.");
      }
    }

    const uint8_t clients = WiFi.softAPgetStationNum();
    if (clients != clients_) {
      clients_ = clients;
      Serial.printf("# AP connected clients=%u\n", clients_);
    }
  }
  void stopSetup() {
    connection_.stop(); web_.stop(); WiFi.softAPdisconnect(true); WiFi.mode(WIFI_OFF);
    active_ = false;
    memset(password_, 0, sizeof(password_));
    Serial.println("# Setup stopped; Wi-Fi OFF.");
  }
  void printStatus() const {
    if (!active_) { Serial.println("# Wi-Fi OFF. Type w to start AP setup."); return; }
    if ((WiFi.getMode() & WIFI_MODE_AP) == 0) {
      Serial.printf(
        "# LAN setup: http://%s/  http://%s.local/ (AP OFF)\n",
        WiFi.localIP().toString().c_str(),
        identity::LanHostname
      );
      return;
    }
    Serial.printf("# AP SSID: %s\n# AP password: %s\n", ssid_, password_);
    Serial.println("# Setup URL: http://192.168.4.1/");
    Serial.println("# Network settings are saved on the device; CC/calibration remain preview-only.");
    Serial.println("# Type x to stop setup and turn Wi-Fi OFF.");
  }
 private:
  bool fail() { WiFi.mode(WIFI_OFF); Serial.println("# AP start failed; Wi-Fi OFF."); return false; }
  NetworkConnection connection_;
  WebConfigServer web_{connection_};
  bool active_ = false;
  uint8_t clients_ = 0;
  char ssid_[33] = {}, password_[17] = {};
};
}
