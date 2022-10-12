# Contributing

## Environment Setup

To develop changes for this plugin you will need [Homebridge installed](https://github.com/homebridge/homebridge/wiki). You'll need to run:

`sudo hb-service-install`

to create a new `config.json` within your Homebridge configuration folder (typically at `~/.homebridge`).

## Running Locally

From within the `homebridge-dkncloudna` repository local workspace:

1. Build the plugin

   `npm run build`

2. Link to Homebridge

   `npm link`

3. Update your `config.json` to include configuration for this plugin. Add the following block under `platforms`:

   ```
       {
       "platform": "dkncloudna",
       "email": "<your login email>",
       "password": "<your login password>"
       }
   ```

4. Start Homebridge in Debug mode:

   `homebrige -D`

## References

- [Homebridge Plugin Development](https://developers.homebridge.io/#/)
- [Homebridge Plugin Template Repository](https://github.com/homebridge/homebridge-plugin-template)

```

```
