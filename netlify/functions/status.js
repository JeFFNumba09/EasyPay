// netlify/functions/status.js

export default async (request) => {
  try {
    const url = new URL(request.url);
    const reference = url.searchParams.get("reference");

    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing reference" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Jouw status opslag hangt af van exchange.js.
    // Als jij status opslaat in Upstash/Redis: DAN zou status.js dat moeten lezen.
    // Maar jij wil Redis eruit -> dus doen we de simpele aanpak:
    // status ophalen bij Pay.nl o.b.v. reference kan alleen als je transactionId hebt.
    // Daarom: exchange.js moet minimaal een status kunnen teruggeven.

    // Voor nu geven we "UNKNOWN" zodat je UI niet crasht.
    // Jij hebt eerder al gezien "status unknown" en dat is prima als placeholder.
    return new Response(JSON.stringify({ reference, status: "UNKNOWN" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Server error", message: String(err?.message || err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
