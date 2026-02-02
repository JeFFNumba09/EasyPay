// netlify/functions/create-paylink.js

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const body = safeJson(event.body);
    const amount = String(body.amount || "").trim();
    const reference = String(body.reference || "").trim();

    if (!amount) {
      return json(400, { error: "amount is required" });
    }

    // ==== PAY.NL CONFIG (via Netlify Environment variables) ====
    const SERVICE_ID = process.env.PAYNL_SERVICE_ID;
    const API_TOKEN  = process.env.PAYNL_API_TOKEN || process.env.PAYNL_SERVICE_SECRET;

    if (!SERVICE_ID || !API_TOKEN) {
      return json(500, {
        error: "Missing Pay.nl env vars",
        required: ["PAYNL_SERVICE_ID", "PAYNL_API_TOKEN (of PAYNL_SERVICE_SECRET)"]
      });
    }

    // ==== PAS HIER AAN ALS JIJ ANDERE PAY.NL ENDPOINT/PAYLOAD GEBRUIKT ====
    const PAYNL_API_URL = "https://rest-api.pay.nl/v16/Transaction/start/json";

    const payload = {
      token: API_TOKEN,
      serviceId: SERVICE_ID,
      amount: amount,              // soms moet dit in centen, afhankelijk van jouw Pay.nl endpoint
      description: reference || "EazyPay betaling",
      // returnUrl en exchangeUrl kan ook nodig zijn in jouw setup:
      // finishUrl: "https://profound-bunny-c7b7b3.netlify.app/Klaar.html",
      // exchangeUrl: "https://profound-bunny-c7b7b3.netlify.app/.netlify/functions/status",
    };

    const r = await fetch(PAYNL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!r.ok) {
      return json(502, {
        error: "Pay.nl API call failed",
        status: r.status,
        response: data
      });
    }

    // Probeer de payment URL uit verschillende mogelijke response formats te halen
    const paymentUrl =
      data.paymentUrl ||
      data.url ||
      data.payUrl ||
      data.redirectUrl ||
      (data.request && (data.request.paymentUrl || data.request.url)) ||
      (data.result && (data.result.paymentUrl || data.result.url)) ||
      (data.transaction && (data.transaction.paymentUrl || data.transaction.url));

    if (!paymentUrl) {
      return json(502, {
        error: "No paymentUrl found in Pay.nl response",
        response: data
      });
    }

    return json(200, { paymentUrl });
  } catch (err) {
    return json(500, { error: err?.message || String(err) });
  }
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(obj)
  };
}

function safeJson(str) {
  try { return JSON.parse(str || "{}"); } catch { return {}; }
}
