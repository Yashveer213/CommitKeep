type GitHubInstallation = {
  id: number;
  html_url: string;
  account: { id: number; login: string; type: string } | null;
};

export function getGitHubAppConfig() {
  const appId = process.env.GITHUB_APP_ID;
  const slug = process.env.GITHUB_APP_SLUG;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!appId || !slug || !privateKey) return null;
  return { appId, slug, privateKey };
}

export function getGitHubOAuthConfig() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function base64Url(value: string | ArrayBuffer) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function derLength(length: number) {
  if (length < 128) return [length];
  const bytes: number[] = [];
  for (let value = length; value > 0; value >>= 8) bytes.unshift(value & 0xff);
  return [0x80 | bytes.length, ...bytes];
}

function der(tag: number, body: Uint8Array) {
  return Uint8Array.from([tag, ...derLength(body.length), ...body]);
}

function pemToArrayBuffer(pem: string) {
  const isPkcs1 = pem.includes("BEGIN RSA PRIVATE KEY");
  const encoded = pem.replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----|-----END (?:RSA )?PRIVATE KEY-----|\s/g, "");
  const binary = atob(encoded);
  const keyBytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (!isPkcs1) return keyBytes.buffer;

  const version = Uint8Array.from([0x02, 0x01, 0x00]);
  const rsaAlgorithm = Uint8Array.from([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
  return der(0x30, Uint8Array.from([...version, ...rsaAlgorithm, ...der(0x04, keyBytes)])).buffer;
}

async function createAppJwt(appId: string, privateKey: string) {
  const issuedAt = Math.floor(Date.now() / 1000) - 60;
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ iat: issuedAt, exp: issuedAt + 600, iss: appId }));
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64Url(signature)}`;
}

export async function getGitHubInstallation(installationId: string) {
  const config = getGitHubAppConfig();
  if (!config) throw new Error("GITHUB_APP_NOT_CONFIGURED");

  const jwt = await createAppJwt(config.appId, config.privateKey);
  const response = await fetch(`https://api.github.com/app/installations/${encodeURIComponent(installationId)}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${jwt}`,
      "User-Agent": "CommitKeep",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) throw new Error(`GITHUB_INSTALLATION_LOOKUP_${response.status}`);
  return response.json() as Promise<GitHubInstallation>;
}

export async function deleteGitHubInstallation(installationId: string) {
  const config = getGitHubAppConfig();
  if (!config) throw new Error("GITHUB_APP_NOT_CONFIGURED");
  const jwt = await createAppJwt(config.appId, config.privateKey);
  const response = await fetch(`https://api.github.com/app/installations/${encodeURIComponent(installationId)}`, {
    method: "DELETE",
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${jwt}`, "User-Agent": "CommitKeep", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!response.ok && response.status !== 404) throw new Error(`GITHUB_INSTALLATION_DELETE_${response.status}`);
}

export async function createInstallationToken(installationId: string) {
  const config = getGitHubAppConfig();
  if (!config) throw new Error("GITHUB_APP_NOT_CONFIGURED");
  const jwt = await createAppJwt(config.appId, config.privateKey);
  const response = await fetch(`https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${jwt}`,
      "User-Agent": "CommitKeep",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`GITHUB_TOKEN_CREATE_${response.status}`);
  return response.json() as Promise<{ token: string; expires_at: string }>;
}

export async function githubInstallationRequest<T>(installationId: string, path: string, init?: RequestInit) {
  const response = await githubInstallationFetch(installationId, path, init);
  if (!response.ok) throw new Error(`GITHUB_API_${response.status}`);
  return response.json() as Promise<T>;
}

export async function githubInstallationFetch(installationId: string, path: string, init?: RequestInit) {
  const { token } = await createInstallationToken(installationId);
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "CommitKeep",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  });
  return response;
}
