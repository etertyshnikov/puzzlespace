export async function queuePortalListing(payload: {
  kind: string;
  title: string;
  body: Record<string, string>;
  author_name?: string;
  phone?: string;
}): Promise<string> {
  const secret = process.env.PORTAL_INGEST_SECRET?.trim() ?? "";
  const url = process.env.PORTAL_INGEST_URL?.trim() || "http://127.0.0.1:8008/api/portal/ingest";
  if (!secret) return "Связь с сайтом не настроена: объявление сохранено в боте и ждёт модерации.";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Portal-Secret": secret },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error("portal ingest", response.status, text.slice(0, 300));
      return "Сайт пока не принял объявление. Оно сохранено в боте.";
    }
    return "Оно появилось в дашборде администратора.";
  } catch (error) {
    console.error("portal ingest", error);
    return "Сайт пока не принял объявление. Оно сохранено в боте.";
  }
}
