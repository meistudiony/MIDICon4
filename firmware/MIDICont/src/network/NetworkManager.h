#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <esp_system.h>
#include <esp_mac.h>
#include "../web/WebConfigServer.h"
namespace midi_cont {
// Temporary serial-triggered AP bring-up. No LAN provisioning or NVS yet.
class NetworkManager {
 public:
  void begin() { WiFi.mode(WIFI_OFF); }
  bool startSetup() {
    if (active_) { printStatus(); return true; }
    if (!WiFi.mode(WIFI_AP)) return fail();
    uint8_t mac[6] = {};
    if (esp_read_mac(mac, ESP_MAC_WIFI_SOFTAP) != ESP_OK) return fail();
    snprintf(ssid_, sizeof(ssid_), "MIDICon4-%02X%02X%02X", mac[3], mac[4], mac[5]);
    // Random per session, not a shared password committed in the repository.
    snprintf(password_, sizeof(password_), "%08lx%08lx",
             static_cast<unsigned long>(esp_random()), static_cast<unsigned long>(esp_random()));
    const IPAddress address(192, 168, 4, 1), mask(255, 255, 255, 0);
    if (!WiFi.softAPConfig(address, address, mask) || !WiFi.softAP(ssid_, password_)) return fail();
    web_.begin(); active_ = true; clients_ = 0;
    printStatus();
    return true;
  }
  void tick() {
    if (!active_) return;
    web_.tick();
    const uint8_t clients = WiFi.softAPgetStationNum();
    if (clients != clients_) {
      clients_ = clients;
      Serial.printf("# AP connected clients=%u\n", clients_);
    }
  }
  void stopSetup() {
    web_.stop(); WiFi.softAPdisconnect(true); WiFi.mode(WIFI_OFF);
    active_ = false;
    memset(password_, 0, sizeof(password_));
    Serial.println("# Setup stopped; Wi-Fi OFF.");
  }
  void printStatus() const {
    if (!active_) { Serial.println("# Wi-Fi OFF. Type w to start AP setup."); return; }
    Serial.printf("# AP SSID: %s\n# AP password: %s\n", ssid_, password_);
    Serial.println("# Setup URL: http://192.168.4.1/");
    Serial.println("# UI is a browser-only preview; configuration is not saved to the device yet.");
    Serial.println("# Type x to stop setup and turn Wi-Fi OFF.");
  }
 private:
  bool fail() { WiFi.mode(WIFI_OFF); Serial.println("# AP start failed; Wi-Fi OFF."); return false; }
  WebConfigServer web_;
  bool active_ = false;
  uint8_t clients_ = 0;
  char ssid_[33] = {}, password_[17] = {};
};
}
