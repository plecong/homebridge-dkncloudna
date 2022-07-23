# Homebridge DKN Cloud NA

This [Homebridge](https://github.com/homebridge/homebridge) plugin provides a platform for connecting [DKN Cloud NA](https://dkncloudna.com) connected devices to Apple's [HomeKit](http://www.apple.com/ios/home/).

## Installation

### Prerequisites

- A DKN Cloud Wifi Adapter (e.g. [AZAI6WSCDKA](https://www.daikinac.com/content/commercial/accessories-and-controllers/daikin-dkn-wifi-solutions/)) that utilizes the [DKN Cloud NA](https://dkncloudna.com) app from the [iOS App Store](https://itunes.apple.com/us/app/dkn-cloud-na/id1444432503?mt=8) or [Google Play Store](https://play.google.com/store/apps/details?id=io.airzone.dknNA)
- [Node.js](https://nodejs.org/) and [Homebridge](https://github.com/homebridge/homebridge) installed. Follow the instructions on the [Homebridge Wiki](https://github.com/homebridge/homebridge/wiki) to install Node.js and Homebridge

### Using the Homebridge Config UI X

The plugin can be installed using the [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x)

### Manually

To install the plugin manually, run the following command:

```
npm -g i @plecong/homebridge-dkncloudna
```

## Configuration

### Using the Configuration UI

This plugin has a custom configuration UI. Open the configuration UI and enter your login information for the DKN Cloud NA app and select "Retrieve Tokens" to save access and refresh tokens needed to connect. These tokens are saved within the Homebrdge `config.json` and automatically refreshed.

The configuration UI also has the option to save your login information including your password. Select "Remember Login" to save the password directly within the Homebridge configuration file.

_Note: The configuration file is NOT secure, however saving your login information will ensure the plugin can always connect to DKN Cloud NA._

### Manually

This plugin can be configured manually using your email and password used to login to DKN Cloud NA. To manually configure, add the following JSON block to the Homebridge `config.json`:

```
{
    "platform": "dkncloudna",
    "email": "<your email address>"
    "password": "<your password>"
}
```
