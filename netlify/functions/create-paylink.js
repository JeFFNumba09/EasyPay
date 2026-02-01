exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const body = JSON.parse(event.body || "{}");
    const amount = Number(body.amount);
    const description = String(body.description || "").trim();

    if (!amount || amount <= 0) {
      return json(400, { error: "Invalid amount" });
    }

    const serviceId = process.env.PAYNL_SERVICE_ID;
    const serviceSecret = process.env.PAYNL_SERVICE_SECRET;

    if (!serviceId || !serviceSecret) {
      return json(500, { error: "Missing PAYNL_SERVICE_ID or PAYNL_SERVICE_SECRET" });
    }

    const payload = {
      type: "paylink",
      amount: {
        value: Number(amount.toFixed(2)),
        currency: "EUR"
      },
      reference: "EZP-" + Date.now(),
      description: description || "EazyPay betaling",
      returnUrl: "https://profound-bunny-c7b7b3.netlify.app/klaar.html"
    };

    const auth = Buffer.from(`${serviceId}:${serviceSecret}`).toString("base64");

    const payResp = await fetch("https://connect.pay.nl/v1/orders", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": "Basic " + auth
      },
      body: JSON.stringify(payload)
    });

    const raw = await payResp.text();

    let payData;
    try {
      payData = JSON.parse(raw);
    } catch {
      return json(502, {
        error: "Pay.nl gaf geen geldige JSON terug",
        raw: raw.slice(0, 500)
      });
    }

    if (!payResp.ok || !payData?.id || !payData?.links?.checkout) {
      return json(400, {
        error: "Pay.nl create order failed",
        paynl_response: payData
      });
    }

    return json(200, {
      checkoutUrl: payData.links.checkout,
      orderId: payData.id,
      reference: payload.reference
    });

  } catch (err) {
    return json(500, {
      error: "Server error",
      message: err.message || String(err)
    });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*"
    },
    body: JSON.stringify(body)
  };
}
