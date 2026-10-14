import { createServer } from "node:http";
import { Bot } from "@maxhub/max-bot-api";
import { startAdmin } from "./admin/server.js";
import { onBotAdded, onCallback, onText, openStart, type App } from "./bot/router.js";
import { readConfig, type AppConfig } from "./config.js";
import { botIntro } from "./texts.js";
import { Store } from "./db.js";

const config = readConfig();
const store = new Store(config);
const bot = new Bot(config.botToken);
const app: App = { store, config, api: bot.api, username: config.botUsername };

const me = await bot.api.getMyInfo();
app.username = me.username || app.username;
console.log(`Бот @${app.username} запущен`);
await publishBotIntro(config.botToken);

bot.on("bot_started", (ctx: any) => {
  console.log("событие bot_started");
  return openStart(ctx, app, String(ctx.startPayload ?? ""));
});
bot.on("message_callback", (ctx: any) => {
  console.log("событие message_callback");
  return onCallback(ctx, app);
});
bot.on("message_created", (ctx: any) => {
  const type = ctx.message?.recipient?.chat_type || ctx.chat?.type || "dialog";
  if (type !== "dialog") return;
  const text = ctx.message?.body?.text ?? "";
  console.log(text ? "событие message_created" : "событие message_created без текста");
  if (!text && !ctx.contactInfo) return;
  return onText(ctx, app, text);
});
bot.on("bot_added", (ctx: any) => {
  console.log("событие bot_added");
  return onBotAdded(ctx, app);
});
bot.catch((error: unknown) => {
  console.error(error);
});

startAdmin(app);

if (config.webhookUrl) {
  await listenWebhook(bot, config);
} else {
  await bot.start();
}

async function publishBotIntro(token: string): Promise<void> {
  try {
    const response = await fetch("https://platform-api2.max.ru/me", {
      method: "PATCH",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ description: botIntro }),
    });
    console.log("Описание бота", response.status);
  } catch (error) {
    console.error("Не удалось обновить описание бота", error);
  }
}

async function listenWebhook(bot: Bot, config: AppConfig): Promise<void> {
  if (!/^https:\/\/[^/]+\/.+/.test(config.webhookUrl)) {
    throw new Error("WEBHOOK_URL должен быть https-адресом с путём, например https://puzzlespace.ru/max/webhook");
  }
  if (!/^[a-zA-Z0-9_-]{5,256}$/.test(config.webhookSecret)) {
    throw new Error("WEBHOOK_SECRET: 5–256 символов, только латиница, цифры, _ и -.");
  }
  const path = config.webhookPath.startsWith("/") ? config.webhookPath : `/${config.webhookPath}`;
  const handler = bot.webhookCallback({
    domain: config.webhookUrl,
    path,
    secret: config.webhookSecret,
  });
  const server = createServer((req, res) => {
    const url = (req.url ?? "").split("?")[0];
    if (req.method === "GET" && url === path) {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ok");
      return;
    }
    handler(req, res);
  });
  await new Promise<void>((resolve, reject) => {
    server.listen(config.webhookPort, "127.0.0.1", () => resolve());
    server.once("error", reject);
  });
  console.log(`Вебхук слушает 127.0.0.1:${config.webhookPort}${path}`);

  const current = (await bot.api.getSubscriptions()) as Array<{ url?: string }> | undefined;
  await Promise.all(
    (current ?? [])
      .filter((item) => item.url && item.url !== config.webhookUrl)
      .map((item) => bot.api.unsubscribe(item.url)),
  );
  await bot.api.subscribe(config.webhookUrl, config.webhookSecret, [
    "bot_started",
    "message_created",
    "message_callback",
    "bot_added",
  ]);
  console.log("Подписка MAX зарегистрирована");
}
