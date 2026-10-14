import type { AppConfig } from "../config.js";
import type { Store } from "../db.js";
import { hashtag, parseMoney } from "../format.js";
import { callback, grid, navRow, reply, type Btn } from "./ui.js";
import { publicListingText } from "../channel.js";
import { queuePortalListing } from "../portalQueue.js";

type App = { store: Store; config: AppConfig; api: any; username: string };

type Field = {
  id: string;
  prompt: string;
  kind: "text" | "choice" | "phone";
  optional?: boolean;
  options?: Array<{ id: string; label: string }>;
};

const taskOptions = [
  { id: "tech", label: "Подбор технологии и проекта" },
  { id: "land_house", label: "Участок + дом" },
  { id: "audit", label: "Аудит сметы" },
  { id: "supervision", label: "Технадзор стройки" },
  { id: "legal", label: "Ипотека и регистрация" },
  { id: "other", label: "Другое" },
];

const scheduleOptions = [
  { id: "full", label: "Полная занятость" },
  { id: "part", label: "Частичная" },
  { id: "shift", label: "Вахта" },
  { id: "contract", label: "Подряд" },
];

export const forms: Record<string, { title: string; fields: Field[] }> = {
  brief: {
    title: "Заказать смету",
    fields: [
      { id: "name", prompt: "Как к вам обращаться?", kind: "text" },
      { id: "phone", prompt: "Телефон для связи. Можно нажать кнопку и отправить номер из MAX или написать его текстом.", kind: "phone" },
      { id: "city", prompt: "Город или район, где участок или дом.", kind: "text" },
      { id: "task", prompt: "Что нужно сделать?", kind: "choice", options: taskOptions },
      { id: "area", prompt: "Примерная площадь дома в м². Если неизвестна, нажмите «Пропустить».", kind: "text", optional: true },
      { id: "budget", prompt: "Бюджет. Напишите сумму в рублях, можно примерно.", kind: "text" },
      { id: "timing", prompt: "Когда планируете начать?", kind: "text" },
      { id: "comment", prompt: "Комментарий: участок, технология, что уже есть на руках. Если нечего добавить, напишите «нет».", kind: "text", optional: true },
    ],
  },
  vacancy: {
    title: "Разместить вакансию",
    fields: [
      { id: "title", prompt: "Должность.", kind: "text" },
      { id: "city", prompt: "Город.", kind: "text" },
      { id: "salary", prompt: "Зарплата или вилка.", kind: "text" },
      { id: "schedule", prompt: "Занятость.", kind: "choice", options: scheduleOptions },
      { id: "description", prompt: "Описание: обязанности, требования, условия.", kind: "text" },
      { id: "phone", prompt: "Телефон сохранится только в панели управления и в канал не попадёт. Можно пропустить.", kind: "phone", optional: true },
    ],
  },
  resume: {
    title: "Разместить резюме",
    fields: [
      { id: "title", prompt: "Желаемая должность.", kind: "text" },
      { id: "city", prompt: "Город.", kind: "text" },
      { id: "experience", prompt: "Опыт: сколько лет и в чём.", kind: "text" },
      { id: "salary", prompt: "Ожидаемый доход.", kind: "text" },
      { id: "description", prompt: "Коротко о себе.", kind: "text" },
      { id: "phone", prompt: "Телефон только для панели управления, в канал не публикуется. Можно пропустить.", kind: "phone", optional: true },
    ],
  },
  sell: {
    title: "Продать участок",
    fields: [
      { id: "locality", prompt: "Населённый пункт и район.", kind: "text" },
      { id: "sotki", prompt: "Площадь в сотках.", kind: "text" },
      { id: "price", prompt: "Цена в рублях.", kind: "text" },
      { id: "vri", prompt: "ВРИ или категория земель. Если не знаете, напишите «уточняется».", kind: "text" },
      { id: "communications", prompt: "Коммуникации: что есть на участке или по границе.", kind: "text" },
      { id: "description", prompt: "Описание: рельеф, подъезд, обременения, что важно покупателю.", kind: "text" },
      { id: "phone", prompt: "Телефон только для панели. В канале его не будет: заинтересованные напишут вам через бота. Можно пропустить.", kind: "phone", optional: true },
    ],
  },
  buy: {
    title: "Купить участок",
    fields: [
      { id: "region", prompt: "Где ищете участок?", kind: "text" },
      { id: "budget", prompt: "Бюджет в рублях.", kind: "text" },
      { id: "sotki", prompt: "Желаемая площадь, например 8–12 соток.", kind: "text" },
      { id: "requirements", prompt: "Требования: ВРИ, коммуникации, расстояние до моря, подъезда.", kind: "text" },
      { id: "phone", prompt: "Телефон только для панели, в канал не публикуется. Можно пропустить.", kind: "phone", optional: true },
    ],
  },
};

