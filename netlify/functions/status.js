export default async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");

    if (!orderId) {
      return json(400, { error: "Missing orderId" });
    }

    // Je mag dit zonder auth doen voor basic status, maar met auth is prima. :contentReference[oaicite:6]{index=6}
    const { PAYNL_SERVICE_ID, PAYNL_SERVICE_SECRET } = process.env;
    const headers = {
      "accept": "application/json",
      ...corsHeaders()
    };

    if (PAYNL_SERVICE_ID && PAYNL_SERVICE_SECRET) {
      headers["authorization"] =
        "Basic " + Buffer.from(`${PAYNL_SERVICE_ID}:${PAYNL_SERVICE_SECRET}`).toString("base64");
    }

    const resp = await fetch(`https://connect.pay.nl/v1/orders/${encodeURIComponent(orderId)}/status`, {
      method: "GET",
      headers
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      return json(resp.status, {
        error: "Pay.nl status failed",
        http_status: resp.status,
        paynl_response: data
      });
    }

    // data.status.action is bijv "PAID" :contentReference[oaicite:7]{index=7}
    return json(200, {
      status: data?.status?.action || "UNKNOWN",
      code: data?.status?.code ?? null,
      raw: data
    });
  } catch (e) {
    return json(500, { error: "Server error", detail: String(e?.message || e) });
  }
};

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS"
  };
}

function json(statusCode, obj) {
  return new Response(JSON.stringify(obj), {
    status: statusCode,
    headers: {
      "content-type": "application/json",
      ...corsHeaders()
    }
  });
}
