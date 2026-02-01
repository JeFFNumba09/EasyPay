async function redisGet(key) {
  const url = `${process.env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
  });
  if (!resp.ok) throw new Error("Redis GET failed");
  const data = await resp.json();
  return data?.result || null;
}

export async function handler(event) {
  try {
    const reference = event.queryStringParameters?.reference;
    if (!reference) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing reference" }) };
    }

    const status = await redisGet(`pay:${reference}`);
    return { statusCode: 200, body: JSON.stringify({ status: status || "UNKNOWN" }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server error" }) };
  }
}
