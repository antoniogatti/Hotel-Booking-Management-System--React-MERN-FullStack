// n8n Code node body: builds the Palazzo Pinto branded weekly cost email.
// Brand (from the website): navy #1f4465 logo, coral #f0846a payoff, Cormorant Garamond headings, Manrope body.
const ctx = $('Build Query').item.json;
const props = $('Azure Cost Query').item.json.properties || {};
const usage = $('Azure OpenAI Usage').item.json.value || [];
const wa = $json;
const waOk = wa && wa.status && !wa.error;

const cols = (props.columns || []).map((c) => c.name);
const iCost = cols.indexOf('Cost') >= 0 ? cols.indexOf('Cost') : cols.indexOf('PreTaxCost');
const iSvc = cols.indexOf('ServiceName');
const iCur = cols.indexOf('Currency');

const isAi = (name) => /openai|cognitive|foundry|machine learning|ai services/i.test(name);
const rows = (props.rows || []).map((r) => ({ service: r[iSvc], cost: Number(r[iCost]) }));
const currency = (props.rows && props.rows[0] && props.rows[0][iCur]) || 'USD';
const total = rows.reduce((s, r) => s + r.cost, 0);
const aiCost = rows.filter((r) => isAi(r.service)).reduce((s, r) => s + r.cost, 0);
if (!rows.some((r) => isAi(r.service))) rows.push({ service: 'Azure OpenAI (AI)', cost: 0 });
rows.sort((a, b) => b.cost - a.cost);

const metric = (name) => {
  const m = usage.find((v) => v.name && v.name.value === name);
  const data = (m && m.timeseries && m.timeseries[0] && m.timeseries[0].data) || [];
  return data.reduce((s, d) => s + (d.total || 0), 0);
};
const waGood = waOk && wa.status === 'CONNECTED' && wa.quality_rating !== 'RED' && wa.quality_rating !== 'YELLOW';
const tokensIn = metric('ProcessedPromptTokens');
const tokensOut = metric('GeneratedTokens');
const requests = metric('AzureOpenAIRequests');

const fmt = (n) => n.toFixed(2) + ' ' + currency;
const num = (n) => Math.round(n).toLocaleString('en-GB');
const day = (s) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayShort = (s) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const NAVY = '#1f4465', NAVY_DARK = '#16324a', CORAL = '#f0846a';
const TINT = '#f1f5f9', TINT_BORDER = '#d9e3ec', CORAL_TINT = '#fdeee9', INK = '#16324a';
const serif = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const sans = "Manrope, 'Segoe UI', Helvetica, Arial, sans-serif";
const label = 'font:bold 11px ' + sans + ';letter-spacing:1.5px;text-transform:uppercase;';

const resetText = ctx.daysToReset === 1
  ? 'Costs restart from zero <b>tomorrow, ' + day(ctx.nextReset) + '</b>'
  : 'Costs restart from zero on <b>' + day(ctx.nextReset) + '</b> (in ' + ctx.daysToReset + ' days)';

const body = rows.map((r, i) => {
  const ai = isAi(r.service);
  return '<tr style="background:' + (ai ? CORAL_TINT : i % 2 ? '#f8fafc' : '#ffffff') + ';">' +
    '<td style="padding:13px 16px;font:15px ' + sans + ';color:' + INK + ';border-bottom:1px solid ' + TINT + ';">' + esc(r.service) + '</td>' +
    '<td align="right" style="padding:13px 16px;font:15px ' + sans + ';color:' + INK + ';border-bottom:1px solid ' + TINT + ';white-space:nowrap;">' + fmt(r.cost) + '</td></tr>';
}).join('');

