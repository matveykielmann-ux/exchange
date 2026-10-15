/**
 * Russian interface dictionary: English source text → Russian. Keys must
 * match the English strings passed to `t()` exactly. Split by area; later
 * parts win on the rare key that two areas share.
 */
import { RU_ADMIN } from './ru-admin';
import { RU_CRM } from './ru-crm';
import { RU_DOMAIN } from './ru-domain';
import { RU_FIXES, ruPlural } from './ru-fixes';
import { RU_KYC } from './ru-kyc';
import { RU_PUBLIC } from './ru-public';
import { RU_PUBLIC2 } from './ru-public2';
import { RU_PUBLIC3 } from './ru-public3';
import { RU_WIRE } from './ru-wire';

export const RU: Record<string, string> = {
  ...RU_KYC,
  ...RU_ADMIN,
  ...RU_PUBLIC,
  ...RU_PUBLIC2,
  ...RU_PUBLIC3,
  ...RU_WIRE,
  ...RU_DOMAIN,
  ...RU_CRM,
  ...RU_FIXES,
  // Names of server components that appear inside error messages.
  'Sanctions screening': 'Санкционный скрининг',
  'Identity verification': 'Проверка личности',
  'Deposit address provider': 'Провайдер адресов депозита',
  'Crypto custody provider': 'Кастодиальный провайдер',
  'Cash collection provider': 'Провайдер забора наличных',
  'Exchange-rate provider': 'Провайдер курсов',
  'Document storage': 'Хранилище документов',
  'Card tokenization (hosted card form)': 'Токенизация карт (форма провайдера)',
  'Bank payout provider': 'Провайдер банковских выплат',
  'Cash delivery': 'Доставка наличных',
  'not configured': 'не настроен',
  'disabled by policy': 'отключён политикой',
  sandbox: 'тестовый',
};

