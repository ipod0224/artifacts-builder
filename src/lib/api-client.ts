export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) throw new Error('API returned success: false');
  return json.data;
}
