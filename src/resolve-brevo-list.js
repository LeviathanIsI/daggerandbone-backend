import https from 'node:https';
import { readConfig } from './config.js';

function getListPage(apiKey, offset) {
  return new Promise((resolve, reject) => {
    const request = https.get(`https://api.brevo.com/v3/contacts/lists?limit=50&offset=${offset}`, {
      agent: false,
      headers: { 'api-key': apiKey, accept: 'application/json' }
    }, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        response.on('end', () => reject(Object.assign(new Error('Brevo list lookup rejected'), { httpStatus: response.statusCode })));
        return;
      }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('Brevo returned an invalid list response')); }
      });
      response.on('error', reject);
    });
    request.setTimeout(10000, () => request.destroy(new Error('Brevo request timed out')));
    request.on('error', reject);
  });
}

async function main() {
  const { apiKey } = readConfig().brevo;
  if (!apiKey) {
    console.error('BREVO_API_KEY is required for read-only list lookup.');
    process.exitCode = 1;
    return;
  }
  const lists = [];
  try {
    for (let offset = 0; ; offset += 50) {
      const data = await getListPage(apiKey, offset);
      if (!Array.isArray(data.lists)) throw new Error('Brevo returned an invalid list response');
      lists.push(...data.lists);
      if (data.lists.length < 50) break;
    }
  } catch (error) {
    if (error.httpStatus) console.error(`Brevo list lookup failed with HTTP ${error.httpStatus}. Check the account API IP allowlist.`);
    else console.error('Brevo list lookup failed due to a network or response error.');
    process.exitCode = 1;
    return;
  }

  const exact = lists.filter((list) => list.name?.trim().toLowerCase() === 'dagger & bone updates');
  const candidates = exact.length ? exact : lists.filter((list) => /dagger|bone|apothecary/i.test(list.name || ''));
  if (!candidates.length) {
    console.log('No matching list names found. Existing list names and IDs:');
    for (const list of lists) console.log(`${list.id}\t${list.name}\tfolder ${list.folderId}`);
  } else {
    console.log('Existing matching list candidates:');
    for (const list of candidates) console.log(`${list.id}\t${list.name}\tfolder ${list.folderId}`);
    if (exact.length === 1) console.log(`Set BREVO_LIST_ID=${exact[0].id} in Backend/.env`);
    if (exact.length > 1) console.log('Multiple exact matches found; choose the correct list in Brevo before setting BREVO_LIST_ID.');
  }
}

await main();
