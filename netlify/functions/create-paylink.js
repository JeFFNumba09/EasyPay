// netlify/functions/create-paylink.js
// CommonJS – geschikt voor Netlify Functions

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const body = safeJson(event.body);
    const amountEur = String(body.amount || "").trim();      // bijv "10.00"
    const reference = String(body.reference || "").trim();

    if (!amountEur) {
      return json(400, { error: "amount is required" });
    }

    // ===== ENV VARS =====
    const SERVICE_ID = process.env.PAYNL_SERVICE_ID;   // SL-xxxx-xxxx
    const API_TOKEN  = process.env.PAYNL_API_TOKEN;    // lange token (geen AT-code)

    if (!SERVICE_ID || !API_TOKEN) {
      return json(500, {
        error: "Missing Pay.nl environment variables",
        required: ["PAYNL_SERVICE_ID", "PAYNL_API_TOKEN"]
      });
    }

    // ===== SITE URL =====
    const SITE_URL = "https://profound-bunny-c7b7b3.netlify.app";

    // 👉 KLANT ziet dit na betalen (GEEN kassa)
    const finishUrl  = `${SITE_URL}/klant-bedankt.html`;

    // 👉 KASSA gebruikt dit alleen voor status checks
    const exchangeUrl = `${SITE_URL}/.netlify/functions/status`;

    // IP-adres (Pay.nl verplicht)
    const ipAddress =
      event.headers["x-nf-client-connection-ip"] ||
      (event.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      "127.0.0.1";

    // Bedrag omzetten naar centen
    const amountCents = toCents(amountEur);

    // ===== PAY.NL ENDPOINT =====
    const PAYNL_API_URL = "https://rest-api.pay.nl/v16/Transaction/start/json";

    const payload = {
      token: API_TOKEN,
      serviceId: SERVICE_ID,
      amount: amountCents,
      description: reference || "Betaling",
      ipAddress: ipAddress,
      finishUrl: finishUrl,
      exchangeUrl: exchangeUrl
    };

    const resp = await fetch(PAYNL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!resp.ok || data?.status === "FALSE") {
      return json(502, {
        error: "Pay.nl API call failed",
        httpStatus: resp.status,
        response: data
      });
    }

    // ===== PAY.NL RESPONSE =====
    const paymentUrl =
      data?.transaction?.paymentURL ||
      data?.transaction?.paymentUrl ||
      data?.paymentURL ||
      data?.paymentUrl;

    const transactionId =
      data?.transaction?.transactionId ||
      data?.transaction?.transactionID ||
      null;

    if (!paymentUrl || !transactionId) {
      return json(502, {
        error: "Missing paymentUrl or transactionId",
        response: data
      });
    }

    // 👉 KASSA krijgt ALLEEN wat nodig is
    return json(200, {
      paymentUrl,
      transactionId
    });

  } catch (err) {
    return json(500, { error: err.message || String(err) });
  }
};

// ===== HELPERS =====

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
  const s = String(eurString).replace(",", ".").trim();
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
