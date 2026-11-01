// WhatsApp (Sofia) status monitor. Run by .github/workflows/whatsapp-status.yml every 30 min.
// Exit code 1 if any check fails. Emails info@ on a new incident (and on recovery) when SEND_MAIL=1.
const env = (k, d) => process.env[k] ?? d;

const GRAPH = "https://graph.facebook.com/v21.0";
const API_BASE = env("API_BASE", "https://api.palazzopintobnb.com");
const PHONE_ID = env("WA_PHONE_NUMBER_ID");
const WABA_ID = env("WA_WABA_ID", "1910896986216211");
const META_APP_ID = env("META_APP_ID", "2504033626636979");
const TOKEN = env("WA_ACCESS_TOKEN");
const VERIFY_TOKEN = env("WA_VERIFY_TOKEN");
const MAIL = "info@palazzopintobnb.com";

const get = async (url, headers = {}) => {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, text, json };
};
const auth = { Authorization: `Bearer ${TOKEN}` };

const checks = [];
const record = (name, level, detail) =>
  checks.push({ name, level, detail: String(detail).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) }); // level: ok | warn | fail
const run = async (name, fn) => {
  try { await fn(); } catch (e) { record(name, "fail", `check crashed: ${e.message}`); }
};

await run("Backend API health", async () => {
  const r = await get(`${API_BASE}/api/health`);
  const ok = r.status === 200 && r.json?.status === "healthy" && r.json?.database?.status === "connected";
  record("Backend API health", ok ? "ok" : "fail", ok ? "healthy, database connected" : `HTTP ${r.status} ${r.text.slice(0, 120)}`);
});

await run("Webhook reachable", async () => {
  const challenge = `chk${Date.now()}`;
  const r = await get(`${API_BASE}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(VERIFY_TOKEN)}&hub.challenge=${challenge}`);
  const ok = r.status === 200 && r.text === challenge;
  record("Webhook reachable", ok ? "ok" : "fail", ok ? "Meta verification handshake answered" : `HTTP ${r.status} ${r.text.slice(0, 120)}`);
});

await run("WhatsApp number", async () => {
  const fields = "display_phone_number,verified_name,status,quality_rating,name_status,messaging_limit_tier,code_verification_status";
  const r = await get(`${GRAPH}/${PHONE_ID}?fields=${fields}`, auth);
  if (r.status !== 200) return record("WhatsApp number", "fail", `Meta API HTTP ${r.status}: ${r.json?.error?.message ?? r.text.slice(0, 120)}`);
  const n = r.json;
  const bad = n.status !== "CONNECTED" || n.quality_rating === "RED" || n.code_verification_status !== "VERIFIED";
  const warn = n.quality_rating === "YELLOW" || ["DECLINED", "EXPIRED"].includes(n.name_status);
  record("WhatsApp number", bad ? "fail" : warn ? "warn" : "ok",
    `${n.display_phone_number} ${n.status}, quality ${n.quality_rating}, name ${n.name_status}, verification ${n.code_verification_status}`);
});

await run("Access token", async () => {
  const r = await get(`${GRAPH}/debug_token?input_token=${encodeURIComponent(TOKEN)}`, auth);
  const d = r.json?.data;
  if (!d) return record("Access token", "fail", `debug_token HTTP ${r.status}: ${r.json?.error?.message ?? ""}`);
  const days = d.expires_at ? Math.round((d.expires_at * 1000 - Date.now()) / 86400000) : null;
  const level = !d.is_valid ? "fail" : days !== null && days < 7 ? "warn" : "ok";
  record("Access token", level, !d.is_valid ? "token is INVALID" : days === null ? "valid, never expires" : `valid, expires in ${days} days`);
});

