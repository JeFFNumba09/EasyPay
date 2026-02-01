exports.handler = async (event) => {
  try {
    const orderId = (event.queryStringParameters?.orderId || "").trim();
    if (!orderId) return json(400, { error: "Missing orderId" });

    const serviceId = process.env.PAYNL_SERVICE_ID;
    const serviceSecret = process.env.PAYNL_SERVICE_SECRET;

    if (!serviceId || !serviceSecret) {
      return json(500, { error: "Missing PAYNL_SERVICE_ID or PAYNL_SERVICE_SECRET" });
    }

    const auth = "Basic " + Buffer.from(`${serviceId}:${serviceSecret}`).toString("base64");

    const resp = await fetch(`https://connect.pay.nl/v1/orders/${encodeURIComponent(orderId)}/status`, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "authorization": auth
      }
    });

    const data = await resp.json().catch(() => null);

    const action = data?.status?.action;
    const code = data?.status?.code;

    const status =
      (action === "PAID" || code === 100) ? "PAID"
      : (action ? String(action) : "PENDING");

    return json(200, { orderId, status });

  } catch (err) {
    return json(500, { error: "Server error", message: String(err?.message || err) });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*"
    },
    body: JSON.stringify(obj)
  };
}
