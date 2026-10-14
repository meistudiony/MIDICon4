#include <cassert>
#include <cstring>
#include "../firmware/MIDICont/src/config/ConfigManager.h"
using namespace midi_cont;
struct MemoryStorage : ConfigurationStorage {
  bool succeeds = true;
  unsigned writes = 0;
  Configuration saved;
  bool save(const Configuration& configuration) override {
    ++writes;
    if (!succeeds) return false;
    saved = configuration;
    return true;
  }
};
int main() {
  auto config = factoryDefaults();
  config.networkMode = NetworkMode::Lan;
  config.networkSetupComplete = true;
  std::strcpy(config.wifiSsid, "studio");
  std::strcpy(config.wifiPassword, "test-password");
  config.calibration[0] = {150,3700};
  config.faders[0].cc = 80;
  config.screenBrightness = 200;
  MemoryStorage storage;
  assert(ConfigManager::reset(config, storage, ResetScope::Factory, false) == ResetResult::ConfirmationRequired);
  assert(storage.writes == 0 && config.faders[0].cc == 80);
  storage.succeeds = false;
  assert(ConfigManager::reset(config, storage, ResetScope::Factory, true) == ResetResult::StorageError);
  assert(config.faders[0].cc == 80 && config.wifiSsid[0] != 0);
  storage.succeeds = true;
  assert(ConfigManager::reset(config, storage, ResetScope::NetworkOnly, true) == ResetResult::RebootRequired);
  assert(config.networkMode == NetworkMode::Standalone && !config.networkSetupComplete);
  for (char c : config.wifiSsid) assert(c == 0);
  for (char c : config.wifiPassword) assert(c == 0);
  assert(config.calibration[0].minimum == 150 && config.faders[0].cc == 80);
  assert(config.screenBrightness == 200 && storage.saved.faders[0].cc == 80);
  assert(ConfigManager::reset(config, storage, ResetScope::Factory, true) == ResetResult::RebootRequired);
  assert(config.faders[0].cc == 21 && config.calibration[0].minimum == 0);
  assert(config.screenBrightness == 128 && config.version == 2);
  assert(storage.saved.faders[0].cc == 21);
}
