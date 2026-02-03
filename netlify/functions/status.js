<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Betaald</title>
  <style>
    body { margin:0; font-family: Arial, sans-serif; background:#111; color:#fff; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { width:min(520px, 92vw); background:#1b1b1b; border:1px solid #2a2a2a; border-radius:16px; padding:28px; text-align:center; }
    h1 { margin:0 0 10px; font-size:28px; }
    p { margin:0; opacity:.85; font-size:16px; }
    .check {
      width:84px; height:84px; border-radius:50%;
      margin:18px auto 14px;
      background:#1f7a3a;
      display:flex; align-items:center; justify-content:center;
      font-size:44px;
    }
    .gif {
      margin:14px auto 0;
      width:160px; height:160px;
      border-radius:12px;
      overflow:hidden;
      background:#0f0f0f;
      display:flex; align-items:center; justify-content:center;
      opacity:.95;
    }
    .gif img { width:100%; height:100%; object-fit:cover; display:block; }
    .muted { margin-top:16px; font-size:14px; opacity:.7; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">✓</div>
    <h1>Betaald</h1>
    <p>Bedankt. De betaling is ontvangen.</p>

    <!-- Optioneel: gifje -->
    <div class="gif" id="gifWrap" style="display:none;">
      <img id="thanksGif" alt="Bedankt" />
    </div>

    <div class="muted" id="countdown"></div>
  </div>

  <script>
    // Optioneel gifje aanzetten:
    // Zet hieronder jouw eigen gif-url, of laat dit uit als je geen gif wil.
    const GIF_URL = ""; 
    // voorbeeld (mag, maar hoeft niet): 
    // const GIF_URL = "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif";

    if (GIF_URL) {
      document.getElementById("thanksGif").src = GIF_URL;
      document.getElementById("gifWrap").style.display = "flex";
    }

    // Auto terug naar kassa (handig voor volgende klant)
    let seconds = 8;
    const el = document.getElementById("countdown");
    const timer = setInterval(() => {
      el.textContent = "Terug naar kassa over " + seconds + " seconden.";
      seconds--;
      if (seconds < 0) {
        clearInterval(timer);
        window.location.href = "/index.html";
      }
    }, 1000);
  </script>
</body>
</html>
