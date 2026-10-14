import type { AppConfig } from "../config.js";
import type { Store, UserRow } from "../db.js";
import { botLink } from "../channel.js";
import { hideListing, publicListingText } from "../channel.js";
import { backCalc, onCalcPick, onCalcText, resendPdf, startCalc } from "./calcFlow.js";
import { joinPartner, onAddManager, onStaff, showCabinet, showPartner } from "./cabinet.js";
import { backForm, forms, notifyStaff, onFormPick, onFormText, startForm } from "./forms.js";
import { introSeen, sendIntro, sendMenu, showAbout, showContacts } from "./menu.js";
import { ack, phoneOf, reply, userLabel } from "./ui.js";

export type App = { store: Store; config: AppConfig; api: any; username: string };

export async function remember(ctx: any, app: App): Promise<UserRow | undefined> {
  const user = ctx.user;
  if (!user?.user_id) return undefined;
  return app.store.touchUser({
    id: user.user_id,
    chatId: ctx.chatId ?? null,
    name: userLabel(user),
    username: user.username || "",
  });
}

export async function openStart(ctx: any, app: App, payload = ""): Promise<void> {
  const user = await remember(ctx, app);
  if (!user) return;
  const clean = payload.trim();
  if (clean.startsWith("ref_")) {
    const referrer = app.store.userByRef(clean.slice(4));
    if (referrer) app.store.bindReferrer(user.id, referrer.id);
    await sendMenu(ctx, app);
    return;
  }
  if (clean.startsWith("lot_")) {
    await openLot(ctx, app, Number(clean.slice(4)), user);
    return;
  }
  const action = clean.startsWith("go_") ? clean.slice(3) : clean.startsWith("go:") ? clean.slice(3) : "";
  if (action) {
    await runGo(ctx, app, user, action);
    return;
  }
  if (!introSeen(app, user.id)) {
    await sendIntro(ctx);
    return;
  }
  await sendMenu(ctx, app);
}

export async function onCallback(ctx: any, app: App): Promise<void> {
  await ack(ctx);
  const user = await remember(ctx, app);
  if (!user) return;
  const payload = String(ctx.callback?.payload ?? "");
  if (!payload) return;
  if (payload === "nav:start" || payload === "nav:menu") {
    app.store.clearSession(user.id);
    await sendMenu(ctx, app);
    return;
  }
  if (payload === "nav:close") {
    app.store.clearSession(user.id);
    await reply(ctx, "Диалог закрыт. Напишите «меню», чтобы открыть снова.");
    return;
  }
  if (payload === "nav:back") {
    await goBack(ctx, app, user);
    return;
  }
  if (payload.startsWith("go:")) {
    app.store.clearSession(user.id);
    await runGo(ctx, app, user, payload.slice(3));
    return;
  }
  if (payload.startsWith("pick:")) {
    const [, step, value] = payload.split(":");
    const session = app.store.session(user.id);
    if (session.flow !== "calc") return;
    await onCalcPick(ctx, app, step, value, session.data);
    return;
  }
  if (payload.startsWith("form:")) {
    const [, field, value] = payload.split(":");
    const session = app.store.session(user.id);
    if (!forms[session.flow]) return;
    await onFormPick(ctx, app, field, value, session.data, session.flow);
    return;
  }
  if (payload.startsWith("pdf:")) {
    await resendPdf(ctx, app, Number(payload.slice(4)), user.id, user.role !== "user");
    return;
  }
  if (payload === "partner:join") {
    await joinPartner(ctx, app, user);
    return;
  }
  if (payload.startsWith("staff:")) {
    if (payload.startsWith("staff:pub:")) {
      const id = Number(payload.split(":")[2]);
      await reply(ctx, `Объявление №${id} не публикуется из бота. Откройте https://puzzlespace.ru/dashboard и кнопку «Объявления на модерации». У вакансий, резюме, продажи и покупки участка разные группы Max.`, [
        [{ kind: "callback", text: "К объявлениям", payload: "staff:listings" }, { kind: "callback", text: "Закрыть", payload: "nav:close" }],
      ]);
      return;
    }
    if (payload.startsWith("staff:hide:")) {
      const id = Number(payload.split(":")[2]);
      await hideListing(app, id);
      await reply(ctx, `Объявление №${id} скрыто.`, [
        [{ kind: "callback", text: "К объявлениям", payload: "staff:listings" }],
      ]);
      return;
    }
    await onStaff(ctx, app, user, payload);
    return;
  }
  if (payload.startsWith("relay:")) {
    const threadId = Number(payload.split(":")[1]);
    app.store.saveSession(user.id, "relay", "author", { threadId });
    await reply(ctx, "Напишите ответ. Его увидит только этот человек. «Меню» вернёт в начало.");
  }
}

