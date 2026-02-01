

exports.handler = async (event) => {
  try {
    // Pay.nl stuurt JSON body met "object" die dezelfde structuur heeft als status response
    const body = safeJson(event.body);
    const obj = body?.object;

    const reference = (obj?.reference || "").toString().trim();
    const orderId = (obj?.id || "").toString().trim();

    const action = obj?.status?.action;
    const code = obj?.status?.code;

    if (!reference) {
      return json(200, { ok: true });
    }

    const store = getStore("eazypay-status");
    const saved = await store.getJSON(reference);

    const newStatus =
      (action === "PAID" || code === 100) ? "PAID"
      : (action ? String(action) : "PENDING");

    await store.setJSON(reference, {
      ...(saved || {}),
      orderId: saved?.orderId || orderId,
      status: newStatus,
      exchangeAt: new Date().toISOString()
    });

    // Belangrijk: altijd een geldige response teruggeven
    return json(200, { ok: true });
  } catch (err) {
    // Ook bij fout: 200 teruggeven, anders gaat Pay.nl retries doen
    return json(200, { ok: true, error: String(err?.message || err) });
  }
};

function safeJson(str) {
  try { return JSON.parse(str || "{}"); } catch { return {}; }
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*"
    },
    body: JSON.stringify(obj)
  };
}
