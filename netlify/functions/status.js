// /netlify/functions/status.js

exports.handler = async (event) => {
  try {
    const id = event.queryStringParameters?.id;
    if (!id) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Missing id" }),
      };
    }

    const serviceId = process.env.PAYNL_SERVICE_ID;
    const secret = process.env.PAYNL_SERVICE_SECRET;

    if (!serviceId || !secret) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Missing PAYNL_SERVICE_ID or PAYNL_SERVICE_SECRET" }),
      };
    }

    const auth = Buffer.from(`${serviceId}:${secret}`).toString("base64");

    // status endpoint komt uit links.status in response; hier is de vaste variant:
    const url = `https://connect.pay.nl/v1/orders/${encodeURIComponent(id)}/status`;

    const resp = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Basic ${auth}`,
      },
    });

    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return {
      statusCode: resp.status,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "Server error", details: String(e) }),
    };
  }
};
