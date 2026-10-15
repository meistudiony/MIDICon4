#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>
#include <ESPmDNS.h>
#include "../hardware/DeviceIdentity.h"
namespace midi_cont {
struct NetworkSettings {
  bool complete = false, lan = false;
  String ssid, password, hostname = identity::StandaloneHostname, deviceName = identity::DeviceName;
};
class NetworkConnection {
 public:
  void load() {
    Preferences prefs;
    if (!prefs.begin("mc4-network", true)) return;
    uint8_t bytes[RecordSize] = {};
    const bool found = prefs.getBytesLength("settings") == RecordSize &&
                       prefs.getBytes("settings", bytes, RecordSize) == RecordSize;
    prefs.end();
    if (!found || bytes[0] != 1 || bytes[1] > 1 || bytes[2] > 1) return;
    uint32_t stored = 0;
    for (unsigned i = 0; i < 4; ++i) stored |= uint32_t(bytes[PayloadSize + i]) << (8 * i);
    if (stored != checksum(bytes, PayloadSize)) return;
    size_t offset = 3;
    NetworkSettings candidate;
    candidate.complete = bytes[1]; candidate.lan = bytes[2];
    if (!readField(bytes, offset, 33, candidate.ssid) ||
        !readField(bytes, offset, 65, candidate.password) ||
        !readField(bytes, offset, 33, candidate.hostname) ||
        !readField(bytes, offset, 33, candidate.deviceName) || !valid(candidate)) return;
    candidate.deviceName = identity::DeviceName;
    candidate.hostname = candidate.lan
      ? identity::LanHostname
      : identity::StandaloneHostname;
    saved_ = candidate;
  }
  bool configure(NetworkSettings candidate, bool keepPassword) {
    candidate.deviceName = identity::DeviceName;
    candidate.hostname = candidate.lan
      ? identity::LanHostname
      : identity::StandaloneHostname;
    if (connecting_) { error_ = "A connection attempt is already running."; return false; }
    if (keepPassword && candidate.lan && saved_.lan && candidate.ssid == saved_.ssid)
      candidate.password = saved_.password;
    candidate.complete = true;
    if (!valid(candidate)) { error_ = "Invalid network settings. Check SSID, password and hostname."; return false; }
    error_ = "";
    if (!candidate.lan) {
      candidate.ssid = ""; candidate.password = "";
      if (!persist(candidate)) { error_ = "Could not save network settings. Previous settings kept."; return false; }
      saved_ = candidate; state_ = "standalone";
      // Keep the LAN up briefly so this request can return before switching.
      leaveLanPending_ = true;
      leaveLanAt_ = millis();
      startMdns(identity::StandaloneHostname);
      return true;
    }
    pending_ = candidate;
    connect(true);
    return true;
  }
  void startSaved() {
    error_ = "";
    if (saved_.complete && saved_.lan) { pending_ = saved_; connect(false); }
    else { state_ = "standalone"; startMdns(identity::StandaloneHostname); }
  }
  void tick() {
    if (leaveLanPending_ && millis() - leaveLanAt_ >= 2000) {
      leaveLanPending_ = false;
      WiFi.disconnect(false, false);
    }
    if (!connecting_) {
      if (String(state_) == "connected" && WiFi.status() != WL_CONNECTED)
        failed("LAN connection lost. Direct setup remains available.");
      return;
    }
    if (WiFi.status() == WL_CONNECTED && WiFi.SSID() == pending_.ssid && WiFi.localIP() != IPAddress(0,0,0,0)) {
      if (saveOnSuccess_ && !persist(pending_)) {
        failed("Connected, but saving failed. Previous settings kept; direct setup is still available."); return;
      }
      saved_ = pending_;
      connecting_ = false;
      state_ = "connected";
      connectedAt_ = millis();
      handoffAcknowledged_ = false;
      startMdns(identity::LanHostname);
      Serial.printf("# LAN connected: http://%s/  http://%s.local/\n", WiFi.localIP().toString().c_str(), saved_.hostname.c_str());
    } else if (millis() - started_ >= 20000) {
      failed("Could not connect within 20 seconds. Check the password and network. Direct setup remains available.");
    }
  }
  void stop() { leaveLanPending_ = false; connecting_ = false; state_ = "idle"; MDNS.end(); mdns_ = false; }
  bool connecting() const { return connecting_; }

  void acknowledgeHandoff() {
    if (String(state_) == "connected") {
      handoffAcknowledged_ = true;
      handoffAt_ = millis();
    }
  }

