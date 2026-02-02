// netlify/functions/create-paylink.js

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const body = safeJson(event.body);
    const amount = String(body.amount || "").trim();       // "1.00"
    const reference = String(body.reference || "").trim();

    if (!amount) {
      return json(400, { error: "amount is required" });
    }

    const SERVICE_ID = process.env.PAYNL_SERVICE_ID;
    const TOKEN =
      process.env.PAYNL_API_TOKEN ||
      process.env.PAYNL_SERVICE_SECRET ||
      process.env.PAYNL_TOKEN;

    if (!SERVICE_ID || !TOKEN) {
      return json(500, {
        error: "Missing Pay.nl env vars",
        required: ["PAYNL_SERVICE_ID", "PAYNL_API_TOKEN (of PAYNL_SERVICE_SECRET)"]
      });
    }

    // Je Netlify base URL (die jij gebruikt)
    const SITE_URL = "https://profound-bunny-c7b7b3.netlify.app";

    // Pay.nl vraagt om ipAddress en finishUrl
    const ipAddress =
      event.headers["x-nf-client-connection-ip"] ||
      event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      event.headers["client-ip"] ||
      "127.0.0.1";

    const finishUrl = `${SITE_URL}/Klaar.html`;
    const exchangeUrl = `${SITE_URL}/.netlify/functions/status`;

    // Pay.nl endpoint (zoals in je error)
    const PAYNL_API_URL = "https://rest-api.pay.nl/v16/Transaction/start/json";

    // Pay.nl verwacht vaak bedrag in centen (integer).
    // Jij stuurt "1.00" vanuit de UI. Dit zetten we om naar centen.
    const amountCents = toCents(amount);

    const payload = {
      token: TOKEN,
      serviceId: SERVICE_ID,

      amount: amountCents,                 // centen
      description: reference || "EazyPay betaling",

      ipAddress: ipAddress,
      finishUrl: finishUrl,
      exchangeUrl: exchangeUrl
    };

    const r = await fetch(PAYNL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!r.ok || data?.status === "FALSE") {
      return json(502, {
        error: "Pay.nl API call failed",
        status: r.status,
        response: data
      });
    }

    // Pay.nl geeft vaak redirect URL terug in request/result:
    const paymentUrl =
      data.paymentUrl ||
      data.url ||
      data.payUrl ||
      data.redirectUrl ||
      data?.request?.paymentUrl ||
      data?.request?.url ||
      data?.request?.result ||
      data?.result?.paymentUrl ||
      data?.result?.url;

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

function toCents(eurString) {
  // "1.00" -> 100
  const s = String(eurString).replace(",", ".").trim();
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
