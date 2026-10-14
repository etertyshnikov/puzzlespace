import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppConfig } from "../config.js";
import type { Store } from "../db.js";
import { about, botIntro, contacts, emailDisplay, phoneDisplay, siteUrl, welcome } from "../texts.js";
import { callback, keyboard, reply } from "./ui.js";

type App = { store: Store; config: AppConfig; api: any; username: string };

const menuPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../assets/menu.jpg");
const menuSentAt = new Map<number, number>();

export function menuRows(username = "") {
  const rows = [
    [callback("Смета дома — рассчитать", "go:calc", "positive"), callback("Заказать смету", "go:brief", "positive")],
    [callback("Разместить вакансию", "go:vacancy"), callback("Разместить резюме", "go:resume")],
    [callback("Продать участок", "go:sell"), callback("Купить участок", "go:buy")],
    [callback("О нас", "go:about"), callback("Контакты", "go:contacts")],
    [callback("Личный кабинет", "go:cabinet", "positive"), callback("Стать агентом", "go:partner", "positive")],
    [callback("Закрыть", "nav:close", "negative")],
  ];
  rows.unshift([{ kind: "link", text: "Открыть сайт", url: siteUrl }]);
  if (username) {
    rows.unshift([{ kind: "app", text: "Открыть приложение", webApp: username, payload: "home" }]);
  }
  return rows;
}

async function imageAttachment(app: App): Promise<unknown | null> {
  const cached = app.store.setting("menu_image_token");
  if (cached) return { type: "image", payload: { token: cached } };
  try {
    const image = await app.api.uploadImage({ source: menuPath });
    const json = image.toJson();
    const token = json?.payload?.token;
    if (token) app.store.setSetting("menu_image_token", token);
    return json;
  } catch (error) {
    console.error("Не удалось загрузить картинку меню", error);
    return null;
  }
}

export async function sendIntro(ctx: any): Promise<void> {
  await reply(ctx, botIntro, [[callback("Старт", "nav:start", "positive")]]);
}

export function introSeen(app: App, userId: number): boolean {
  return app.store.setting(`intro:${userId}`) === "1";
}

export function markIntro(app: App, userId: number): void {
  if (userId) app.store.setSetting(`intro:${userId}`, "1");
}

export async function sendMenu(ctx: any, app: App): Promise<void> {
  const userId = Number(ctx.user?.user_id ?? 0);
  markIntro(app, userId);
  const now = Date.now();
  if (userId && now - (menuSentAt.get(userId) ?? 0) < 1500) return;
  if (userId) menuSentAt.set(userId, now);
  const buttons = keyboard(menuRows(app.username));
  const image = await imageAttachment(app);
  try {
    await deliverMenu(ctx, buttons, image);
  } catch (error) {
    app.store.setSetting("menu_image_token", "");
    console.error("Меню с картинкой не отправилось, повторяю без неё", error);
    try {
      await deliverMenu(ctx, buttons, null);
    } catch (second) {
      console.error("Меню с кнопкой приложения не отправилось, повторяю без неё", second);
      await deliverMenu(ctx, keyboard(menuRows("")), null);
    }
  }
}

async function deliverMenu(ctx: any, buttons: unknown, image: unknown | null): Promise<void> {
  await ctx.reply(welcome, {
    format: "markdown",
    attachments: image ? [image, buttons] : [buttons],
  });
}

export async function showAbout(ctx: any): Promise<void> {
  await reply(ctx, about, [[callback("Контакты", "go:contacts"), callback("В меню", "nav:menu")]]);
}

export async function showContacts(ctx: any): Promise<void> {
  await reply(ctx, contacts, [
    [{ kind: "link", text: "Сайт puzzlespace.ru", url: siteUrl }],
    [{ kind: "clipboard", text: "Скопировать телефон", payload: phoneDisplay }],
    [{ kind: "clipboard", text: "Скопировать почту", payload: emailDisplay }],
    [callback("В меню", "nav:menu")],
  ]);
}
