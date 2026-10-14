/**
 * Customer notifications in Russian. The server stores each notice in English
 * with the template name and the values it was built from; this rebuilds the
 * text in the selected language from the same values. English uses the stored
 * text as is.
 */
import type { Notification } from '@/services/types';
import { getLang, t } from './index';

type Vars = Record<string, string | undefined>;
type Text = { subject: string; body: string };

const date = (iso: string | undefined) => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(ms) ? (iso ?? '') : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(ms);
};

const RU_TEMPLATES: Record<string, (v: Vars) => Text> = {
  welcome: (v) => ({
    subject: 'Добро пожаловать в CryptoBit Exchange',
    body: `${v.name ?? ''}, ваш аккаунт создан. Перед первым обменом подтвердите личность на странице аккаунта.`,
  }),
  order_created: (v) => ({
    subject: `Заявка ${v.reference}: отправьте депозит`,
    body: `Мы создали заявку ${v.reference}. Отправьте ровно ${v.amount} в сети ${v.network} до ${date(v.deadline)}. Сверяйте адрес депозита на странице заявки; никогда не отправляйте средства на адрес из письма.`,
  }),
  buy_order_created: (v) => ({
    subject: `Заявка ${v.reference}: запрошен забор наличных`,
    body: `Мы создали заявку ${v.reference} и попросили курьера забрать ${v.cash} наличными до ${date(v.deadline)}. Курьер принимает наличные только у вас после проверки документа. Следите за заявкой на её странице.`,
  }),
  buy_transfer_submitted: (v) => ({
    subject: `Заявка ${v.reference}: перевод криптовалюты отправлен`,
    body: `Ваш перевод ${v.amount} по заявке ${v.reference} передан кастодиальному провайдеру. Сроки ориентировочные и не гарантируются.`,
  }),
  buy_completed: (v) => ({
    subject: `Заявка ${v.reference}: выполнена`,
    body: `Кастодиальный провайдер сообщает, что перевод ${v.amount} по заявке ${v.reference} выполнен.`,
  }),
  buy_cash_verified: (v) => ({
    subject: `Заявка ${v.reference}: наличные пересчитаны`,
    body: `Наличные по заявке ${v.reference} пересчитаны и совпадают с котировкой. Мы сообщим, когда перевод криптовалюты будет отправлен.`,
  }),
  deposit_confirmed: (v) => ({
    subject: `Заявка ${v.reference}: депозит подтверждён`,
    body: `Ваш депозит по заявке ${v.reference} окончательно подтверждён в сети. Мы сообщим, когда выплата будет отправлена.`,
  }),
  info_requested: (v) => ({
    subject: `Заявка ${v.reference}: нужна дополнительная информация`,
    body: `Нам нужна дополнительная информация по заявке ${v.reference}. Откройте сообщения поддержки, чтобы ответить.`,
  }),
  payout_submitted: (v) => ({
    subject: `Заявка ${v.reference}: выплата отправлена`,
    body: `Выплата ${v.amount} по заявке ${v.reference} передана платёжному провайдеру. ${t(v.timing ?? '')}. Сроки ориентировочные и не гарантируются.`,
  }),
  order_completed: (v) => ({
    subject: `Заявка ${v.reference}: выполнена`,
    body: `Платёжный провайдер сообщает, что выплата ${v.amount} по заявке ${v.reference} выполнена.`,
  }),
  order_failed: (v) => ({
    subject: `Заявка ${v.reference}: выплата требует внимания`,
    body: `Выплату по заявке ${v.reference} не удалось выполнить. Наша команда свяжется с вами и расскажет о дальнейших шагах.`,
  }),
  refund_started: (v) => ({
    subject: `Заявка ${v.reference}: возврат начат`,
    body: `Мы начали возврат вашего депозита по заявке ${v.reference} на адрес для возврата. Может быть удержана комиссия за возврат согласно разделу 9 Правил сервиса.`,
  }),
  refund_completed: (v) => ({
    subject: `Заявка ${v.reference}: возврат отправлен`,
    body: `Возврат по заявке ${v.reference} отправлен на ваш адрес для возврата. Транзакция: ${v.txHash}.`,
  }),
  support_reply: (v) => ({
    subject: `Новый ответ: ${v.subject}`,
    body: `Служба поддержки ответила в обращении «${v.subject}». Войдите в аккаунт, чтобы прочитать и ответить.`,
  }),
  verification_updated: (v) => ({
    subject: 'Статус проверки личности обновлён',
    body: `Статус вашей проверки личности: ${t(v.status ?? '')}. Подробности на странице аккаунта.`,
  }),
  status_changed: (v) => ({
    subject: `Заявка ${v.reference}: ${t(v.stage ?? '')}`,
    body: `Статус вашей заявки ${v.reference}: ${t(v.status ?? '')}. ${t(v.detail ?? '')}`,
  }),
  staff_message: (v) => ({
    subject: `Заявка ${v.reference}: сообщение от нашей команды`,
    body: `Наша команда отправила вам сообщение по заявке ${v.reference}. Откройте сообщения поддержки, чтобы прочитать и ответить.`,
  }),
};

export function notificationText(n: Pick<Notification, 'template' | 'subject' | 'body' | 'vars'>): Text {
  if (getLang() === 'en') return { subject: n.subject, body: n.body };
  const tpl = RU_TEMPLATES[n.template];
  return tpl ? tpl(n.vars ?? {}) : { subject: t(n.subject), body: t(n.body) };
}
