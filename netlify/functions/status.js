export async function handler(event) {
  try {
    const serviceId = process.env.PAYNL_SERVICE_ID;
    const serviceSecret = process.env.PAYNL_SERVICE_SECRET;

    if (!serviceId || !serviceSecret) {
      return json(500, { error: "Missing PAYNL_SERVICE_ID or PAYNL_SERVICE_SECRET" });
    }

    const orderId = event.queryStringParameters?.orderId;
    if (!orderId) {
      return json(400, { error: "Missing orderId" });
    }

    const auth = "Basic " + Buffer.from(`${serviceId}:${serviceSecret}`).toString("base64");

    // status endpoint hangt aan order resource (links.status in response)  :contentReference[oaicite:8]{index=8}
    // Je kunt ook direct /v1/orders/{id}/status gebruiken:
    const url = `https://connect.pay.nl/v1/orders/${encodeURIComponent(orderId)}/status`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "authorization": auth
      }
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      return json(resp.status, { error: "Pay.nl status failed", http_status: resp.status, paynl_response: data });
    }

    // We vertalen naar simpele statuses
    const action = data?.status?.action; // bijv PENDING / PAID etc (Pay.nl)
    let status = "PENDING";

    if (action === "PAID") status = "PAID";
    else if (action === "CANCEL" || action === "FAILED" || action === "EXPIRED") status = "FAILED";

    return json(200, { status, raw: data });

  } catch (err) {
    return json(500, { error: String(err) });
  }
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS"
    },
    body: JSON.stringify(obj)
  };
}
