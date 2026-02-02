// netlify/functions/create-paylink.js

export async function handler(event) {
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
    const SERVICE_ID = process.env.PAYNL_SERVICE_ID;     // bv SL-4630-7005
    const API_TOKEN  = process.env.PAYNL_API_TOKEN;      // lange token (bv d64be9f3...)

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