type Tr = (s: string) => string;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Server and domain texts with values inside. Each pattern matches the whole string. */
export const RU_PATTERNS: [RegExp, (g: string[], tr: Tr) => string][] = [
  [/^(\$[\d,.]+) flat$/, ([a]) => `${a} фиксированно`],
  [
    /^(\$[\d,.]+) flat \(provisional — pending confirmation\)$/,
    ([a]) => `${a} фиксированно (предварительно — ожидает подтверждения)`,
  ],
  [/^([\d.]+%) \(min (\$[\d,.]+), max (\$[\d,.]+)\)$/, ([p, a, b]) => `${p} (мин. ${a}, макс. ${b})`],
  [/^(\d+) networks?$/, ([n]) => `${n} ${ruPlural(Number(n), 'сеть', 'сети', 'сетей')}`],
  [/^Confirmations \((\d+) of (\d+)\)$/, ([a, b]) => `Подтверждения (${a} из ${b})`],
  [/^Order (\d{6,})$/, ([r]) => `Заявка ${r}`],
  [/^clause ([\d.]+)$/, ([c]) => `п. ${c}`],
  [/^(\d+) of (\d+) network confirmations\.$/, ([a, b]) => `${a} из ${b} подтверждений сети.`],
  [/^A deposit needs (\d+) confirmations to be final\.$/, ([n]) => `Для окончательного подтверждения депозиту нужно ${n} подтверждений.`],
  [/^Amount at or above the manual review threshold \((.+)\)\.$/, ([a]) => `Сумма не меньше порога ручной проверки (${a}).`],
  [/^Refund address screening: (.+)$/, ([n]) => `Скрининг адреса возврата: ${n}`],
  [/^Flagged for review: (.+)$/, ([r], tr) => `Отмечено для проверки: ${tr(r!)}`],
  [/^Enter (.+)\.$/, ([label], tr) => `Введите ${tr(label!)}.`],
  [/^(.+) must be at least (\d+) characters\.$/, ([l, n], tr) => `${cap(tr(l!))}: не менее ${n} символов.`],
  [/^(.+) must be at most (\d+) characters\.$/, ([l, n], tr) => `${cap(tr(l!))}: не более ${n} символов.`],
  [/^(.+) is not in the expected format\.$/, ([l], tr) => `${cap(tr(l!))}: неверный формат.`],
  [/^(.+) must be one of (.+)\.$/, ([l, v], tr) => `${cap(tr(l!))}: допустимые значения — ${v}.`],
  [/^(.+) must be text\.$/, ([l], tr) => `${cap(tr(l!))}: ожидается текст.`],
  [/^Requires at least (.+)\.$/, ([a]) => `Нужно не менее ${a}.`],
  [/^Review and accept: (.+)\.$/, ([d]) => `Ознакомьтесь и примите: ${d}.`],
  [/^That destination can't receive (.+) payouts\.$/, ([m], tr) => `Эти реквизиты не принимают выплаты способом «${tr(m!)}».`],
  [
    /^Payouts can be authorized only when an order is ready for payout \(it is (.+)\)\.$/,
    ([s]) => `Выплату можно авторизовать, только когда заявка готова к выплате (сейчас: ${s}).`,
  ],
  [/^This order is now (.+)\. Reload and try again\.$/, ([s]) => `Статус заявки изменился (${s}). Обновите страницу и повторите.`],
  [
    /^(.+) is not configured on this server, so this operation cannot run\.$/,
    ([w], tr) => `${cap(tr(w!))}: не настроено на этом сервере, операция невозможна.`,
  ],
  [/^(.+) payout provider$/, ([m], tr) => `Платёжный провайдер (${tr(m!)})`],
  [/^Payout provider is (.+)\.$/, ([s], tr) => `Платёжный провайдер: ${tr(s!)}.`],
  [
    /^An order can have at most (\d+) uploads\. Contact support if you need to replace one\.$/,
    ([n]) => `К заявке можно загрузить не более ${n} файлов. Чтобы заменить файл, напишите в поддержку.`,
  ],
  [/^Enter the (.+) wallet address that receives your (.+)\.$/, ([n, a]) => `Введите адрес кошелька в сети ${n}, на который придут ${a}.`],
  [
    /^That doesn't look like a (.+) address \(expected (.+)\)\.$/,
    ([n, e], tr) => `Это не похоже на адрес сети ${n} (ожидается: ${tr(e!)}).`,
  ],
  [
    /^That doesn't look like a transaction hash on (.+) \(expected (.+)\)\.$/,
    ([n, e], tr) => `Это не похоже на хеш транзакции в сети ${n} (ожидается: ${tr(e!)}).`,
  ],
  [/^Enter a (.+) address for refunds\.$/, ([n]) => `Введите адрес в сети ${n} для возврата.`],
  [/^Enter the (.+) address of a wallet you control\.$/, ([n]) => `Введите адрес своего кошелька в сети ${n}.`],
  [/^Enter an amount of (.+)\.$/, ([a]) => `Введите сумму в ${a}.`],
  [/^(.+) amounts can have at most (\d+) decimal places\.$/, ([a, n]) => `Для ${a} допускается не более ${n} знаков после точки.`],
  [/^Choose a date within the next (\d+) days\.$/, ([n]) => `Выберите дату в ближайшие ${n} дней.`],
  [
    /^Confirmations apply only after a deposit is observed \(order is (.+)\)\.$/,
    ([s]) => `Подтверждения применяются только после того, как депозит замечен (статус: ${s}).`,
  ],
  [
    /^No payout has been submitted to the provider for this order \(it is (.+)\)\. Authorize the payout first\.$/,
    ([s]) => `По этой заявке выплата провайдеру не отправлялась (статус: ${s}). Сначала авторизуйте выплату.`,
  ],
  [
    /^Review quotes last (\d+) seconds\. (.+)$/,
    ([n]) =>
      `Котировка на шаге проверки действует ${n} секунд. Получите новую на этом шаге. Пока вы не подтвердили, ничего не отправляется.`,
  ],
];
