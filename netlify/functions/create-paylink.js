export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { amount } = JSON.parse(event.body || "{}");
    const value = Number(amount);

    if (!value || value <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid amount" }) };
    }

    const PAYNL_USERNAME = process.env.PAYNL_USERNAME;
    const PAYNL_PASSWORD = process.env.PAYNL_PASSWORD;
    const PAYNL_SERVICE_ID = process.env.PAYNL_SERVICE_ID;
    const PAYNL_PAYMENT_METHOD_ID = Number(process.env.PAYNL_PAYMENT_METHOD_ID || 961);

    if (!PAYNL_USERNAME || !PAYNL_PASSWORD || !PAYNL_SERVICE_ID) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing PAY.NL env vars" }) };
    }

    const baseUrl = "https://profound-bunny-c7b7b3.netlify.app";
    const exchangeUrl = `${baseUrl}/.netlify/functions/exchange`;
    const reference = `EZP-${Date.now()}`;

    const payload = {
      amount: { value: Math.round(value * 100), currency: "EUR" },
      paymentMethod: { id: PAYNL_PAYMENT_METHOD_ID },
      serviceId: PAYNL_SERVICE_ID,
      description: "EazyPay betaling",
      reference,
      exchangeUrl
    };

    const auth = Buffer.from(`${PAYNL_USERNAME}:${PAYNL_PASSWORD}`).toString("base64");

    const resp = await fetch("https://connect.pay.nl/v1/orders", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": `Basic ${auth}`
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();

    if (!resp.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: "PAY.NL create order failed", details: data }) };
    }

    const checkoutUrl = data?.links?.checkout || data?.links?.redirect;

    return {
      statusCode: 200,
      body: JSON.stringify({ checkoutUrl, reference })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server error", message: e?.message }) };
  }
}
