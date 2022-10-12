# Homebridge DKN Cloud NA

This [Homebridge](https://github.com/homebridge/homebridge) plugin provides a platform for connecting devices using [DKN Cloud NA](https://dkncloudna.com) to Apple's [HomeKit](http://www.apple.com/ios/home/).

## Installation

### Prerequisites

- A DKN Cloud Wifi Adapter (e.g. [AZAI6WSCDKA](https://www.daikinac.com/content/commercial/accessories-and-controllers/daikin-dkn-wifi-solutions/)) that utilizes the [DKN Cloud NA](https://dkncloudna.com) app from the [iOS App Store](https://itunes.apple.com/us/app/dkn-cloud-na/id1444432503?mt=8) or [Google Play Store](https://play.google.com/store/apps/details?id=io.airzone.dknNA).
- [Node.js](https://nodejs.org/) and [Homebridge](https://github.com/homebridge/homebridge) installed. Follow the instructions on the [Homebridge Wiki](https://github.com/homebridge/homebridge/wiki) to install Node.js and Homebridge.

### Using the Homebridge Config UI X

The plugin can be installed using the [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x)

### Manually

To install the plugin manually, run the following command:

```
npm -g i @plecong/homebridge-dkncloudna
```

## Configuration

### Using the Configuration UI

This plugin has a custom configuration UI. Open the configuration UI and enter your login information for the DKN Cloud NA app and select "Retrieve Tokens" to save access and refresh tokens needed to connect. These tokens are saved within the Homebrdge `config.json` and are automatically refreshed.

The configuration UI also has the option to save your login information including your password. Select "Remember Login" to save the password directly within the Homebridge configuration file.

_Note: The configuration file is NOT secure, however saving your login information will ensure the plugin can always connect to DKN Cloud NA._

### Manually

This plugin can be configured manually using your email and password used to login to DKN Cloud NA. To manually configure, add the following to the Homebridge `config.json` under `platforms`:

```json
{
    "platform": "dkncloudna",
    "email": "<your email address>"
    "password": "<your password>"
}
```

### Configuration Options

| Option           | Description                                                                                                          | Type      | Required |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- | --------- | -------- |
| `platform`       | Must be `dkncloudna` for Homebridge to recognize the configuration                                                   | N/A       | `true`   |
| `email`          | Email address to login to DKN Cloud NA app                                                                           | `string`  | `false`  |
| `password`       | Password to login to DKN Cloud NA app                                                                                | `string`  | `false`  |
| `token`          | Token used to access DKN Cloud NA API. This will be set by the configuration UI by providing your `email`/`password` | `string`  | `false`  |
| `refreshToken`   | Token used to refresh the Access Token when expired. This does not need to be manually set.                          | `string`  | `false`  |
| `enableExterior` | Enable the Exterior Temperature Sensor (restart required)                                                            | `boolean` | `false`  |
| `enableFan`      | Enable the EXPERIMENTAL Fan V2 control (restart required)                                                            | `boolean` | `false`  |

## Features

### Fan Control (_EXPERIMENTAL_)

By enabling the fan control in the configuration, a separate [Fan V2 service](https://developers.homebridge.io/#/service/Fanv2) is associated with the accessory. This allows for controlling the fan state (Auto/Manual), rotation speed (20%, 40%, 60%, 80%, 100%), and swing mode. The HomeKit Fan service does not map cleanly to the DKN Cloud NA app and the DKN Cloud NA app doesn't provide raw rotation speed, so the current implementation of the fan control is **EXPERIMENTAL**.

## Release Notes

### v0.1.0

- Initial Release

### v0.1.1

- [#6](https://github.com/plecong/homebridge-dkncloudna/issues/6) Fix for issue loading on [HOOBS](https://hoobs.com) due to import of `homebridge`

## Credits

- [homebridge-airzone-cloud](https://github.com/fjhorrillo/homebridge-airzone-cloud) Copyright &copy; 2021 Francisco Javier Horrillo Sancho. All rights reserved.
- [homebridge-ring](https://github.com/dgreif/ring) Copyright &copy; 2019 Dusty Greif
