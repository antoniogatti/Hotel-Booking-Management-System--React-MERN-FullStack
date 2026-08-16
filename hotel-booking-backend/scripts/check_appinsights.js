#!/usr/bin/env node
const appId = 'ef6f5b07-0ecb-478d-a546-3527f949a6a8';
const apiKey = '30gNwbmAiQ7I7GdWuLvWvERW26tY23MqwCBj4PTvr4R4rmSJLtxyJQQJ99CHAAAAAAAAAAAAAAAAazaipebF';
(function(){
  const arg = process.argv[2];
  if (arg === "check_public_events") {
    return "customEvents | where name == 'public_page_view' | take 5";
  }
  if (arg === "search_synthetic") {
    return "search in (customEvents, traces) 'synthetic' | take 10";
  }
  if (arg === "search_synthetic") {
    return "search in (customEvents, traces) 'synthetic' | take 10";
  }

  return process.argv[2] || "requests | where timestamp >= ago(7d) | summarize count()";
})();

const query = (function(){
  const arg = process.argv[2];
  if (arg === "check_public_events") {
    return "customEvents | where name == 'public_page_view' | take 5";
  }
  if (arg === "search_synthetic") {
    return "search in (customEvents, traces) 'synthetic' | take 10";
  }

  return process.argv[2] || "requests | where timestamp >= ago(7d) | summarize count()";
})();
(async function(){
  // Support sending a synthetic custom event to the ingestion endpoint for testing
  if (process.argv[2] === 'send_synthetic_event') {
    try {
      const iKey = process.env.APPINSIGHTS_INSTRUMENTATIONKEY || '770defd0-fe16-4fca-af55-465364661c2a';
      const envelope = [
        {
          name: 'Microsoft.ApplicationInsights.Event',
          time: new Date().toISOString(),
          iKey,
          data: {
            baseType: 'EventData',
            baseData: {
              ver: 2,
              name: 'public_page_view',
              properties: {
                path: '/synthetic-test',
                title: 'Synthetic Test',
                referrer: '',
                language: 'en-US',
                triggeredBy: 'check_appinsights.js'
              },
              measurements: {}
            }
          }
        }
      ];

      const resp = await fetch('https://dc.services.visualstudio.com/v2/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope),
      });

      console.log('Synthetic event sent, status:', resp.status);
      const text = await resp.text();
      if (text) console.log('Response body:', text.slice(0, 1000));
      process.exit(resp.ok ? 0 : 2);
    } catch (e) {
      console.error('Failed sending synthetic event', e && e.message ? e.message : e);
      process.exit(2);
    }
  }
  try{
    const body = { query };
    const res = await fetch(`https://api.applicationinsights.io/v1/apps/${appId}/query`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
  }catch(err){
    console.error('ERROR', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
