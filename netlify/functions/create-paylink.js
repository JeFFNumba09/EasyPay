export default async (req) => {
  try {
    if (req.method !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const {
      PAYNL_SERVICE_ID,
      PAYNL_SERVICE_SECRET,
      PAYNL_PAYMENT_METHOD_ID
    } = process.env;

    if (!PAYNL_SERVICE_ID || !PAYNL_SERVICE_SECRET) {
      return json(500, {
        error: "Missing PAYNL_SERVICE_ID or PAYNL_SERVICE_SECRET"
      });
    }

    const body = safeJson(req.body);
    const amount = Number(body.amount);
    const memo = String(body.memo || "").trim();

    if (!amount || amount <= 0) {
      return json(400, { error: "Invalid amount" });
    }

    // Pay expects amount.value as integer (ex: 1 EUR = 1, not 1.00)
    // In their examples they use 150 for €150. :contentReference[oaicite:4]{index=4}
    // We'll send cents? No: PAY paylink guide uses whole value in EUR (integer).
    // So we round to 2 decimals and send as a number in EUR.
    const amountValue = Number(amount.toFixed(2));

    // Maak een nette reference: EAZYPAY-<timestamp>-<memo>
    const ts = Date.now();
    const cleanMemo = memo
      .replace(/\s+/g, " ")
      .replace(/[^a-zA-Z0-9 _\-]/g, "")
      .slice(0, 30);

    const reference = cleanMemo
      ? `EAZYPAY-${ts}-${cleanMemo}`
      : `EAZYPAY-${ts}`;

    const auth = "Basic " + Buffer.from(`${PAYNL_SERVICE_ID}:${PAYNL_SERVICE_SECRET}`).toString("base64");

    const payPayload = {
      type: "paylink",
      amount: {
        value: amountValue,
        currency: "EUR"
      },
      description: memo ? `Betaling: ${memo}` : "Paylink betaling",
      reference,
      paymentMethod: {
        id: Number(PAYNL_PAYMENT_METHOD_ID || 961)
      }
      // Je kunt dit later uitbreiden met extra velden uit PAY docs indien nodig.
    };

    const resp = await fetch("https://connect.pay.nl/v1/orders", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": auth
      },
      body: JSON.stringify(payPayload)
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      return json(resp.status, {
        error: "Pay.nl create order failed",
        http_status: resp.status,
        paynl_response: data
      });
    }

    // PAY response bevat o.a. id en links.checkout :contentReference[oaicite:5]{index=5}
    return json(200, {
      orderId: data.id,
      reference: data.reference,
      checkoutUrl: data?.links?.checkout
    });
  } catch (e) {
    return json(500, { error: "Server error", detail: String(e?.message || e) });
  }
};

function json(statusCode, obj) {
  return new Response(JSON.stringify(obj), {
    status: statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS"
    }
  });
}

function safeJson(raw) {
  try {
    if (!raw) return {};
    if (typeof raw === "string") return JSON.parse(raw);
    return raw;
  } catch {
    return {};
  }
}