export async function onText(ctx: any, app: App, text: string): Promise<void> {
  const user = await remember(ctx, app);
  if (!user) return;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "/close" || lower === "закрыть" || lower === "закрыть диалог") {
    app.store.clearSession(user.id);
    await reply(ctx, "Диалог закрыт. Напишите «меню», чтобы открыть снова.");
    return;
  }
  if (lower === "/start" || lower === "старт" || lower === "/menu" || lower === "меню" || lower === "menu") {
    app.store.clearSession(user.id);
    if (lower === "старт" || lower === "/menu" || lower === "меню" || lower === "menu") {
      await sendMenu(ctx, app);
      return;
    }
    await openStart(ctx, app, "");
    return;
  }
  if (lower === "/myid" || lower === "мой id") {
    await reply(ctx, `Ваш id: ${user.id}`);
    return;
  }
  const owner = /^(?:\/owner|владелец)\s+(\S+)/i.exec(trimmed);
  if (owner) {
    await claimOwner(ctx, app, user, owner[1]);
    return;
  }
  const session = app.store.session(user.id);
  if (session.flow === "calc") {
    await onCalcText(ctx, app, trimmed, session.data, session.step);
    return;
  }
  if (forms[session.flow]) {
    const phone = phoneOf(ctx.contactInfo);
    await onFormText(ctx, app, trimmed, session.data, session.flow, phone);
    return;
  }
  if (session.flow === "relay") {
    await relayText(ctx, app, user, trimmed, session.data);
    return;
  }
  if (session.flow === "addmgr") {
    await onAddManager(ctx, app, user, trimmed);
    return;
  }
  await reply(ctx, "Напишите «меню», чтобы открыть разделы.");
}

async function runGo(ctx: any, app: App, user: UserRow, action: string): Promise<void> {
  if (action === "calc") return startCalc(ctx, app);
  if (action === "brief" || action === "vacancy" || action === "resume" || action === "sell" || action === "buy") {
    return startForm(ctx, app, action);
  }
  if (action === "about") return showAbout(ctx);
  if (action === "contacts") return showContacts(ctx);
  if (action === "cabinet") return showCabinet(ctx, app, app.store.user(user.id) ?? user);
  if (action === "partner") return showPartner(ctx, app, app.store.user(user.id) ?? user);
}

async function goBack(ctx: any, app: App, user: UserRow): Promise<void> {
  const session = app.store.session(user.id);
  if (session.flow === "calc") {
    await backCalc(ctx, app, session.data);
    return;
  }
  if (forms[session.flow]) {
    await backForm(ctx, app, session.data, session.flow);
    return;
  }
  await sendMenu(ctx, app);
}

async function claimOwner(ctx: any, app: App, user: UserRow, code: string): Promise<void> {
  if (!app.config.ownerCode || code !== app.config.ownerCode) {
    await reply(ctx, "Код владельца не подошёл.");
    return;
  }
  app.store.setRole(user.id, "owner");
  await reply(ctx, "Вы владелец. Личный кабинет открывает панель управления.");
}

async function openLot(ctx: any, app: App, id: number, user: UserRow): Promise<void> {
  const row = app.store.listing(id);
  if (!row || row.status === "hidden") {
    await reply(ctx, "Объявление не найдено или снято.", [[{ kind: "callback", text: "В меню", payload: "nav:menu" }]]);
    return;
  }
  const body = JSON.parse(String(row.body_json)) as Record<string, string>;
  if (Number(row.user_id) === user.id) {
    await reply(ctx, `Это ваше объявление.\n\n${publicListingText({ title: String(row.title), body, hashtags: String(row.hashtags) })}`, [
      [{ kind: "callback", text: "В меню", payload: "nav:menu" }],
    ]);
    return;
  }
  const threadId = app.store.openThread(id, user.id);
  app.store.saveSession(user.id, "relay", "seeker", { threadId, listingId: id });
  await reply(ctx, `${publicListingText({ title: String(row.title), body, hashtags: String(row.hashtags) })}\n\nНапишите сообщение автору. Номер телефона из объявления не передаётся. Не пишите свой номер, если не хотите его показывать.`, [
    [{ kind: "callback", text: "В меню", payload: "nav:menu" }],
  ]);
  void threadId;
}

async function relayText(ctx: any, app: App, user: UserRow, text: string, data: Record<string, unknown>): Promise<void> {
  const thread = app.store.thread(Number(data.threadId));
  if (!thread) {
    await reply(ctx, "Диалог не найден. Откройте объявление по ссылке ещё раз.");
    return;
  }
  const listing = app.store.listing(thread.listing_id);
  const title = String(listing?.title ?? "объявление");
  if (user.id === thread.seeker_id) {
    await app.api.sendMessageToUser(Number(listing?.user_id), `Сообщение по объявлению №${thread.listing_id} «${title}»\nОт: ${user.name || "клиент"}\n\n${text}`, {
      attachments: [{
        type: "inline_keyboard",
        payload: { buttons: [[{ type: "callback", text: "Ответить", payload: `relay:${thread.id}` }]] },
      }],
    }).catch(() => undefined);
    await reply(ctx, "Передал автору. Можете написать ещё или вернуться в меню.");
    return;
  }
  await app.api.sendMessageToUser(thread.seeker_id, `Ответ автора по объявлению «${title}»:\n\n${text}`).catch(() => undefined);
  await reply(ctx, "Ответ отправлен. Следующее сообщение тоже уйдёт этому человеку, пока не напишете «меню».");
}

export async function onBotAdded(ctx: any, app: App): Promise<void> {
  const id = Number(ctx.chatId);
  if (!id) return;
  const title = String(ctx.chat?.title ?? "");
  app.store.rememberChat(id, title);
  await notifyStaff(app, `Бот добавлен в чат ${title || "без названия"}.\nID канала: ${id}\n\nЕсли это канал объявлений, впишите его в панели или в CHANNEL_CHAT_ID.\nСсылка на бота: ${botLink(app.username, "menu")}`);
}
