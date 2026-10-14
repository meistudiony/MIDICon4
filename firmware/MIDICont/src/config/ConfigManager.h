#pragma once
#include "Configuration.h"
namespace midi_cont {
// Future NVS adapter must persist this logical configuration using a versioned
// format. A failed save must preserve the previous stored configuration.
class ConfigurationStorage {
 public:
  virtual ~ConfigurationStorage() = default;
  virtual bool save(const Configuration& configuration) = 0;
};
enum class ResetScope { NetworkOnly, Factory };
enum class ResetResult { ConfirmationRequired, StorageError, RebootRequired };
class ConfigManager {
 public:
  // Shared by browser and local menu; callers must obtain explicit confirmation.
  // No reboot or live-state mutation until the replacement is saved successfully.
  static ResetResult reset(Configuration& current, ConfigurationStorage& storage,
                           ResetScope scope, bool confirmed) {
    if (!confirmed) return ResetResult::ConfirmationRequired;
    Configuration replacement = current;
    if (scope == ResetScope::Factory) replacement = factoryDefaults();
    else {
      replacement.networkMode = NetworkMode::Standalone;
      replacement.networkSetupComplete = false;
      for (char& c : replacement.wifiSsid) c = 0;
      for (char& c : replacement.wifiPassword) c = 0;
    }
    if (!storage.save(replacement)) return ResetResult::StorageError;
    current = replacement;
    return ResetResult::RebootRequired;
  }
};
}
