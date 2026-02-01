const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  try {
    const reference = (event.queryStringParameters?.reference || "").trim();
    if (!reference) return json(400, { error: "Missing reference" });

    const store = getStore("eazypay-status");
    const saved = await store.getJSON(reference);

    if (!saved || !saved.orderId) {
      return json(200, { reference, status: "UNKNOWN" });
    }

    // Als al betaald, meteen teruggeven
    if (saved.status === "PAID") {
      return json(200, { reference, status: "PAID" });
    }

    const serviceId = process.env.PAYNL_SERVICE_ID;
    const serviceSecret = process.env.PAYNL_SERVICE_SECRET;

    if (!serviceId || !serviceSecret) {
      // Zonder env vars kunnen we niet live checken
      return json(200, { reference, status: saved.status || "PENDING" });
    }

    const auth = "Basic " + Buffer.from(`${serviceId}:${serviceSecret}`).toString("base64");

    const resp = await fetch(`https://connect.pay.nl/v1/orders/${encodeURIComponent(saved.orderId)}/status`, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "authorization": auth
      }
    });

    const data = await resp.json().catch(() => null);

    // Pay.nl: status.action = "PAID" of status.code = 100 betekent betaald
    const action = data?.status?.action;
    const code = data?.status?.code;

    const newStatus =
      (action === "PAID" || code === 100) ? "PAID"
      : (action ? String(action) : "PENDING");

    if (newStatus !== (saved.status || "PENDING")) {
      await store.setJSON(reference, { ...saved, status: newStatus, updatedAt: new Date().toISOString() });
    }

    return json(200, { reference, status: newStatus });

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
