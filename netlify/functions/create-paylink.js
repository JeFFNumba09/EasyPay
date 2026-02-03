// netlify/functions/create-paylink.js  (CommonJS)

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const body = safeJson(event.body);
    const amountEur = String(body.amount || "").trim();     // bijv "1.00"
    const reference = String(body.reference || "").trim();  // optioneel

    if (!amountEur) {
      return json(400, { error: "amount is required" });
    }

    const SERVICE_ID = process.env.PAYNL_SERVICE_ID;
    const API_TOKEN = process.env.PAYNL_API_TOKEN;

    if (!SERVICE_ID || !API_TOKEN) {
      return json(500, { error: "Missing PAYNL_SERVICE_ID or PAYNL_API_TOKEN in env vars" });
    }

    // IP adres (Pay.nl vraagt deze vaak)
    const ipAddress =
      event.headers["x-nf-client-connection-ip"] ||
      event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      event.headers["client-ip"] ||
      "127.0.0.1";

    // Basis URL van je site (Netlify)
    const siteUrl =
      process.env.URL || "https://profound-bunny-c7b7b3.netlify.app";

    // Dit is CRUCIAAL:
    // klant moet na betalen uitkomen op klant-bedankt.html (in de ROOT van je site)
    const finishUrl = `${siteUrl}/klant-bedankt.html`;

    // Pay.nl Transaction/start
    // Let op: Pay.nl verwacht bedrag vaak in CENTS
    const amountCents = toCents(amountEur);
    if (!amountCents || amountCents < 1) {
      return json(400, { error: "Invalid amount (must be >= 0.01)" });
    }

    const description = reference ? `EazyPay: ${reference}` : "EazyPay betaling";

    const endpoint = "https://rest-api.pay.nl/v14/Transaction/start/json";

    const params = new URLSearchParams({
      token: API_TOKEN,
      serviceId: SERVICE_ID,
      amount: String(amountCents),
      description: description,
      ipAddress: ipAddress,
      finishUrl: finishUrl
    });

    const url = `${endpoint}?${params.toString()}`;

    const resp = await fetch(url, { method: "GET" });
    const data = await resp.json().catch(() => ({}));

    // Pay.nl response bevat meestal:
    // data.request.result === 1 bij success
    // data.transaction.paymentURL en data.transaction.transactionId
    const result = Number(data?.request?.result || 0);

    if (result !== 1) {
      return json(400, {
        error: "Pay.nl API call failed",
        response: data
      });
    }

    const paymentUrl = data?.transaction?.paymentURL;
    const transactionId = data?.transaction?.transactionId;

    if (!paymentUrl || !transactionId) {
      return json(500, {
        error: "No paymentUrl/transactionId found in Pay.nl response",
        response: data
      });
    }

    // Dit moet matchen met jouw index.html:
    return json(200, { paymentUrl, transactionId });
  } catch (err) {
    return json(500, { error: err?.message || String(err) });
  }
};

// ===== Helpers =====

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
  try {
    return JSON.parse(str || "{}");
  } catch {
    return {};
  }
}

function toCents(eurString) {
  const s = String(eurString).replace(",", ".").trim();
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
