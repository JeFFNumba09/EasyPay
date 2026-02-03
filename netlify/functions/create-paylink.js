// netlify/functions/create-paylink.js (CommonJS)

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const body = safeJson(event.body);
    const amountEur = String(body.amount || "").trim(); // bijv "1.00"
    const reference = String(body.reference || "").trim();

    if (!amountEur) {
      return json(400, { error: "amount is required" });
    }

    // ENV VARS (Netlify)
    const SERVICE_ID = process.env.PAYNL_SERVICE_ID;
    const API_TOKEN = process.env.PAYNL_API_TOKEN;

    if (!SERVICE_ID || !API_TOKEN) {
      return json(500, { error: "Missing PAYNL_SERVICE_ID or PAYNL_API_TOKEN in env vars" });
    }

    // IP-adres van de klant (Pay.nl vraagt dit vaak)
    const ipAddress =
      event.headers["x-nf-client-connection-ip"] ||
      (event.headers["x-forwarded-for"] ? String(event.headers["x-forwarded-for"]).split(",")[0].trim() : "") ||
      "127.0.0.1";

    // Base URL van je site (werkt op productie + preview)
    const baseUrl = (process.env.URL || "https://profound-bunny-c7b7b3.netlify.app").replace(/\/$/, "");

    // Waar Pay.nl de klant na betaling naartoe stuurt
    const finishUrl = `${baseUrl}/klant-bedankt.html`;

    // Pay.nl Transaction/start
    // Let op: endpoints zijn hoofdlettergevoelig op sommige omgevingen
    const endpoint = "https://rest-api.pay.nl/v14/Transaction/start/json";

    const params = new URLSearchParams({
      token: API_TOKEN,
      serviceId: SERVICE_ID,
      amount: String(toCents(amountEur)), // centen
      ipAddress: ipAddress,
      finishUrl: finishUrl
    });

    if (reference) {
      params.set("description", reference);
    }

    const url = `${endpoint}?${params.toString()}`;

    const resp = await fetch(url, { method: "GET" });
    const data = await resp.json().catch(() => ({}));

    const result = Number(data?.request?.result || 0);
    if (result !== 1) {
      return json(400, { error: "Pay.nl API call failed", response: data });
    }

    const paymentUrl =
      data?.transaction?.paymentURL ||
      data?.transaction?.paymentUrl ||
      data?.paymentUrl ||
      data?.paymentURL ||
      "";

    const transactionId =
      data?.transaction?.transactionId ||
      data?.transactionId ||
      "";

    if (!paymentUrl) {
      return json(400, { error: "No paymentUrl found in Pay.nl response", response: data });
    }
    if (!transactionId) {
      return json(400, { error: "No transactionId found in Pay.nl response", response: data });
    }

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
  // "1.00" -> 100, "0.01" -> 1, "1,50" -> 150
  const s = String(eurString).replace(",", ".").trim();
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}
