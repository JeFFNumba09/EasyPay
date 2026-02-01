// netlify/functions/status.js

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(data)
  };
}

async function upstashGet(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const resp = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await resp.json();
  return data?.result ?? null;
}

exports.handler = async (event) => {
  try {
    const reference = event.queryStringParameters?.reference;
    if (!reference) return json(400, { error: "Missing reference" });

    const status = (await upstashGet(`pay:${reference}:status`)) || "UNKNOWN";
    const orderId = await upstashGet(`pay:${reference}:orderId`);

    return json(200, { reference, status, orderId });
  } catch (err) {
    return json(500, { error: "Server error", details: String(err?.message || err) });
  }
};
