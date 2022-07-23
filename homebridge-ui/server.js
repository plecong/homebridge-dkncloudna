/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const {
  HomebridgePluginUiServer,
  RequestError,
} = require("@homebridge/plugin-ui-utils");
const fetch = require("node-fetch");

const USER_AGENT = `Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148`;

class PluginServer extends HomebridgePluginUiServer {
  constructor() {
    super();
    this.onRequest("/login", this.handleLogin);
    this.ready();
  }
  async handleLogin(payload) {
    console.log("payload", payload);
    const response = await fetch(
      "https://dkncloudna.com/api/v1/auth/login/dknUsa",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    if (response && response.ok) {
      return data;
    } else {
      throw new RequestError(`Unable to login`, {
        status: response.status,
        data,
      });
    }
  }
}

// start the instance of the class
(() => {
  return new PluginServer();
})();
