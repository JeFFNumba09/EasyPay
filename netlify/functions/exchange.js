const { Redis } = require("@upstash/redis");
const redis = Redis.fromEnv();

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    payload = {};
  }

  const reference = payload?.reference;
  const statusAction = payload?.status?.action;

  if (reference && statusAction) {
    let mapped = "PENDING";
    if (statusAction === "PAID") mapped = "PAID";
    if (statusAction === "CANCELLED" || statusAction === "EXPIRED") mapped = "FAILED";

    await redis.set(`status:${reference}`, mapped, { ex: 60 * 60 * 24 });
  }

  return json(200, { ok: true });
};
