
  cordova.define('cordova/plugin_list', function(require, exports, module) {
    module.exports = [
      {
          "id": "cordova-plugin-volume-control.VolumeControl",
          "file": "plugins/cordova-plugin-volume-control/www/VolumeControl.js",
          "pluginId": "cordova-plugin-volume-control",
        "clobbers": [
          "cordova.plugins.VolumeControl"
        ]
        }
    ];
    module.exports.metadata =
    // TOP OF METADATA
    {
      "cordova-plugin-volume-control": "0.1.8"
    };
    // BOTTOM OF METADATA
    });
    