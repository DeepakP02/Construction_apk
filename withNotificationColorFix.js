const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withNotificationColorFix(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    const application = androidManifest.application[0];

    // Ensure meta-data array exists
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    // Add or update the meta-data with tools:replace
    const colorMetaData = {
      $: {
        'android:name': 'com.google.firebase.messaging.default_notification_color',
        'android:resource': '@color/notification_icon_color',
        'tools:replace': 'android:resource',
      },
    };

    // Replace if exists, or push
    const index = application['meta-data'].findIndex(
      (item) => item.$ && item.$['android:name'] === 'com.google.firebase.messaging.default_notification_color'
    );

    if (index !== -1) {
      application['meta-data'][index] = colorMetaData;
    } else {
      application['meta-data'].push(colorMetaData);
    }

    // Ensure tools namespace is added to manifest
    if (!androidManifest.$) {
      androidManifest.$ = {};
    }
    androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    return config;
  });
};
