// /netlify/functions/create-paylink.js

exports.handler = async (event) => {
  // Alleen POST toestaan
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed. Use POST." }),
    };
  }

  try {
    const { amountEUR, description, reference } = JSON.parse(event.body || "{}");

    // 1) Amount: Pay.nl verwacht centen als integer (1.00 EUR = 100)  :contentReference[oaicite:4]{index=4}
    const eur = Number(amountEUR);
    if (!Number.isFinite(eur) || eur <= 0) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Invalid amount" }),
      };
    }
    const amountCents = Math.round(eur * 100);

    // 2) Env vars
    const serviceId = process.env.PAYNL_SERVICE_ID;
    const secret = process.env.PAYNL_SERVICE_SECRET;
    const paymentMethodId = Number(process.env.PAYNL_PAYMENT_METHOD_ID || 961);

    if (!serviceId || !secret) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          error: "Missing PAYNL_SERVICE_ID or PAYNL_SERVICE_SECRET",
        }),
      };
    }

    // 3) Basic auth: username = Service ID (SL-...), password = secret  :contentReference[oaicite:5]{index=5}
    const auth = Buffer.from(`${serviceId}:${secret}`).toString("base64");

    // 4) Order:Create endpoint (paylink) :contentReference[oaicite:6]{index=6}
    const payload = {
      amount: {
        value: amountCents,
        currency: "EUR",
      },
      paymentMethod: {
        id: paymentMethodId, // 961
      },
      serviceId: serviceId,
      description: (description || "Paylink order").toString().slice(0, 32),
      reference: (reference || "").toString().slice(0, 64),
      // exchangeUrl mag leeg als je geen server-side status updates gebruikt.
      // Je kunt hem later toevoegen als je exchange calls wilt verwerken.
    };

    const resp = await fetch("https://connect.pay.nl/v1/orders", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          error: "Pay.nl create order failed",
          http_status: resp.status,
          paynl_response: data,
        }),
      };
    }

    // Paylink URL zit in links.redirect :contentReference[oaicite:7]{index=7}
    const checkoutUrl = data?.links?.redirect;
    const orderId = data?.id;

    if (!checkoutUrl || !orderId) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          error: "Missing checkoutUrl or orderId in Pay.nl response",
          paynl_response: data,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId, checkoutUrl }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "Server error", details: String(e) }),
    };
  }
};
