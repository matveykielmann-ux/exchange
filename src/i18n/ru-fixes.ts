/** Russian for strings found untranslated in a full-site scan in Russian (2026-10-15): values built in code, server labels and statuses. */
export const RU_FIXES: Record<string, string> = {
  // Public site
  '07:00–16:00 New York time (America/New_York)': '07:00–16:00 по нью-йоркскому времени (America/New_York)',
  '{n} on {network}': '{network}: {n}',
  'Message support here about {0}': 'Написать в поддержку о заявке {0}',
  'cash collection': 'забор наличных',
  deposit: 'депозит',
  and: 'и',
  'Original English text of the Service Rules.': 'Оригинальный текст Правил сервиса на английском языке.',
  '{browser} on {os}': '{browser}, {os}',
  '{0} unread': 'Непрочитанных: {0}',
  'We list the exchange rate and the payout fee separately, so you can check the math yourself. How the commission is defined is set out in':
    'Мы указываем курс обмена и комиссию за выплату отдельно, чтобы вы могли проверить расчёт. Как определяется комиссия, описано в',
  'Section 6 of the Service Rules': 'разделе 6 Правил сервиса',
  'Indicative. Refreshes every {0}s.': 'Ориентировочно. Обновляется каждые {0} с.',

  // CRM: users, audit, overview
  '{0} open': 'Открытых: {0}',
  active: 'активен',
  disabled: 'отключён',
  unverified: 'не проверен',
  needs_info: 'нужны данные',
  customer: 'клиент',
  operator: 'оператор',
  system: 'система',
  staff: 'сотрудник',
  support: 'поддержка',
  reviewer: 'проверяющий',
  admin: 'админ',
  owner: 'владелец',

  // CRM: system page
  'Exchange rates': 'Курсы обмена',
  'Deposit addresses and monitoring': 'Адреса депозита и мониторинг',
  'Sanctions and address screening': 'Санкционный скрининг и проверка адресов',
  'Bank payouts (ACH and wire)': 'Банковские выплаты (ACH и wire)',
  'Debit card payouts': 'Выплаты на дебетовую карту',
  'Cash delivery by courier': 'Доставка наличных курьером',
  'Email delivery': 'Отправка писем',
  'Deterministic sandbox implementation. No real funds or data leave this server.':
    'Детерминированная тестовая реализация. Реальные средства и данные не покидают этот сервер.',
  'Disabled by feature flag.': 'Отключено флагом функции.',
  'Credentials present, but REAL_MONEY_ENABLED is false in src/config/runtime.ts.':
    'Учётные данные заданы, но REAL_MONEY_ENABLED = false в src/config/runtime.ts.',
  'SESSION_SECRET is not set; using an insecure sandbox default.': 'SESSION_SECRET не задан: используется небезопасное тестовое значение.',
  'DATA_ENCRYPTION_KEY is not set; using an insecure sandbox default key.':
    'DATA_ENCRYPTION_KEY не задан: используется небезопасный тестовый ключ.',
  'TRUST_PROXY is off: client IPs for rate limiting will be the reverse proxy address.':
    'TRUST_PROXY выключен: для ограничения частоты запросов IP клиентов будет адресом обратного прокси.',
  processed: 'обработан',
  duplicate: 'дубликат',
  received: 'получен',
  failed: 'ошибка',
  sandbox_captured: 'сохранено в песочнице',
};

/** Russian plural: 1 сеть, 2–4 сети, 5+ сетей. */
export function ruPlural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
