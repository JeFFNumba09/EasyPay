// netlify/functions/status.js  (CommonJS)

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { error: "Method not allowed" });
    }

    const transactionId = String(event.queryStringParameters?.transactionId || "").trim();
    if (!transactionId) {
      return json(400, { error: "transactionId is required" });
    }

    const SERVICE_ID = process.env.PAYNL_SERVICE_ID;
    const API_TOKEN = process.env.PAYNL_API_TOKEN;

    if (!SERVICE_ID || !API_TOKEN) {
      return json(500, { error: "Missing PAYNL_SERVICE_ID or PAYNL_API_TOKEN in env vars" });
    }

    // Pay.nl Transaction/info
    const endpoint = "https://rest-api.pay.nl/v14/Transaction/info/json";
    const params = new URLSearchParams({
      token: API_TOKEN,
      serviceId: SERVICE_ID,
      transactionId: transactionId
    });

    const url = `${endpoint}?${params.toString()}`;

    const resp = await fetch(url, { method: "GET" });
    const data = await resp.json().catch(() => ({}));

    const result = Number(data?.request?.result || 0);
    if (result !== 1) {
      return json(400, { error: "Pay.nl API call failed", response: data });
    }

    // Pay.nl heeft verschillende velden per versie/account, daarom vangen we meerdere:
    // vaak: data.paymentDetails.stateName / data.transaction.stateName / data.transactionDetails.stateName
    const raw =
      data?.paymentDetails?.stateName ||
      data?.transaction?.stateName ||
      data?.transactionDetails?.stateName ||
      data?.stateName ||
      "";

    const status = String(raw).toUpperCase();

    // We sturen exact terug wat index.html verwacht:
    // { status: "PAID" } zodra betaald
    // anders bijv. "PENDING"
    return json(200, {
      status: normalizeStatus(status),
      rawStatus: raw,
      transactionId
    });
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

function normalizeStatus(s) {
  // maak hem robuust: Pay.nl kan bijv "PAID", "SUCCESS", "PENDING", "CANCEL", etc teruggeven
  if (s.includes("PAID") || s.includes("SUCCESS")) return "PAID";
  if (s.includes("CANCEL") || s.includes("CANCELED")) return "CANCEL";
  if (s.includes("EXPIRE")) return "EXPIRED";
  return "PENDING";
}
