#pragma once
#include <Arduino.h>
#include <WebServer.h>
#include <WiFi.h>
#include "WebAssets.generated.h"
#include "NetworkScan.h"
#include "../network/NetworkConnection.h"
namespace midi_cont {
// AP bring-up serves the same preview UI. No configuration mutation API yet.
class WebConfigServer {
 public:
  explicit WebConfigServer(NetworkConnection& connection) : connection_(connection) {}
  void begin() {
    if (!routesRegistered_) {
      route("/", "text/html; charset=utf-8", web_assets::Asset0);
      route("/index.html", "text/html; charset=utf-8", web_assets::Asset0);
      route("/style.css", "text/css; charset=utf-8", web_assets::Asset1);
      route("/app.mjs", "text/javascript; charset=utf-8", web_assets::Asset2);
      route("/model.mjs", "text/javascript; charset=utf-8", web_assets::Asset3);
      route("/device.mjs", "text/javascript; charset=utf-8", web_assets::Asset4);
      server_.on("/api/network", HTTP_GET, [this]() {
        server_.sendHeader("Cache-Control", "no-store");
        server_.send(200, "application/json", networkJson());
      });
      server_.on("/api/network/handoff", HTTP_POST, [this]() {
        connection_.acknowledgeHandoff();
        server_.sendHeader("Cache-Control", "no-store");
        server_.send(200, "application/json", "{\"ok\":true}");
      });
      server_.on("/api/network", HTTP_POST, [this]() {
        server_.sendHeader("Cache-Control", "no-store");
        if (connection_.connecting()) {
          server_.send(409, "application/json", "{\"error\":\"A connection attempt is already running.\"}"); return;
        }
        if (!server_.hasArg("mode") || (server_.arg("mode") != "lan" && server_.arg("mode") != "standalone")) {
          server_.send(400, "application/json", "{\"error\":\"Choose standalone or LAN.\"}"); return;
        }
        NetworkSettings settings;
        settings.lan = server_.arg("mode") == "lan";
        settings.ssid = server_.arg("ssid"); settings.password = server_.arg("password");
        settings.hostname = settings.lan
          ? identity::LanHostname
          : identity::StandaloneHostname;
        // Device identity comes from the unit build, never the browser.
        settings.deviceName = identity::DeviceName;
        if (!connection_.configure(settings, server_.arg("keepPassword") == "true")) {
          String error = "{\"error\":"; error += NetworkConnection::quoted(connection_.error()); error += '}';
          server_.send(400, "application/json", error); return;
        }
        server_.send(settings.lan ? 202 : 200, "application/json", networkJson());
      });
      server_.on("/api/networks/scan", HTTP_POST, [this]() {
        if (connection_.connecting()) {
          server_.send(409, "application/json", "{\"error\":\"Wait for the connection attempt before scanning.\"}"); return;
        }
        server_.sendHeader("Cache-Control", "no-store");
        if (!scan_.start()) {
          server_.send(503, "application/json", "{\"error\":\"Network scan could not start. Try Refresh.\"}");
          return;
        }
        server_.send(202, "application/json", "{\"state\":\"scanning\"}");
      });
      server_.on("/api/networks", HTTP_GET, [this]() {
        server_.sendHeader("Cache-Control", "no-store");
        const int16_t count = scan_.state();
        if (count == WIFI_SCAN_RUNNING)
          server_.send(202, "application/json", "{\"state\":\"scanning\"}");
        else if (count < 0)
          server_.send(503, "application/json", "{\"error\":\"Network scan failed. Try Refresh.\"}");
        else server_.send(200, "application/json", scan_.results(count));
      });
      server_.on("/api/status", HTTP_GET, [this]() {
        String json = "{\"mode\":\"ap-preview\",\"configurationBackend\":\"browser-only\",\"clients\":";
        json += WiFi.softAPgetStationNum();
        json += ",\"uptimeMs\":"; json += millis();
        json += ",\"pageRequests\":"; json += requests_;
        json += "}";
        server_.sendHeader("Cache-Control", "no-store");
        server_.send(200, "application/json", json);
      });
      server_.onNotFound([this]() { server_.send(404, "text/plain", "Not found"); });
      routesRegistered_ = true;
    }
    server_.begin();
    active_ = true;
  }
  void tick() { if (active_) server_.handleClient(); }
  void stop() { server_.stop(); WiFi.scanDelete(); active_ = false; }
 private:
  String networkJson() {
    String json = connection_.json();
    json.remove(json.length() - 1);
    json += ",\"viaAp\":";
    json += server_.client().localIP() == WiFi.softAPIP() ? "true" : "false";
    json += '}';
    return json;
  }

  void route(const char* uri, const char* type, const char* content) {
    server_.on(uri, HTTP_GET, [this, uri, type, content]() {
      ++requests_;
      Serial.printf("# HTTP GET %s\n", uri);
      server_.sendHeader("Cache-Control", "no-store");
      server_.send_P(200, type, content);
    });
  }
  NetworkConnection& connection_;
  WebServer server_{80};
  NetworkScan scan_;
  bool active_ = false, routesRegistered_ = false;
  uint32_t requests_ = 0;
};
}
