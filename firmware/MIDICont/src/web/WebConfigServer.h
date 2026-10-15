#pragma once
#include <Arduino.h>
#include <WebServer.h>
#include <WiFi.h>
#include "WebAssets.generated.h"
namespace midi_cont {
// AP bring-up serves the same preview UI. No configuration mutation API yet.
class WebConfigServer {
 public:
  void begin() {
    if (!routesRegistered_) {
      route("/", "text/html; charset=utf-8", web_assets::Asset0);
      route("/index.html", "text/html; charset=utf-8", web_assets::Asset0);
      route("/style.css", "text/css; charset=utf-8", web_assets::Asset1);
      route("/app.mjs", "text/javascript; charset=utf-8", web_assets::Asset2);
      route("/model.mjs", "text/javascript; charset=utf-8", web_assets::Asset3);
      route("/device.mjs", "text/javascript; charset=utf-8", web_assets::Asset4);
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
  void stop() { server_.stop(); active_ = false; }
 private:
  void route(const char* uri, const char* type, const char* content) {
    server_.on(uri, HTTP_GET, [this, uri, type, content]() {
      ++requests_;
      Serial.printf("# HTTP GET %s\n", uri);
      server_.sendHeader("Cache-Control", "no-store");
      server_.send_P(200, type, content);
    });
  }
  WebServer server_{80};
  bool active_ = false, routesRegistered_ = false;
  uint32_t requests_ = 0;
};
}
