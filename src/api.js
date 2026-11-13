const TOKEN_KEY = "curbclear_token";

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // storage not available
  }
};

export const saveToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage not available: the user will just have to log in again next time
  }
};

// Small helper that talks to the CurbClear server and returns clear error messages
export async function api(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, { method, headers, body: payload });
  } catch {
    throw new Error("Cannot reach the server. Make sure the server window is running.");
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    // the server sent no JSON body
  }
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}