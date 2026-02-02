// netlify/functions/create-paylink.js  (CommonJS)

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const body = safeJson(event.body);
    const amountEur = String(body.amount || "").trim(); // bv "1.00"
    const reference = String(body.reference || "").trim();

    if (!amountEur) {
      return json(400, { error: "amount is required" });
    }

    // ENV VARS (Netlify)
    const SERVICE_ID = process.env.PAYNL_SERVICE_ID; // bv SL-4630-7005
    const API_TOKEN = process.env.PAYNL_API_TOKEN;   // lange token (bv d64be9f3...)

    if (!SERVICE_ID || !API_TOKEN) {
      return json(500, {
        error: "Missing Pay.nl env vars",
        required: ["PAYNL_SERVICE_ID", "PAYNL_API_TOKEN"]
      });
    }

    const SITE_URL = "https://profound-bunny-c7b7b3.netlify.app";

    // Pay.nl wil ipAddress + finishUrl
    const ipAddress =
      event.headers["x-nf-client-connection-ip"] ||
      (event.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      "127.0.0.1";

    const finishUrl = `${SITE_URL}/Klaar.html`;
    const exchangeUrl = `${SITE_URL}/.netlify/functions/status`;

    // Pay.nl verwacht bedrag vaak in centen
    const amountCents = toCents(amountEur);

    const PAYNL_API_URL = "https://rest-api.pay.nl/v16/Transaction/start/json";

    const payload = {
      token: API_TOKEN,
      serviceId: SERVICE_ID,
      amount: amountCents,
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
        httpStatus: r.status,
        response: data
      });
    }

    // Pay.nl response: data.transaction.paymentURL
    const paymentUrl =
      data?.transaction?.paymentURL ||
      data?.transaction?.paymentUrl ||
      data?.paymentURL ||
      data?.paymentUrl;

    const transactionId =
      data?.transaction?.transactionId ||
      data?.transactionId ||
      null;

    if (!paymentUrl) {
      return json(502, {
        error: "No paymentUrl found in Pay.nl response",
        response: data
      });
    }

    return json(200, { paymentUrl, transactionId });
  } catch (err) {
    return json(500, { error: err?.message || String(err) });
  }
};

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
