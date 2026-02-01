async function redisSet(key, value) {
  const url = `${process.env.UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
  });
  if (!resp.ok) throw new Error("Redis SET failed");
}

export async function handler(event) {
  try {
    const body = JSON.parse(event.body || "{}");
    const order = body.object || body;

    const reference = order.reference || order?.data?.reference;
    const statusAction = order?.status?.action;

    if (reference && statusAction) {
      await redisSet(`pay:${reference}`, statusAction);
    }

    return { statusCode: 200, body: "OK" };
  } catch (e) {
    return { statusCode: 200, body: "OK" };
  }
}
