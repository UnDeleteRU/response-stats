import Fastify from "fastify";

const fastify = Fastify();

const BORDER_NO_REPLY = 20;
const BORDER_500 = BORDER_NO_REPLY + 20;

type requestBody = {
  responseTime: number;
};

const times: number[] = [];

const onSigint = () => {
  process.exit();
};

const onExit = () => {
  if (times.length === 0) {
    console.log("No time data");
    return;
  }

  times.sort();
  const sum = times.reduce((sum, value) => sum + value, 0);
  let median: number;

  if (times.length % 2 === 0) {
    const index = Math.floor(times.length / 2);
    median = (times[index - 1] + times[index]) / 2;
  } else {
    median = times[Math.ceil(times.length / 2)];
  }

  console.log(`Mean: ${sum / times.length}`);
  console.log(`Median: ${median}`);
};

fastify.post("/data", (request, reply) => {
  const random = Math.floor(Math.random() * 100);

  if (random >= BORDER_500) {
    reply.send("OK");
    console.log("Request accepted", request.body);
    const { responseTime } = request.body as requestBody;

    if (responseTime !== undefined) {
      const time = Number(responseTime);
      times.push(time);
    }
  } else if (random >= BORDER_NO_REPLY) {
    reply.status(500).send();
  }
});

process.on("SIGINT", onSigint);
process.on("exit", onExit);
fastify.listen(8080);
