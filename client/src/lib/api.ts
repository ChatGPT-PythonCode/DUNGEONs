const API = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

let token = localStorage.getItem("token") ?? "";
export const setToken = (next: string) => {
  token = next;
  localStorage.setItem("token", next);
};

export const request = async (path: string, method = "GET", body?: unknown) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

export { API };
