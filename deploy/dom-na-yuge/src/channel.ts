import type { AppConfig } from "./config.js";
import type { Store } from "./db.js";

type App = { store: Store; config: AppConfig; api: any; username: string };

export function publicListingText(listing: { title: string; body: Record<string, string>; hashtags: string; id?: number }): string {
  const rows = Object.entries(listing.body)
    .filter(([key, value]) => key !== "phone" && value && key !== "Автор")
    .map(([key, value]) => `**${key}:** ${value}`);
  const author = listing.body["Автор"] ? `\nАвтор: ${listing.body["Автор"]}` : "";
  const tags = listing.hashtags ? `\n\n${listing.hashtags}` : "";
  return [`**${listing.title}**`, "", ...rows, author, tags].filter((line) => line !== undefined).join("\n");
}

export function botLink(username: string, payload: string): string {
  return `https://max.ru/${username}?start=${encodeURIComponent(payload)}`;
}

export function publishingEnabled(app: App): boolean {
  const saved = app.store.setting("auto_publish");
  if (saved == null) return app.config.autoPublish;
  return saved !== "0";
}

export async function publishListing(app: App, id: number, force = false): Promise<boolean> {
  const row = app.store.listing(id);
  if (!row) return false;
  const kind = String(row.kind || "");
  const savedKind = app.store.setting(`channel_chat_${kind}`);
  const fromEnv = Number(process.env[`CHANNEL_CHAT_${kind.toUpperCase()}`]);
  const channelId = savedKind && Number(savedKind)
    ? Number(savedKind)
    : (Number.isInteger(fromEnv) && fromEnv !== 0 ? fromEnv : null);
  const body = JSON.parse(String(row.body_json)) as Record<string, string>;
  const text = [
    publicListingText({ title: String(row.title), body, hashtags: String(row.hashtags), id }),
    "",
    "Телефон в объявлении не публикуется. Нажмите кнопку и напишите автору в боте — сообщение увидит только он.",
  ].join("\n");
  if (!channelId) {
    app.store.markListing(id, "pending", null, `Для типа ${kind} не задана своя группа Max`);
    return false;
  }
  if (!force && !publishingEnabled(app)) {
    app.store.markListing(id, "pending", null, "");
    return false;
  }
  try {
    const message = await app.api.sendMessageToChat(channelId, text, {
      format: "markdown",
      attachments: [
        {
          type: "inline_keyboard",
          payload: {
            buttons: [[{ type: "link", text: "Написать автору", url: botLink(app.username, `lot_${id}`) }]],
          },
        },
      ],
    });
    const mid = message?.body?.mid ?? message?.mid ?? null;
    app.store.markListing(id, "published", mid ? String(mid) : null, "");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось отправить в канал";
    app.store.markListing(id, "pending", null, message);
    return false;
  }
}

export async function hideListing(app: App, id: number): Promise<void> {
  const row = app.store.listing(id);
  const mid = row?.channel_mid ? String(row.channel_mid) : "";
  if (mid) {
    await app.api.deleteMessage(mid).catch(() => undefined);
  }
  app.store.markListing(id, "hidden", mid || null, "");
}
