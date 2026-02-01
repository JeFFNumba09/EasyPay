export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const { amount, description } = JSON.parse(event.body || "{}");

    const serviceId = process.env.PAYNL_SERVICE_ID;            // moet SL-xxxx-xxxx zijn
    const serviceSecret = process.env.PAYNL_SERVICE_SECRET;    // 40-char hash
    const paymentMethodId = Number(process.env.PAYNL_PAYMENT_METHOD_ID || 961);

    if (!serviceId || !serviceSecret) {
      return json(500, { error: "Missing PAYNL_SERVICE_ID or PAYNL_SERVICE_SECRET" });
    }

    // amount in centen (Paylink guide gebruikt 150 voor €1,50)  :contentReference[oaicite:3]{index=3}
    const cents = Math.round(Number(amount) * 100);
    if (!cents || cents <= 0) {
      return json(400, { error: "Invalid amount" });
    }

    const reference = "EZP-" + Date.now();

    // Paylink Order:Create endpoint  :contentReference[oaicite:4]{index=4}
    const url = "https://connect.pay.nl/v1/orders";

    const auth = "Basic " + Buffer.from(`${serviceId}:${serviceSecret}`).toString("base64");

    const payload = {
      amount: { value: cents, currency: "EUR" },
      paymentMethod: { id: paymentMethodId },   // Paylink = 961  :contentReference[oaicite:5]{index=5}
      serviceId: serviceId,                     // SL-xxxx-xxxx  :contentReference[oaicite:6]{index=6}
      description: (description && description.trim())
        ? description.trim().slice(0, 32)       // max 32 chars volgens guide response uitleg  :contentReference[oaicite:7]{index=7}
        : "EazyPay betaling",
      reference: reference
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": auth
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      return json(resp.status, {
        error: "Pay.nl create order failed",
        http_status: resp.status,
        paynl_response: data
      });
    }

    const checkoutUrl = data?.links?.redirect || data?.links?.checkout;

    if (!checkoutUrl) {
      return json(500, { error: "No checkoutUrl returned by Pay.nl", paynl_response: data });
    }

    // we geven orderId terug, handig voor status-checks
    return json(200, {
      reference,
      orderId: data.orderId || data.id,
      checkoutUrl
    });

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
