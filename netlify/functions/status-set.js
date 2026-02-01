let store = {};

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { paymentId, status } = JSON.parse(event.body || "{}");

  if (!paymentId || !status) {
    return { statusCode: 400, body: "Missing data" };
  }

  store[paymentId] = status;

  return {
    statusCode: 200,
    body: JSON.stringify({ paymentId, status })
  };
}