await run("Webhook subscription", async () => {
  const r = await get(`${GRAPH}/${WABA_ID}/subscribed_apps`, auth);
  if (r.status !== 200) return record("Webhook subscription", "fail", `Meta API HTTP ${r.status}: ${r.json?.error?.message ?? ""}`);
  const ok = (r.json?.data ?? []).some((a) => a.whatsapp_business_api_data?.id === META_APP_ID);
  record("Webhook subscription", ok ? "ok" : "fail", ok ? "app is subscribed to the WhatsApp account" : "app is NOT subscribed to the WABA - Sofia will not receive messages");
});

const failed = checks.filter((c) => c.level === "fail");
const warned = checks.filter((c) => c.level === "warn");
const icon = { ok: "OK  ", warn: "WARN", fail: "FAIL" };
for (const c of checks) console.log(`${icon[c.level]} ${c.name}: ${c.detail}`);
console.log(failed.length ? `\n${failed.length} check(s) FAILED` : warned.length ? "\nAll up, with warnings" : "\nAll checks passed");

const sendMail = async (subject, html) => {
  const tokenRes = await fetch(`https://login.microsoftonline.com/${env("MS_ENTRA_TENANT_ID")}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env("MS_ENTRA_CLIENT_ID"),
      client_secret: env("MS_ENTRA_CLIENT_SECRET"),
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  const { access_token } = await tokenRes.json();
  if (!access_token) throw new Error("could not get Graph token");
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MAIL)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: { subject, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: MAIL } }] },
      saveToSentItems: true,
    }),
  });
  if (!res.ok) throw new Error(`sendMail HTTP ${res.status}: ${await res.text()}`);
};

const NAVY = "#1f4465", CORAL = "#f0846a";
const color = { ok: "#2e7d32", warn: "#b26a00", fail: "#c62828" };
const page = (title, intro) => `
<div style="background:#f1f5f9;padding:24px 12px;font-family:Manrope,'Segoe UI',Arial,sans-serif;">
 <table role="presentation" width="640" align="center" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border:1px solid #d9e3ec;border-radius:16px;overflow:hidden;">
  <tr><td align="center" style="padding:20px;border-bottom:3px solid ${CORAL};"><img src="https://www.palazzopintobnb.com/common/LOGOPAYOFF_PalazzoPinto.png" alt="Palazzo Pinto" height="70" style="height:70px;border:0;"></td></tr>
  <tr><td style="background:${NAVY};padding:18px 28px;color:#fff;"><div style="font:bold 24px Georgia,serif;">${title}</div><div style="font-size:14px;color:#d9e3ec;margin-top:4px;">${intro}</div></td></tr>
  <tr><td style="padding:20px 28px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d9e3ec;border-radius:10px;">
   ${checks.map((c) => `<tr><td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#16324a;"><b style="color:${color[c.level]}">${icon[c.level].trim()}</b> &nbsp;<b>${c.name}</b><br><span style="color:#5b6f82;font-size:13px;">${c.detail.replace(/</g, "&lt;")}</span></td></tr>`).join("")}
  </table><div style="font-size:12px;color:#5b6f82;margin-top:14px;text-align:center;">Checked ${new Date().toISOString()} · GitHub Actions · Sofia WhatsApp monitor</div></td></tr>
 </table></div>`;

const prevFailed = env("PREV_FAILED") === "1";
if (env("SEND_MAIL") === "1") {
  try {
    if (failed.length && !prevFailed) {
      await sendMail(`[ALERT] Palazzo Pinto WhatsApp: ${failed.map((c) => c.name).join(", ")}`, page("WhatsApp problem detected", "Sofia may not be answering guests. Details below."));
      console.log("alert email sent");
    } else if (!failed.length && prevFailed) {
      await sendMail("[RECOVERED] Palazzo Pinto WhatsApp is back to normal", page("WhatsApp recovered", "All checks pass again."));
      console.log("recovery email sent");
    }
  } catch (e) {
    console.error(`mail failed: ${e.message}`);
    process.exitCode = 1;
  }
}
if (failed.length) process.exitCode = 1;
