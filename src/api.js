
const BASE_URL = "https://www.yapin.gg/api/bot/v1";

async function api(path, options = {}) {
  const token = process.env.YAPIN_BOT_TOKEN;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      ...(options.body ? {
        "Content-Type": "application/json"
      } : {}),
      ...options.headers
    },
    signal: AbortSignal.timeout(35000)
  });

  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(
      data?.error || `API returned ${response.status}`
    );

    error.status = response.status;
    error.retryAfter = response.headers.get("Retry-After");

    throw error;
  }

  return data;
}

module.exports = { api };
