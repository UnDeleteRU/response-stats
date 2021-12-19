import * as http from "http";
import * as https from "https";

const PING_INTERVAL = Number(process.env.PING_INTERVAL) || 10000;
const SERVER_TIMEOUT = Number(process.env.SERVER_TIMEOUT) || 10000;
const MIN_RETRY_TIME = Number(process.env.MIN_RETRY_TIME) || 100;
const MAX_RETRY_TIME = Number(process.env.MAX_RETRY_TIME) || 60000;
const RETRY_EXP = Number(process.env.RETRY_EXP) || 2;
const CHECK_URL = process.env.CHECK_URL || "https://fundraiseup.com/";

type Ping = {
  pingId: number;
  deliveryAttempt: number;
  date: number;
  responseTime: number;
};

type Stats = {
  success: number;
  errors: number;
  timeouts: number;
  requests: number;
};

const post = (options: http.RequestOptions, body: string) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        method: "POST",
        ...options,
      },
      (res) => {
        if (res.statusCode === 500) {
          resolve("Internal Server Error");
        }

        const chunks: any[] = [];

        res.on("data", (data) => chunks.push(data));
        res.on("end", () => {
          let body = chunks.join();
          resolve(body);
        });
      }
    );

    req.on("error", (data) => reject(`Error: ${data}`));
    req.setTimeout(SERVER_TIMEOUT, () => reject("Timeout"));
    req.write(body);

    req.end();
  });

class ClientApp {
  protected pingId: number = 0;

  protected interval!: NodeJS.Timer;

  protected stats: Stats = { success: 0, errors: 0, timeouts: 0, requests: 0 };

  async sendPing(data: Ping, retryAfter: number = MIN_RETRY_TIME) {
    const postData = JSON.stringify(data);

    const options = {
      hostname: "127.0.0.1",
      port: 8080,
      path: "/data",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    let retry = true;
    let response;

    try {
      this.stats.requests += 1;
      response = await post(options, postData);

      if (response === "OK") {
        this.stats.success += 1;
        retry = false;
      } else {
        this.stats.errors += 1;
      }
    } catch (err) {
      this.stats.timeouts += 1;
      response = err;
    }

    console.log(postData, response);

    if (retry) {
      const nextRetryAfter = Math.round(retryAfter * RETRY_EXP);

      if (retryAfter > MAX_RETRY_TIME) {
        console.log("Ping send rejected due high server rejects");
      } else {
        setTimeout(
          () =>
            this.sendPing(
              { ...data, deliveryAttempt: data.deliveryAttempt + 1 },
              nextRetryAfter
            ),
          nextRetryAfter
        );
      }
    }
  }

  onSigint() {
    process.exit();
  }

  onExit() {
    console.log("stat:", this.stats);
  }

  async run() {
    if (!this.interval) {
      this.interval = setInterval(this.run.bind(this), PING_INTERVAL);
      process.on("SIGINT", this.onSigint.bind(this));
      process.on("exit", this.onExit.bind(this));
    }

    try {
      this.pingId += 1;
      const date = Date.now();
      await https.get(CHECK_URL);
      const responseTime = Date.now() - date;

      const ping: Ping = {
        pingId: this.pingId,
        deliveryAttempt: 1,
        date,
        responseTime,
      };

      await this.sendPing(ping);
    } catch (err) {
      console.log("ping send error", err);
    }
  }
}

const app = new ClientApp();
app.run();
