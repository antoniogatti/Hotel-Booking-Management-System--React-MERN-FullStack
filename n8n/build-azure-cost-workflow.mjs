// Generates azure-cost-weekly.json (importable into n8n). Run: node n8n/build-azure-cost-workflow.mjs
import { readFileSync, writeFileSync } from "node:fs";

const OPENAI_RESOURCE_ID = "/subscriptions/9b57086c-fdb8-43eb-ad36-a02c7a19ab09/resourceGroups/PalazzoPintoBnB-Pro/providers/Microsoft.CognitiveServices/accounts/prd-open-ai-pp-01-pro";
const MAIL_SENDER = "info@palazzopintobnb.com";
const MAIL_TO = "info@palazzopintobnb.com";
const GRAPH_CREDENTIAL_ID = "lzGvVXAiyOsdlVc7"; // n8n credential on n8n-palazzopinto (website's MS_ENTRA_* app)
const META_CREDENTIAL_ID = "9ECuXnuigbGEyf58"; // n8n httpHeaderAuth credential holding the WhatsApp token
const WA_PHONE_NUMBER_ID = "1373088652564505";
const SUBSCRIPTION_ID = "9b57086c-fdb8-43eb-ad36-a02c7a19ab09";

const buildQuery = `
const now = new Date();
const utc = (y, m, d) => new Date(Date.UTC(y, m, d));
const iso = (d) => d.toISOString().slice(0, 10);

// Always the current billing period: 1st of this month up to today.
const start = utc(now.getUTCFullYear(), now.getUTCMonth(), 1);
const end = utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
const weekEnd = new Date(now.getTime() + 6 * 86400000);

// Azure bills this subscription per calendar month (verified via billingPeriods API).
const billingStart = start;
const billingEnd = utc(start.getUTCFullYear(), start.getUTCMonth() + 1, 0);
const nextReset = utc(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);
const today = utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
const daysToReset = Math.round((nextReset - today) / 86400000);

return [{ json: {
  billingStart: iso(billingStart),
  billingEnd: iso(billingEnd),
  nextReset: iso(nextReset),
  daysToReset,
  consumedFrom: iso(start),
  consumedTo: iso(end),
  weekFrom: iso(now),
  weekTo: iso(weekEnd),
  query: {
    type: 'ActualCost',
    timeframe: 'Custom',
    timePeriod: { from: iso(start) + 'T00:00:00Z', to: iso(end) + 'T23:59:59Z' },
    dataset: {
      granularity: 'None',
      aggregation: { totalCost: { name: 'Cost', function: 'Sum' } },
      grouping: [{ type: 'Dimension', name: 'ServiceName' }],
    },
  },
} }];
`.trim();

const formatEmail = readFileSync(new URL("./format-email.js", import.meta.url), "utf8").trim();

const workflow = {
  name: "Palazzo Pinto - Azure Cost Weekly Summary",
  nodes: [
    {
      parameters: { rule: { interval: [{ field: "weeks", triggerAtDay: [1], triggerAtHour: 8 }] } },
      name: "Every Monday 08:00",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [0, 0],
    },
    {
      parameters: { jsCode: buildQuery },
      name: "Build Query",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [220, 0],
    },
    {
      // App Service managed identity (Cost Management Reader on the subscription) - no secrets stored
      parameters: {
        url: "={{ $env.IDENTITY_ENDPOINT }}?api-version=2019-08-01&resource=https://management.azure.com/",
        sendHeaders: true,
        headerParameters: { parameters: [{ name: "X-IDENTITY-HEADER", value: "={{ $env.IDENTITY_HEADER }}" }] },
        options: {},
      },
      name: "Get Managed Identity Token",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [440, 0],
    },
    {
      parameters: {
        method: "POST",
        url: `https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`,
        sendHeaders: true,
        headerParameters: { parameters: [{ name: "Authorization", value: "=Bearer {{ $json.access_token }}" }] },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ JSON.stringify($('Build Query').item.json.query) }}",
        options: {},
      },
      name: "Azure Cost Query",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [660, 0],
      retryOnFail: true,
      waitBetweenTries: 5000,
    },
    {
      // Azure OpenAI token/request usage (needs Monitoring Reader on the OpenAI resource)
      parameters: {
        url: `=https://management.azure.com${OPENAI_RESOURCE_ID}/providers/microsoft.insights/metrics?api-version=2018-01-01&metricnames=ProcessedPromptTokens,GeneratedTokens,AzureOpenAIRequests&aggregation=Total&timespan={{ $('Build Query').item.json.consumedFrom }}T00:00:00Z/{{ $('Build Query').item.json.consumedTo }}T23:59:59Z`,
        sendHeaders: true,
        headerParameters: { parameters: [{ name: "Authorization", value: "=Bearer {{ $('Get Managed Identity Token').item.json.access_token }}" }] },
        options: {},
      },
      name: 'Azure OpenAI Usage',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [880, 0],
      retryOnFail: true,
      waitBetweenTries: 5000,
    },
    {
      // WhatsApp number status for the report; a Meta failure must not block the cost email
      parameters: {
        url: `https://graph.facebook.com/v21.0/${WA_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,status,quality_rating,name_status,messaging_limit_tier,code_verification_status`,
        authentication: "genericCredentialType",
        genericAuthType: "httpHeaderAuth",
        options: {},
      },
      name: "WhatsApp Status",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1100, 0],
      onError: "continueRegularOutput",
      credentials: { httpHeaderAuth: { id: META_CREDENTIAL_ID, name: "Meta WhatsApp token" } },
    },
    {
      parameters: { jsCode: formatEmail },
      name: "Format Email",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1320, 0],
    },
    {
      // Same Entra app the website uses (client credentials, Mail.Send) -> Graph sendMail as info@
      parameters: {
        method: "POST",
        url: `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MAIL_SENDER)}/sendMail`,
        authentication: "genericCredentialType",
        genericAuthType: "oAuth2Api",
        sendBody: true,
        specifyBody: "json",
        jsonBody: `={{ JSON.stringify({ message: { subject: $json.subject, body: { contentType: 'HTML', content: $json.html }, toRecipients: [{ emailAddress: { address: '${MAIL_TO}' } }] }, saveToSentItems: true }) }}`,
        options: {},
      },
      name: "Send via Microsoft Graph",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1540, 0],
      credentials: { oAuth2Api: { id: GRAPH_CREDENTIAL_ID, name: "Microsoft Graph - Palazzo Pinto mail" } },
    },
  ],
  connections: {
    "Every Monday 08:00": { main: [[{ node: "Build Query", type: "main", index: 0 }]] },
    "Build Query": { main: [[{ node: "Get Managed Identity Token", type: "main", index: 0 }]] },
    "Get Managed Identity Token": { main: [[{ node: "Azure Cost Query", type: "main", index: 0 }]] },
    "Azure Cost Query": { main: [[{ node: "Azure OpenAI Usage", type: "main", index: 0 }]] },
    "Azure OpenAI Usage": { main: [[{ node: "WhatsApp Status", type: "main", index: 0 }]] },
    "WhatsApp Status": { main: [[{ node: "Format Email", type: "main", index: 0 }]] },
    "Format Email": { main: [[{ node: "Send via Microsoft Graph", type: "main", index: 0 }]] },
  },
  settings: { executionOrder: "v1", timezone: "Europe/Rome" },
};

writeFileSync(new URL("./azure-cost-weekly.json", import.meta.url), JSON.stringify(workflow, null, 2));
console.log("written");
