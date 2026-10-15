#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include "../hardware/HardwareConfig.h"
namespace midi_cont {
// Shared asynchronous scan state: HTTP polling never waits for the radio scan.
class NetworkScan {
 public:
  bool start() {
    if (WiFi.scanComplete() == WIFI_SCAN_RUNNING) return true;
    WiFi.scanDelete();
    // Arduino enables STA alongside the existing AP; it does not join a network.
    return WiFi.scanNetworks(true, false) != WIFI_SCAN_FAILED;
  }
  int16_t state() const { return WiFi.scanComplete(); }
  String results(int16_t count) const {
    String json = "{\"state\":\"complete\",\"networks\":[";
    bool first = true;
    for (int16_t i = 0; i < count && i < 64; ++i) {
      const int32_t rssi = WiFi.RSSI(i);
      if (rssi < hardware::MinimumNetworkRssiDbm) {
        continue;
      }

      const String ssid = WiFi.SSID(i);
      if (ssid.length() == 0 || ssid == WiFi.softAPSSID()) {
        continue;
      }
      if (!first) json += ',';
      first = false;
      json += "{\"ssid\":";
      json += quoted(ssid);
      json += ",\"rssi\":";
      json += rssi;
      json += ",\"secure\":";
      json += WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "false" : "true";
      json += '}';
    }
    json += "]}";
    return json;
  }
 private:
  static String quoted(const String& text) {
    String result = "\"";
    for (size_t i = 0; i < text.length(); ++i) {
      const uint8_t c = static_cast<uint8_t>(text[i]);
      if (c == '"' || c == '\\') { result += '\\'; result += static_cast<char>(c); }
      else if (c < 0x20) {
        char escaped[7]; snprintf(escaped, sizeof(escaped), "\\u%04x", c);
        result += escaped;
      } else result += static_cast<char>(c);
    }
    return result + '"';
  }
};
}
