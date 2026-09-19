// scripts/email_queue_trigger.gs
//
// Apps Script dispatcher for the quote email queue. Deploy under any Google
// account you control (e.g. dev@example.com):
//   1. script.google.com → New project, paste this file.
//   2. Project Settings → Script properties → add EMAIL_QUEUE_SECRET = the
//      exact value set in the Vercel env var EMAIL_QUEUE_SECRET.
//   3. Triggers → Add trigger → processEmailQueue → Time-driven →
//      Minutes timer → Every minute (tightest scheduled-send latency).
//
// Every minute it POSTs to the dispatcher route, which sends any Gmail
// drafts whose scheduled_at has passed (drafts.send) and marks the queue rows
// sent / failed / cancelled. The route is also gated by QUOTE_EMAIL_MODE on the
// server: if that is "off", the route returns {skipped} and nothing sends.
//
// Not needed in DEMO_MODE: the demo settles due rows itself and never sends.
// Point ENDPOINT at your own deployment (a stable custom domain is best).
const ENDPOINT = "https://quote-automation.example.com/api/email-queue/process";

function processEmailQueue() {
  const secret = PropertiesService.getScriptProperties().getProperty("EMAIL_QUEUE_SECRET");
  if (!secret) throw new Error("Set script property EMAIL_QUEUE_SECRET");
  const res = UrlFetchApp.fetch(ENDPOINT, {
    method: "post",
    headers: { "x-email-queue-secret": secret },
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code !== 200) {
    console.error("email queue process failed: " + code + " " + res.getContentText());
    return;
  }
  console.log(res.getContentText());
}
