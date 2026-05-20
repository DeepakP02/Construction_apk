const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to fix @react-native-firebase iOS build on Expo SDK 55 / RN 0.77.
 *
 * Instead of `useFrameworks: "static"` (which causes non-modular header conflicts with React Native),
 * this plugin injects `use_modular_headers!` at the very top of the Podfile.
 * This generates module maps for static libraries, satisfying Firebase's requirements
 * while keeping all pods as static libraries and avoiding the Xcode framework header issues.
 */
module.exports = function withFirebasePodfileFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        console.warn('[withFirebasePodfileFix] Podfile not found, skipping.');
        return config;
      }

      let contents = fs.readFileSync(podfilePath, 'utf-8');
      let modified = false;

      // 1. Inject use_modular_headers! at the top
      if (!contents.includes('use_modular_headers!')) {
        contents = `use_modular_headers!\n\n` + contents;
        modified = true;
        console.log('[withFirebasePodfileFix] ✅ Injected use_modular_headers!');
      }

      // 2. Remove any existing custom post_install settings to keep it clean
      if (contents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        // Remove the previous CLANG fix block if it exists
        contents = contents.replace(
          /# Fix: Allow non-modular headers for Firebase pods[\s\S]*?end\s*?end/,
          ''
        );
        modified = true;
        console.log('[withFirebasePodfileFix] ✅ Cleaned up old CLANG fix blocks');
      }

      // 3. Remove RCT_USE_PREBUILT_RNCORE injection since it is no longer needed with static libraries
      if (contents.includes("ENV['RCT_USE_PREBUILT_RNCORE']")) {
        contents = contents.replace(/ENV\['RCT_USE_PREBUILT_RNCORE'\] = '0'\n\n/g, '');
        modified = true;
        console.log('[withFirebasePodfileFix] ✅ Cleaned up RCT_USE_PREBUILT_RNCORE');
      }

      if (modified) {
        fs.writeFileSync(podfilePath, contents);
      }

      return config;
    },
  ]);
};