  bool shouldStopAp() const {
    if (String(state_) != "connected") {
      return false;
    }
    // Saved connections at boot need no browser handoff. New connections allow
    // the page to receive/render the LAN address before acknowledging shutdown.
    return !saveOnSuccess_
      || (handoffAcknowledged_ && millis() - handoffAt_ >= 1500)
      || millis() - connectedAt_ >= 30000;
  }
  const char* state() const { return state_; }
  const String& error() const { return error_; }
  const NetworkSettings& settings() const { return saved_; }
  static String quoted(const String& text) {
    String result = "\"";
    for (size_t i = 0; i < text.length(); ++i) {
      const uint8_t c = static_cast<uint8_t>(text[i]);
      if (c == '"' || c == '\\') { result += '\\'; result += static_cast<char>(c); }
      else if (c < 0x20) { char escaped[7]; snprintf(escaped, sizeof(escaped), "\\u%04x", c); result += escaped; }
      else result += static_cast<char>(c);
    }
    return result + '"';
  }
  String json() const {
    String value = "{\"state\":"; value += quoted(state_);
    value += ",\"error\":"; value += quoted(error_);
    value += ",\"ip\":"; value += quoted(WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "");
    value += ",\"activeHostname\":";
    value += quoted(String(state_) == "connected" ? identity::LanHostname : identity::StandaloneHostname);
    value += ",\"mdns\":"; value += mdns_ ? "true" : "false";
    value += ",\"settings\":{\"networkMode\":"; value += quoted(saved_.lan ? "lan" : "standalone");
    value += ",\"networkSetupComplete\":"; value += saved_.complete ? "true" : "false";
    value += ",\"wifiSsid\":"; value += quoted(saved_.ssid);
    value += ",\"hostname\":"; value += quoted(saved_.lan ? identity::LanHostname : identity::StandaloneHostname);
    value += ",\"deviceName\":"; value += quoted(identity::DeviceName);
    value += ",\"hasPassword\":"; value += saved_.password.length() ? "true" : "false";
    value += "}}";
    return value;
  }
 private:
  static constexpr size_t PayloadSize = 3 + 33 + 65 + 33 + 33;
  static constexpr size_t RecordSize = PayloadSize + 4;
  static uint32_t checksum(const uint8_t* data, size_t size) {
    uint32_t hash = 2166136261u;
    for (size_t i = 0; i < size; ++i) { hash ^= data[i]; hash *= 16777619u; }
    return hash;
  }
  static bool readField(const uint8_t* bytes, size_t& offset, size_t size, String& destination) {
    if (bytes[offset + size - 1] != 0) return false;
    destination = reinterpret_cast<const char*>(bytes + offset); offset += size; return true;
  }
  static bool valid(const NetworkSettings& value) {
    if (value.deviceName.length() == 0 || value.deviceName.length() > 32 ||
        value.hostname.length() == 0 || value.hostname.length() > 32 ||
        value.ssid.length() > 32 || value.password.length() > 63) return false;
    if (value.lan && (!value.ssid.length() || (value.password.length() && value.password.length() < 8))) return false;
    const String& name = value.hostname;
    if (name[0] == '-' || name[name.length()-1] == '-') return false;
    for (size_t i = 0; i < name.length(); ++i)
      if (!((name[i] >= 'a' && name[i] <= 'z') || (name[i] >= '0' && name[i] <= '9') || name[i] == '-')) return false;
    return true;
  }
  bool persist(const NetworkSettings& value) {
    uint8_t bytes[RecordSize] = {};
    bytes[0] = 1; bytes[1] = value.complete; bytes[2] = value.lan;
    size_t offset = 3;
    const String* fields[] = {&value.ssid, &value.password, &value.hostname, &value.deviceName};
    for (const String* field : fields) {
      const size_t size = field == &value.password ? 65 : 33;
      field->toCharArray(reinterpret_cast<char*>(bytes + offset), size); offset += size;
    }
    const uint32_t hash = checksum(bytes, PayloadSize);
    for (unsigned i = 0; i < 4; ++i) bytes[PayloadSize + i] = (hash >> (8 * i)) & 255;
    Preferences prefs;
    if (!prefs.begin("mc4-network", false)) return false;
    const bool result = prefs.putBytes("settings", bytes, RecordSize) == RecordSize;
    prefs.end(); return result;
  }
  void connect(bool save) {
    leaveLanPending_ = false;
    handoffAcknowledged_ = false;
    saveOnSuccess_ = save; connecting_ = true; state_ = "connecting"; started_ = millis();
    MDNS.end(); mdns_ = false;
    WiFi.mode(WIFI_AP_STA); WiFi.setAutoReconnect(false);
    WiFi.disconnect(false, false); WiFi.setHostname(pending_.hostname.c_str());
    WiFi.begin(pending_.ssid.c_str(), pending_.password.c_str());
    startMdns(identity::StandaloneHostname);
  }
  void failed(const char* message) {
    connecting_ = false; state_ = "failed"; error_ = message;
    WiFi.disconnect(false, false); startMdns(identity::StandaloneHostname);
    Serial.println("# LAN attempt failed; AP remains available.");
  }
  void startMdns(const String& hostname) {
    MDNS.end(); mdns_ = MDNS.begin(hostname.c_str());
    if (mdns_) MDNS.addService("http", "tcp", 80);
  }
  NetworkSettings saved_, pending_;
  bool connecting_ = false, saveOnSuccess_ = false, mdns_ = false;
  const char* state_ = "idle";
  String error_;
  uint32_t started_ = 0;
  uint32_t connectedAt_ = 0;
  uint32_t handoffAt_ = 0;
  bool handoffAcknowledged_ = false;
  bool leaveLanPending_ = false;
  uint32_t leaveLanAt_ = 0;
};
}
