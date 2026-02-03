// netlify/functions/create-paylink.js  (CommonJS)

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const body = safeJson(event.body);
    const amountEur = String(body.amount || "").trim(); // bv "1.00"
    const reference = String(body.reference || "").trim();

    if (!amountEur) return json(400, { error: "amount is required" });

    // ===== ENV VARS (Netlify) =====
    const SERVICE_ID = process.env.PAYNL_SERVICE_ID;      // bv SL-xxxx-xxxx
    const API_TOKEN  = process.env.PAYNL_API_TOKEN;       // lange token (niet de AT-code zelf)
    const METHOD_ID  = process.env.PAYNL_PAYMENT_METHOD_ID || ""; // optioneel

    if (!SERVICE_ID || !API_TOKEN) {
      return json(500, {
        error: "Missing env vars: PAYNL_SERVICE_ID and/or PAYNL_API_TOKEN"
      });
    }

    // ===== URL's =====
    // Belangrijk: klant moet na betaling naar klant-bedankt.html
    const BASE_URL = "https://profound-bunny-c7b7b3.netlify.app";
    const finishUrl = `${BASE_URL}/klant-bedankt.html`;

    // IP adres meegeven (Pay.nl vraagt dit soms)
    const ipAddress =
      (event.headers["x-nf-client-connection-ip"]) ||
      (event.headers["x-forwarded-for"] ? String(event.headers["x-forwarded-for"]).split(",")[0].trim() : "") ||
      "";

    // Amount naar cents (Pay.nl verwacht vaak integer cents)
    const amountCents = toCents(amountEur);
    if (!amountCents || amountCents < 1) {
      return json(400, { error: "Invalid amount (min 0.01)" });
    }

    // ===== PAY.NL CALL =====
    // Jij zit op de Pay.nl REST API v3
    const endpoint = "https://rest-api.pay.nl/v3/transaction/start";

    const payload = {
      serviceId: SERVICE_ID,
      amount: amountCents,
      description: reference || "Betaling",
      finishUrl,
    };

    // Sommige accounts/flows willen deze velden expliciet:
    if (ipAddress) payload.ipAddress = ipAddress;
    if (METHOD_ID) payload.paymentMethodId = METHOD_ID;

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!resp.ok) {
      return json(resp.status, {
        error: "Pay.nl API call failed",
        status: resp.status,
        response: data,
      });
    }

    // Pay.nl response bevat vaak:
    // data.transaction.paymentURL en data.transaction.transactionId
    const paymentUrl =
      data.paymentUrl ||
      data.paymentURL ||
      data.url ||
      (data.transaction && (data.transaction.paymentURL || data.transaction.paymentUrl));

    const transactionId =
      data.transactionId ||
      (data.transaction && data.transaction.transactionId);

    if (!paymentUrl || !transactionId) {
      return json(500, {
        error: "No paymentUrl/transactionId found in Pay.nl response",
        response: data
      });
    }

    return json(200, { paymentUrl, transactionId, finishUrl });
  } catch (err) {
    return json(500, { error: err?.message || String(err) });
  }
};

// ===== helpers =====
function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(obj),
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