const kindAlias: Record<string, string> = {
  brief: "brief",
  vacancy: "vacancy",
  resume: "resume",
  sell: "sell",
  buy: "buy",
};

export function formKind(flow: string): string {
  return kindAlias[flow] ?? flow;
}

export async function startForm(ctx: any, app: App, flow: string): Promise<void> {
  const form = forms[flow];
  if (!form) return;
  const data = { answers: {}, index: 0 };
  app.store.saveSession(ctx.user.user_id, flow, "0", data);
  await showField(ctx, app, flow, data);
}

async function showField(ctx: any, app: App, flow: string, data: Record<string, unknown>): Promise<void> {
  const form = forms[flow];
  const index = Number(data.index ?? 0);
  const field = form.fields[index];
  if (!field) {
    await showReview(ctx, app, flow, data);
    return;
  }
  app.store.saveSession(ctx.user.user_id, flow, String(index), data);
  const rows: Btn[][] = [];
  if (field.kind === "choice" && field.options) {
    rows.push(...grid(field.options.map((option) => callback(option.label, `form:${field.id}:${option.id}`)), 1));
  }
  if (field.kind === "phone") {
    rows.push([{ kind: "contact", text: "Отправить мой номер" }]);
  }
  if (field.optional) rows.push([callback("Пропустить", `form:${field.id}:skip`)]);
  rows.push(navRow(index > 0));
  await reply(ctx, `**${form.title}**\n\n${field.prompt}`, rows);
}

async function showReview(ctx: any, app: App, flow: string, data: Record<string, unknown>): Promise<void> {
  app.store.saveSession(ctx.user.user_id, flow, "review", data);
  const answers = (data.answers ?? {}) as Record<string, string>;
  const preview = flow === "brief" ? briefText(answers) : publicListingText(draftListing(flow, answers, ctx));
  await reply(ctx, `${preview}\n\nОтправить?`, [
    [callback("Отправить", "form:review:ok", "positive")],
    navRow(true),
  ]);
}

export async function onFormPick(ctx: any, app: App, fieldId: string, value: string, data: Record<string, unknown>, flow: string): Promise<void> {
  const form = forms[flow];
  const index = Number(data.index ?? 0);
  if (fieldId === "review" && value === "ok") {
    await submitForm(ctx, app, flow, data);
    return;
  }
  const field = form.fields[index];
  if (!field || field.id !== fieldId) {
    await reply(ctx, "Это кнопка прошлого шага. Продолжайте с последнего сообщения.");
    return;
  }
  const answers = { ...((data.answers ?? {}) as Record<string, string>) };
  if (value !== "skip") {
    const option = field.options?.find((item) => item.id === value);
    answers[field.id] = option?.label ?? value;
  }
  data.answers = answers;
  data.index = index + 1;
  await showField(ctx, app, flow, data);
}

export async function onFormText(ctx: any, app: App, text: string, data: Record<string, unknown>, flow: string, phone = ""): Promise<void> {
  const form = forms[flow];
  const index = Number(data.index ?? 0);
  const field = form.fields[index];
  if (!field || field.kind === "choice") {
    await reply(ctx, "Выберите вариант кнопкой.");
    return;
  }
  const answers = { ...((data.answers ?? {}) as Record<string, string>) };
  const value = phone || text.trim();
  if (!value) {
    await reply(ctx, "Напишите ответ или нажмите «Пропустить».");
    return;
  }
  if (field.kind === "phone") answers.phone = value;
  else answers[field.id] = value;
  if (field.id === "name") {
    /* keep */
  }
  data.answers = answers;
  data.index = index + 1;
  await showField(ctx, app, flow, data);
}

export async function backForm(ctx: any, app: App, data: Record<string, unknown>, flow: string): Promise<void> {
  if (app.store.session(ctx.user.user_id).step === "review") {
    data.index = forms[flow].fields.length - 1;
  } else {
    data.index = Math.max(0, Number(data.index ?? 0) - 1);
  }
  await showField(ctx, app, flow, data);
}

