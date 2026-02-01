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
  const PAYNL_SERVICE_ID = process.env.PAYNL_SERVICE_ID;
  const PAYNL_SERVICE_SECRET = process.env.PAYNL_SERVICE_SECRET;

  if (!PAYNL_SERVICE_ID || !PAYNL_SERVICE_SECRET) {
    return json(500, { error: "Missing PAYNL_SERVICE_ID or PAYNL_SERVICE_SECRET" });
  }

  const reference = event.queryStringParameters?.reference;
  if (!reference) return json(400, { error: "Missing reference" });

  const refDataRaw = await redis.get(`ref:${reference}`);
  if (!refDataRaw) return json(200, { status: "UNKNOWN" });

  const refData = typeof refDataRaw === "string" ? JSON.parse(refDataRaw) : refDataRaw;
  const orderId = refData.orderId;

  const auth = Buffer.from(`${PAYNL_SERVICE_ID}:${PAYNL_SERVICE_SECRET}`).toString("base64");

  let resp, data;
  try {
    resp = await fetch(`https://connect.pay.nl/v1/orders/${encodeURIComponent(orderId)}/status`, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "authorization": `Basic ${auth}`
      }
    });

    data = await resp.json().catch(() => ({}));
  } catch (e) {
    return json(500, { error: "Network error calling Pay.nl" });
  }

  if (!resp.ok) {
    return json(resp.status, { error: "Pay.nl status failed", paynl_response: data });
  }

  const action = data?.status?.action;

  let mapped = "PENDING";
  if (action === "PAID") mapped = "PAID";
  if (action === "CANCELLED" || action === "EXPIRED") mapped = "FAILED";

  await redis.set(`status:${reference}`, mapped, { ex: 60 * 60 * 24 });

  return json(200, { status: mapped, paynl: data?.status || null });
};
