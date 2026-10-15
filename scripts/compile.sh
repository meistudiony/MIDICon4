#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
python3 scripts/embed-web.py
arduino-cli compile --fqbn 'esp32:esp32:XIAO_ESP32S3:USBMode=default,CDCOnBoot=default' --build-path "${MIDICONT_BUILD_DIR:-.build}" firmware/MIDICont
