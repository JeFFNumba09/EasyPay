const { Redis } = require("@upstash/redis");

const redis = Redis.fromEnv();

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const PAYNL_SERVICE_ID = process.env.PAYNL_SERVICE_ID;
  const PAYNL_SERVICE_SECRET = process.env.PAYNL_SERVICE_SECRET;
  const PAYNL_PAYMENT_METHOD_ID = Number(process.env.PAYNL_PAYMENT_METHOD_ID || "10");

  if (!PAYNL_SERVICE_ID || !PAYNL_SERVICE_SECRET) {
    return json(500, { error: "Missing PAYNL_SERVICE_ID or PAYNL_SERVICE_SECRET" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const amount = Number(payload.amount);
  if (!amount || amount <= 0) {
    return json(400, { error: "Invalid amount" });
  }

  const descriptionRaw = (payload.description || "").toString().trim();
  const description = descriptionRaw.slice(0, 32) || "EazyPay betaling";

  const amountCents = Math.round(amount * 100);

  const reference = `EZP-${Date.now()}`;

  const exchangeUrl = "https://profound-bunny-c7b7b3.netlify.app/.netlify/functions/exchange";

  const auth = Buffer.from(`${PAYNL_SERVICE_ID}:${PAYNL_SERVICE_SECRET}`).toString("base64");

  const body = {
    amount: { value: amountCents, currency: "EUR" },
    paymentMethod: { id: PAYNL_PAYMENT_METHOD_ID },
    serviceId: PAYNL_SERVICE_ID,
    description,
    reference,
    exchangeUrl
  };

  let resp, data;
  try {
    resp = await fetch("https://connect.pay.nl/v1/orders", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": `Basic ${auth}`
      },
      body: JSON.stringify(body)
    });

    data = await resp.json().catch(() => ({}));
  } catch (e) {
    return json(500, { error: "Network error calling Pay.nl" });
  }

  if (!resp.ok) {
    return json(resp.status, {
      error: "Pay.nl create order failed",
      http_status: resp.status,
      paynl_response: data
    });
  }

  const checkoutUrl = data?.links?.redirect || data?.links?.checkout;
  const orderId = data?.id;

  if (!checkoutUrl || !orderId) {
    return json(500, { error: "Pay.nl response missing checkout/order id", paynl_response: data });
  }

  await redis.set(`ref:${reference}`, JSON.stringify({
    orderId,
    description,
    createdAt: Date.now()
  }), { ex: 60 * 60 * 24 });

  await redis.set(`status:${reference}`, "PENDING", { ex: 60 * 60 * 24 });

  return json(200, { checkoutUrl, reference });
};