const html = `
<div style="background:${TINT};padding:24px 12px;">
 <table role="presentation" width="640" align="center" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid ${TINT_BORDER};border-radius:16px;overflow:hidden;">
  <tr><td align="center" style="background:#ffffff;padding:22px 28px 14px;border-bottom:3px solid ${CORAL};">
    <img src="https://www.palazzopintobnb.com/common/LOGOPAYOFF_PalazzoPinto.png" alt="Palazzo Pinto - Dimore di viaggio" height="80" style="height:80px;border:0;">
  </td></tr>
  <tr><td bgcolor="${NAVY}" style="background:${NAVY};background-image:linear-gradient(135deg,${NAVY_DARK},${NAVY});padding:22px 28px;">
    <div style="font:bold 28px ${serif};color:#ffffff;">Azure Cost Update</div>
    <div style="font:14px ${sans};color:#d9e3ec;margin-top:4px;">Weekly infrastructure spending for Palazzo Pinto B&amp;B, month-to-date</div>
  </td></tr>
  <tr><td style="padding:20px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="48%" style="background:${TINT};border:1px solid ${TINT_BORDER};border-radius:10px;padding:12px 14px;">
        <div style="${label}color:${NAVY};">Notification week</div>
        <div style="font:15px ${sans};color:${INK};margin-top:4px;">${dayShort(ctx.weekFrom)} – ${day(ctx.weekTo)}</div>
      </td><td width="4%"></td>
      <td width="48%" style="background:${TINT};border:1px solid ${TINT_BORDER};border-radius:10px;padding:12px 14px;">
        <div style="${label}color:${NAVY};">Consumed period</div>
        <div style="font:15px ${sans};color:${INK};margin-top:4px;">${dayShort(ctx.consumedFrom)} – ${day(ctx.consumedTo)}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:12px 28px 0;">
    <div style="background:${CORAL_TINT};border:1px solid ${CORAL};border-radius:10px;padding:12px 14px;">
      <div style="${label}color:#c24f33;">Current billing period</div>
      <div style="font:15px ${sans};color:${INK};margin-top:4px;">${day(ctx.billingStart)} – ${day(ctx.billingEnd)}</div>
      <div style="font:14px ${sans};color:${INK};margin-top:4px;">${resetText}</div>
    </div>
  </td></tr>
  <tr><td style="padding:16px 28px 0;">
    <div style="background:${TINT};border:1px solid ${TINT_BORDER};border-radius:10px;padding:14px 18px;">
      <div style="${label}color:${NAVY};">Month-to-date total</div>
      <div style="font:bold 36px ${serif};color:${NAVY};margin-top:2px;">${fmt(total)}</div>
    </div>
  </td></tr>
  <tr><td style="padding:16px 28px 0;">
    <div style="background:#ffffff;border:1px solid ${TINT_BORDER};border-left:4px solid ${CORAL};border-radius:10px;padding:14px 18px;">
      <div style="${label}color:#c24f33;">AI consumption (Sofia, Azure OpenAI)</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr>
        <td style="font:13px ${sans};color:#5b6f82;">Requests<br><b style="font:bold 20px ${serif};color:${NAVY};">${num(requests)}</b></td>
        <td style="font:13px ${sans};color:#5b6f82;">Tokens in<br><b style="font:bold 20px ${serif};color:${NAVY};">${num(tokensIn)}</b></td>
        <td style="font:13px ${sans};color:#5b6f82;">Tokens out<br><b style="font:bold 20px ${serif};color:${NAVY};">${num(tokensOut)}</b></td>
        <td align="right" style="font:13px ${sans};color:#5b6f82;">Billed so far<br><b style="font:bold 20px ${serif};color:${NAVY};">${fmt(aiCost)}</b></td>
      </tr></table>
      <div style="font:12px ${sans};color:#5b6f82;margin-top:8px;">Usage is live; cost is billed by Azure with a 1-2 day delay, so it may show 0.00 for recent activity.</div>
    </div>
  </td></tr>
  <tr><td style="padding:16px 28px 0;">
    <div style="background:#ffffff;border:1px solid ${TINT_BORDER};border-left:4px solid ${waGood ? '#2e7d32' : '#c62828'};border-radius:10px;padding:14px 18px;">
      <div style="${label}color:${NAVY};">WhatsApp status (Sofia)</div>
      <div style="font:15px ${sans};color:${INK};margin-top:6px;">${waOk
        ? '<b style="color:' + (waGood ? '#2e7d32' : '#c62828') + ';">' + esc(wa.status) + '</b> · ' + esc(wa.display_phone_number) + ' · quality <b>' + esc(wa.quality_rating) + '</b>'
        : '<b style="color:#c62828;">Status unavailable</b> - could not read the number status from Meta'}</div>
      ${waOk ? '<div style="font:13px ' + sans + ';color:#5b6f82;margin-top:4px;">Display name: ' + esc(wa.verified_name) + ' (' + esc(wa.name_status) + ') · phone verification: ' + esc(wa.code_verification_status) + '</div>' : ''}
      <div style="font:12px ${sans};color:#5b6f82;margin-top:6px;">Checked every 30 minutes by an automatic monitor; you are emailed immediately if something breaks.</div>
    </div>
  </td></tr>
  <tr><td style="padding:16px 28px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${TINT_BORDER};border-radius:10px;overflow:hidden;border-collapse:separate;">
      <tr style="background:${NAVY};">
        <th align="left" style="padding:13px 16px;font:bold 13px ${sans};letter-spacing:1px;color:#ffffff;text-transform:uppercase;">Service type</th>
        <th align="right" style="padding:13px 16px;font:bold 13px ${sans};letter-spacing:1px;color:#ffffff;text-transform:uppercase;">Cost</th>
      </tr>${body}
    </table>
    <div style="font:12px ${sans};color:#5b6f82;text-align:center;margin-top:16px;">Palazzo Pinto B&amp;B · Via Masaniello, 30 · Brindisi · Automated by n8n · Source: Azure Cost Management</div>
  </td></tr>
 </table>
</div>`.trim();

return [{ json: {
  subject: 'Palazzo Pinto – Azure Cost Weekly Summary – ' + day(ctx.weekFrom),
  html,
  total,
} }];