async function submitForm(ctx: any, app: App, flow: string, data: Record<string, unknown>): Promise<void> {
  const answers = { ...((data.answers ?? {}) as Record<string, string>) };
  const userId = ctx.user.user_id as number;
  if (answers.phone) app.store.setPhone(userId, answers.phone);
  app.store.clearSession(userId);
  if (flow === "brief") {
    const budget = parseMoney(answers.budget ?? "");
    const id = app.store.saveBrief(userId, answers, budget);
    const base = budget > 0 ? budget : app.store.latestCalculationTotal(userId);
    const commission = app.store.recordOrder(userId, `brief:${id}`, base);
    await reply(ctx, `Заявка №${id} отправлена. Она уже в панели управления. Евгений или менеджер свяжется с вами.`, [
      [callback("В меню", "nav:menu")],
    ]);
    await notifyStaff(app, `Новая заявка на смету №${id}\n${briefText(answers)}`);
    const user = app.store.user(userId);
    if (user?.referrer_id && commission >= 0) {
      const referrer = app.store.user(user.referrer_id);
      if (referrer) {
        await app.api.sendMessageToUser(referrer.id, `По вашей ссылке заказали смету №${id}. Начисленная комиссия: ${commission.toLocaleString("ru-RU")} ₽.`, { format: "markdown" }).catch(() => undefined);
      }
    }
    return;
  }
  const draft = draftListing(flow, answers, ctx);
  const id = app.store.saveListing({
    userId,
    kind: flow,
    title: draft.title,
    body: draft.body,
    phone: answers.phone ?? "",
    hashtags: draft.hashtags,
  });
  const queued = await queuePortalListing({
    kind: flow,
    title: draft.title,
    body: { ...draft.body, _bot_listing_id: String(id) },
    author_name: String(ctx.user?.name || ""),
    phone: answers.phone ?? "",
  });
  await reply(ctx, `Объявление №${id} отправлено на модерацию. В группы Max, Telegram и Дзен оно попадёт только после разрешения администратора. Телефон в пост не попадёт.\n${queued}`, [
    [callback("В меню", "nav:menu"), callback("Закрыть", "nav:close", "negative")],
  ]);
  await notifyStaff(app, `Новое объявление №${id}: ${draft.title}\nЖдёт разрешения на https://puzzlespace.ru/dashboard — кнопка «Объявления на модерации». Публикуйте в отдельную группу Max для этого типа.`);
}

function briefText(answers: Record<string, string>): string {
  const rows = [
    ["Имя", answers.name],
    ["Телефон", answers.phone],
    ["Город", answers.city],
    ["Задача", answers.task],
    ["Площадь", answers.area],
    ["Бюджет", answers.budget],
    ["Срок", answers.timing],
    ["Комментарий", answers.comment],
  ];
  return ["**Бриф на смету**", "", ...rows.filter((row) => row[1]).map((row) => `${row[0]}: ${row[1]}`)].join("\n");
}

function draftListing(flow: string, answers: Record<string, string>, ctx: any): { title: string; body: Record<string, string>; hashtags: string } {
  const name = String(ctx.user?.name || "");
  if (flow === "vacancy") {
    return {
      title: `Вакансия: ${answers.title}`,
      body: { Должность: answers.title, Город: answers.city, Зарплата: answers.salary, Занятость: answers.schedule, Описание: answers.description, Автор: name },
      hashtags: ["#вакансия", "#работа", hashtag(answers.city)].filter(Boolean).join(" "),
    };
  }
  if (flow === "resume") {
    return {
      title: `Резюме: ${answers.title}`,
      body: { Должность: answers.title, Город: answers.city, Опыт: answers.experience, Доход: answers.salary, "О себе": answers.description, Автор: name },
      hashtags: ["#резюме", hashtag(answers.city)].filter(Boolean).join(" "),
    };
  }
  if (flow === "sell") {
    return {
      title: `Участок ${answers.sotki} сот., ${answers.locality}`,
      body: { "Населённый пункт": answers.locality, Площадь: `${answers.sotki} сот.`, Цена: answers.price, ВРИ: answers.vri, Коммуникации: answers.communications, Описание: answers.description, Автор: name },
      hashtags: ["#продатьучасток", "#участок", hashtag(answers.locality)].filter(Boolean).join(" "),
    };
  }
  return {
    title: `Ищу участок: ${answers.region}`,
    body: { Регион: answers.region, Бюджет: answers.budget, Площадь: answers.sotki, Требования: answers.requirements, Автор: name },
    hashtags: ["#купитьучасток", "#участок", hashtag(answers.region)].filter(Boolean).join(" "),
  };
}

export async function notifyStaff(app: App, text: string): Promise<void> {
  const staff = app.store.users(500).filter((user) => user.role === "owner" || user.role === "manager");
  const link = app.config.publicAdminUrl ? `\n\nПанель: ${app.config.publicAdminUrl}` : "\n\nЗаявка также видна в личном кабинете бота и в веб-панели на сервере.";
  for (const user of staff) {
    await app.api.sendMessageToUser(user.id, text + link).catch(() => undefined);
  }
}
