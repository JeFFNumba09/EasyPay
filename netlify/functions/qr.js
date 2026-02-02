const QRCode = require("qrcode");

exports.handler = async (event) => {
  try {
    const text = event.queryStringParameters?.text;
    if (!text) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Missing text" })
      };
    }

    const png = await QRCode.toBuffer(text, { width: 320 });

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        "content-type": "image/png",
        "cache-control": "no-store"
      },
      body: png.toString("base64")
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "QR generation failed", details: String(e) })
    };
  }
};
