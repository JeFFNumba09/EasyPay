let store = {};

export async function handler(event) {
  const paymentId = event.queryStringParameters?.paymentId;

  if (!paymentId) {
    return { statusCode: 400, body: "Missing paymentId" };
  }

  const status = store[paymentId] || "open";

  return {
    statusCode: 200,
    body: JSON.stringify({ paymentId, status })
  };
}
