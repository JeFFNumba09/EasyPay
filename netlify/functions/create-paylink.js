const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const body = safeJson(event.body);
    const amount = Number(body?.amount);
    const descriptionRaw = (body?.description || "").toString().trim();

    if (!amount || amount <= 0) {
      return json(400, { error: "Invalid amount" });
    }

    const serviceId = process.env.PAYNL_SERVICE_ID;      // SL-....
    const serviceSecret = process.env.PAYNL_SERVICE_SECRET; // 40 chars secret

    if (!serviceId || !serviceSecret) {
      return json(500, { error: "Missing PAYNL_SERVICE_ID or PAYNL_SERVICE_SECRET env vars" });
    }

    // Pay.nl verwacht bedrag als nummer (EUR), bijvoorbeeld 12.34
    const amountValue = Number(amount.toFixed(2));

    // Jouw vaste base URL
    const baseUrl = "https://profound-bunny-c7b7b3.netlify.app";

    // Reference: uniek voor jouw kassa
    const reference = "EZP-" + Date.now();

    const description =
      descriptionRaw.length > 0
        ? `EazyPay: ${descriptionRaw}`.slice(0, 80)
        : "EazyPay betaling";

    const payload = {
      type: "paylink",
      amount: { value: amountValue, currency: "EUR" },
      reference,
      description,
      exchangeUrl: `${baseUrl}/.netlify/functions/exchange`,
      returnUrl: `${baseUrl}/klaar.html`
    };

    const auth = "Basic " + Buffer.from(`${serviceId}:${serviceSecret}`).toString("base64");

    const resp = await fetch("https://connect.pay.nl/v1/orders", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": auth
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json().catch(() => null);

    if (!resp.ok || !data?.id || !data?.links?.checkout) {
      return json(500, {
        error: "Pay.nl create order failed",
        details: data || { httpStatus: resp.status }
      });
    }

    // Bewaar mapping reference -> orderId (Pay.nl order uuid)
    const store = getStore("eazypay-status");
    await store.setJSON(reference, {
      orderId: data.id,
      status: "PENDING",
      amount: amountValue,
      description,
      createdAt: new Date().toISOString()
    });

    return json(200, {
      reference,
      checkoutUrl: data.links.checkout
    });

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

function safeJson(str) {
  try { return JSON.parse(str || "{}"); } catch { return {}; }
}
