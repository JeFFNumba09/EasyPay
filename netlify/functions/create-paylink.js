// netlify/functions/create-paylink.js

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(data)
  };
}

async function upstashSet(key, value) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;

  await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  try {
    const serviceId = process.env.PAYNL_SERVICE_ID;
    const serviceSecret = process.env.PAYNL_SERVICE_SECRET;
    const paymentMethodId = process.env.PAYNL_PAYMENT_METHOD_ID || "10";

    if (!serviceId || !serviceSecret) {
      return json(500, {
        error: "Missing PAYNL_SERVICE_ID or PAYNL_SERVICE_SECRET"
      });
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const amount = Number(body.amount);
    const description = (body.description || "").toString().trim();

    if (!amount || amount <= 0) {
      return json(400, { error: "Invalid amount" });
    }

    // Pay.nl verwacht vaak bedrag in centen als integer
    const amountInCents = Math.round(amount * 100);

    // Eigen referentie voor jouw systeem
    const reference = `EZP-${Date.now()}`;

    // Optionele omschrijving voor later terugvinden
    const orderDescription = description ? `EZP ${reference} | ${description}` : `EZP ${reference}`;

    // Status alvast vastleggen
    await upstashSet(`pay:${reference}:status`, "OPEN");
    await upstashSet(`pay:${reference}:amount`, String(amountInCents));
    await upstashSet(`pay:${reference}:description`, orderDescription);

    // Pay.nl order aanmaken via API v3
    const paynlResp = await fetch("https://api.pay.nl/v3/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceSecret}`
      },
      body: JSON.stringify({
        serviceId: serviceId,
        amount: amountInCents,
        currency: "EUR",
        paymentMethodId: Number(paymentMethodId),
        description: orderDescription,
        reference: reference,
        // Als Pay.nl terugkomt op deze urls, kun je later uitbreiden
        returnUrl: "https://profound-bunny-c7b7b3.netlify.app/Klaar.html",
        exchangeUrl: "https://profound-bunny-c7b7b3.netlify.app/.netlify/functions/status"
      })
    });

    const rawText = await paynlResp.text();
    let paynlData = null;
    try {
      paynlData = JSON.parse(rawText);
    } catch (e) {
      paynlData = { raw: rawText };
    }

    if (!paynlResp.ok) {
      return json(paynlResp.status, {
        error: "Pay.nl create order failed",
        http_status: paynlResp.status,
        paynl_response: paynlData
      });
    }

    // Let op: afhankelijk van Pay.nl response kan dit veld anders heten
    const checkoutUrl =
      paynlData?.checkoutUrl ||
      paynlData?.paymentUrl ||
      paynlData?.links?.checkout?.href ||
      paynlData?.links?.redirect?.href;

    if (!checkoutUrl) {
      return json(500, {
        error: "No checkoutUrl returned by Pay.nl",
        paynl_response: paynlData
      });
    }

    // OrderId opslaan, handig voor status checks
    if (paynlData?.id) {
      await upstashSet(`pay:${reference}:orderId`, String(paynlData.id));
    }

    return json(200, { reference, checkoutUrl });
  } catch (err) {
    return json(500, { error: "Server error", details: String(err?.message || err) });
  }
};
