// Authentification Google (compte de service) SANS dépendance : le JWT
// RS256 est signé avec node:crypto, puis échangé contre un jeton d'accès.
// Le paquet `googleapis` pèse plusieurs dizaines de Mo pour deux appels REST.
import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const SCOPE_GSC = 'https://www.googleapis.com/auth/webmasters.readonly';

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * Lit la clé de compte de service depuis GOOGLE_SERVICE_ACCOUNT_JSON — soit le
 * JSON brut, soit le même JSON encodé en base64 (plus commode à coller dans un
 * secret GitHub, où les retours à la ligne d'une clé PEM posent problème).
 */
export function litCompteDeService(brut) {
  if (!brut) return null;
  const texte = brut.trim().startsWith('{')
    ? brut
    : Buffer.from(brut, 'base64').toString('utf8');
  let cle;
  try {
    cle = JSON.parse(texte);
  } catch {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON illisible : attendu le JSON du compte de service, ou ce JSON encodé en base64.',
    );
  }
  if (!cle.client_email || !cle.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON : client_email ou private_key manquant.');
  }
  return cle;
}

/** Jeton d'accès OAuth2 pour un compte de service (flux JWT bearer). */
export async function jetonAcces(cle, scope = SCOPE_GSC, maintenant = Math.floor(Date.now() / 1000)) {
  const entete = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const charge = b64url(
    JSON.stringify({
      iss: cle.client_email,
      scope,
      aud: TOKEN_URL,
      iat: maintenant,
      exp: maintenant + 3600,
    }),
  );
  const signature = b64url(
    createSign('RSA-SHA256').update(`${entete}.${charge}`).end().sign(cle.private_key),
  );

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${entete}.${charge}.${signature}`,
    }),
  });
  const corps = await res.json();
  if (!res.ok) {
    throw new Error(
      `Échec de l'obtention du jeton Google (${res.status}) : ${corps.error_description ?? corps.error ?? 'raison inconnue'}`,
    );
  }
  return corps.access_token;
}
