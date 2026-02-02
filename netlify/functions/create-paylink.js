// netlify/functions/create-paylink.js

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const body = safeJson(event.body);
    const amountEur = String(body.amount || "").trim();
    const reference = String(body.reference || "").trim();

    if (!amountEur) return json(400, { error: "amount is required" });

    const SERVICE_ID = process.env.PAYNL_SERVICE_ID;
    const API_TOKEN = process.env.PAYNL_API_TOKEN; // <-- BELANGRIJK

    if (!SERVICE_ID || !API_TOKEN) {
      return json(500, {
        error: "Missing Pay.nl env vars",
        required: ["PAYNL_SERVICE_ID", "PAYNL_API_TOKEN"]
      });
    }

    const SITE_URL = "https://profound-bunny-c7b7b3.netlify.app";

    const ipAddress =
      event.headers["x-nf-client-connection-ip"] ||
      (event.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      "127.0.0.1";

    const finishUrl = `${SITE_URL}/Klaar.html`;
    const exchangeUrl = `${SITE_URL}/.netlify/functions/status`;

    const amount = toCents(amountEur);

    const url = "https://rest-api.pay.nl/v16/Transaction/start/json";

    const payload = {
      token: API_TOKEN,
      serviceId: SERVICE_ID,
      amount: amount,
      description: reference || "EazyPay betaling",
      ipAddress: ipAddress,
      finishUrl: finishUrl,
      exchangeUrl: exchangeUrl
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await r.text();
    console.log("Pay.nl HTTP", r.status, "raw:", text);

    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!r.ok || data?.status === "FALSE") {
      return json(502, {
        error: "Pay.nl API call failed",
        status: r.status,
        response: data
      });
    }

    // Pay.nl geeft vaak een redirect URL terug
    const paymentUrl =
      data?.request?.paymentUrl ||
      data?.request?.url ||
      data?.paymentUrl ||
      data?.url ||
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj)
  };
}

function safeJson(str) {
  try { return JSON.parse(str || "{}"); } catch { return {}; }
}

function toCents(eurString) {
  const s = String(eurString).replace(",", ".").trim();
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
