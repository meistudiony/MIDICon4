#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
arduino-cli compile --fqbn 'esp32:esp32:XIAO_ESP32S3:USBMode=default,CDCOnBoot=cdc' --build-path .build firmware/MIDICont
