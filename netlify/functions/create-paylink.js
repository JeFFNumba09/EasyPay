// netlify/functions/create-paylink.js

export default async (request) => {
  // Alleen POST toestaan
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Env vars
    const SERVICE_ID = process.env.PAYNL_SERVICE_ID;
    const SERVICE_SECRET = process.env.PAYNL_SERVICE_SECRET;
    const PAYMENT_METHOD_ID = process.env.PAYNL_PAYMENT_METHOD_ID; // bv "10" of "AT-...." afhankelijk van jouw setup

    if (!SERVICE_ID || !SERVICE_SECRET) {
      return new Response(
        JSON.stringify({
          error: "Missing PAYNL_SERVICE_ID or PAYNL_SERVICE_SECRET",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Body lezen
    const body = await request.json();
    const amount = Number(body.amount);
    const customerReference = (body.customerReference || "").toString().trim(); // bv factuurnr / naam
    const description = (body.description || "").toString().trim();

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Pay.nl verwacht bedrag meestal in euro-centen als integer
    const amountCents = Math.round(amount * 100);

    // Unieke reference die je later gebruikt om status te checken
    // Als jij zelf een reference meegeeft (factuur/naam), zetten we die erachter
    const referenceBase = `EZP-${Date.now()}`;
    const reference = customerReference
      ? `${referenceBase}-${customerReference.replace(/\s+/g, "_").slice(0, 40)}`
      : referenceBase;

    // URL’s voor terugkoppeling
    // returnUrl: waar de gebruiker heen gaat na betaling
    // exchangeUrl: webhook/return endpoint (jouw exchange function)
    const baseUrl = "https://profound-bunny-c7b7b3.netlify.app";
    const returnUrl = `${baseUrl}/Klaar.html?reference=${encodeURIComponent(reference)}`;
    const exchangeUrl = `${baseUrl}/.netlify/functions/exchange?reference=${encodeURIComponent(reference)}`;

    // Pay.nl order aanmaken
    // Let op: Pay.nl API kan per account iets verschillen.
    // Deze call is de meest gebruikelijke: /v4/Transaction/start
    const payload = {
      serviceId: SERVICE_ID,
      amount: amountCents,
      description: description || "Betaling",
      reference,
      // methode is optioneel; als jij iDEAL wilt forceren kan dat via paymentMethodId
      ...(PAYMENT_METHOD_ID ? { paymentMethodId: PAYMENT_METHOD_ID } : {}),
      returnUrl,
      exchangeUrl,
    };

    const resp = await fetch("https://rest-api.pay.nl/v4/Transaction/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Pay.nl authenticatie: serviceId + serviceSecret
        Authorization: `Basic ${btoa(`${SERVICE_ID}:${SERVICE_SECRET}`)}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      return new Response(
        JSON.stringify({
          error: "Pay.nl create order failed",
          http_status: resp.status,
          paynl_response: data,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Pay.nl response bevat meestal een checkout url:
    // kan "paymentUrl" of "checkoutUrl" heten afhankelijk van endpoint/versie
    const checkoutUrl =
      data?.paymentUrl ||
      data?.checkoutUrl ||
      data?.url ||
      data?.data?.paymentUrl ||
      data?.data?.checkoutUrl;

    if (!checkoutUrl) {
      return new Response(
        JSON.stringify({
          error: "No checkoutUrl returned by Pay.nl",
          paynl_response: data,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        reference,
        checkoutUrl,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Server error in create-paylink",
        message: String(err?.message || err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
