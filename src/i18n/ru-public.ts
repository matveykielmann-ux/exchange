/** Russian: public site, part 1 (shared components, header and footer, FAQ, account). */
export const RU_PUBLIC: Record<string, string> = {
  // Users page (admin, continued)
  'New role': 'Новая роль',
  'Disable account': 'Отключить аккаунт',
  'Enable account': 'Включить аккаунт',
  'Customer emails are masked. Staff accounts need two-step sign-in in production.':
    'Email клиентов частично скрыты. В рабочем режиме аккаунтам сотрудников нужен двухэтапный вход.',
  'Email, name or user id': 'Email, имя или ID пользователя',
  Role: 'Роль',
  'Any role': 'Любая роль',
  Users: 'Пользователи',
  User: 'Пользователь',
  '2-step': '2FA',
  On: 'Вкл.',
  Off: 'Выкл.',

  // Accepted banner
  'Request accepted': 'Заявка принята',
  '. Follow its status in your account. To reach a manager, use Telegram or the messages on this site.':
    '. Следите за статусом в личном кабинете. Для связи с менеджером используйте Telegram или сообщения на сайте.',
  'Contact us on Telegram': 'Связаться в Telegram',
  '(opens in a new tab)': '(откроется в новой вкладке)',
  'Open the order': 'Открыть заявку',
  'Go to your account': 'Перейти в личный кабинет',

  // Bank form
  "Sandbox: don't enter real bank details": 'Тест: не вводите настоящие банковские реквизиты',
  'Use a test routing number such as': 'Используйте тестовый routing number, например',
  'and any account number of 4 to 17 digits.': 'и любой номер счёта из 4–17 цифр.',
  'The account must be a US checking or savings account in your name. Numbers are encrypted when saved and shown back only as the last four digits.':
    'Счёт должен быть текущим или сберегательным счётом в банке США на ваше имя. Номера шифруются при сохранении и показываются только последними четырьмя цифрами.',
  Nickname: 'Название',
  'Optional, e.g. Checking': 'Необязательно, например «Основной»',
  'Account type': 'Тип счёта',
  Checking: 'Текущий',
  Savings: 'Сберегательный',
  'Routing number': 'Routing number',
  'Account number': 'Номер счёта',
  'Save bank account': 'Сохранить банковский счёт',

  // Courier form
  'Cash delivery is not available yet: no courier carrier is connected.':
    'Доставка наличных пока недоступна: курьерская служба не подключена.',
  "Sandbox: don't enter your real address": 'Тест: не вводите свой настоящий адрес',
  'Any US address works. ZIP codes starting with': 'Подойдёт любой адрес в США. Индексы, начинающиеся с',
  "are outside the sandbox courier's area.": ', вне зоны тестового курьера.',
  'Cash is handed only to': 'Наличные передаются только',
  'the account holder': 'владельцу аккаунта',
  ', after a check of a government-issued photo ID that matches your verified account. Details are encrypted when saved and shared only with the courier.':
    ' после проверки государственного документа с фото, совпадающего с подтверждённым аккаунтом. Данные шифруются при сохранении и передаются только курьеру.',
  'Street address': 'Улица и дом',
  'Apartment, suite or unit': 'Квартира, офис',
  City: 'Город',
  'Choose a state': 'Выберите штат',
  'ZIP code': 'Почтовый индекс (ZIP)',
  'Phone for the courier': 'Телефон для курьера',
  'Collection window': 'Время забора',
  'Delivery window': 'Время доставки',
  'Preferred date': 'Желаемая дата',
  'Optional. Leave empty for the first available day.': 'Необязательно. Оставьте пустым — выберем ближайший доступный день.',
  'Instructions for the courier': 'Инструкции для курьера',
  "Optional, e.g. a gate code or where to park. Don't include passwords or account details.":
    'Необязательно, например код домофона или где припарковаться. Не указывайте пароли и данные счетов.',
  'The date and window are a preference. The courier confirms the': 'Дата и время — пожелание. Курьер согласует',
  'time with you by phone.': 'время с вами по телефону.',
  'Checking the area…': 'Проверяем зону доставки…',
  'Save {0} address': 'Сохранить адрес ({0})',
  collection: 'забора',
  delivery: 'доставки',

  // Boot error
  "We can't reach": 'Не удаётся связаться с',
  'right now': 'прямо сейчас',
  'Nothing has changed with any request you made. Reload the page in a moment.':
    'Ваши запросы не изменились. Перезагрузите страницу чуть позже.',
  Reload: 'Перезагрузить',

  // Calculator and inputs
  'Sell crypto for USD': 'Продать криптовалюту за USD',
  'Sandbox pricing': 'Тестовые цены',
  'Receive by': 'Способ получения',
  'Enter an amount to see a full breakdown.': 'Введите сумму, чтобы увидеть полный расчёт.',
  Continue: 'Продолжить',
  'Indicative. Refreshes every': 'Ориентировочно. Обновляется каждые',
  'Price as of': 'Цена на',
  '{0} — not offered': '{0} — недоступно',
  Asset: 'Актив',
  Network: 'Сеть',
  'Must match the network your wallet sends on.': 'Должна совпадать с сетью, из которой отправляет ваш кошелёк.',
  '{0} is accepted on the {1} network only.': '{0} принимается только в сети {1}.',
  'Amount to sell': 'Сумма продажи',
  'Minimum is {0}': 'Минимум {0}',
  'That is about': 'Это примерно',
  'at the current mock price.': 'по текущей тестовой цене.',
  'Payout method not available for this amount': 'Способ выплаты недоступен для этой суммы',
  '. Choose a different payout method.': '. Выберите другой способ выплаты.',
  'Fees would exceed the value of this amount.': 'Комиссии превысили бы стоимость этой суммы.',
  "That network isn't supported for this asset.": 'Эта сеть не поддерживается для этого актива.',
  '{0} confirmations required': 'Нужно подтверждений: {0}',
  'About {0}': 'Подробнее: {0}',

  // KYC notice
  'Identity verification is not available yet: the provider is not connected.':
    'Проверка личности пока недоступна: провайдер не подключён.',
  'Sandbox: verification is decided by test rules. A name containing “Review” needs more information, “Reject” is rejected, and any other name is approved.':
    'Тест: результат проверки определяется тестовыми правилами. Имя с «Review» требует дополнительной информации, с «Reject» — отклоняется, любое другое — одобряется.',
  'Starting…': 'Запуск…',
  'Verify my identity': 'Подтвердить личность',
  'Open support messages': 'Открыть сообщения поддержки',
  'Verify your identity to confirm': 'Подтвердите личность, чтобы продолжить',
  'Identity verification is required before an exchange (Service Rules, Section 8). It takes a few minutes. Additional documents may be requested for a transaction classified as high-risk.':
    'Перед обменом нужна проверка личности (Правила сервиса, раздел 8). Она занимает несколько минут. Для операций с высоким риском могут запросить дополнительные документы.',
  'Verification in progress': 'Проверка идёт',
  'We will update this page when the result arrives. You can keep this page open.':
    'Мы обновим страницу, когда придёт результат. Можно не закрывать её.',
  'We need more information': 'Нужна дополнительная информация',
  'Our team will contact you in your support messages. You can confirm the exchange once verification is complete.':
    'Наша команда свяжется с вами в сообщениях поддержки. Подтвердить обмен можно будет после завершения проверки.',
  'We can’t verify your identity': 'Мы не можем подтвердить вашу личность',
  'We can’t offer exchanges on this account. Contact support if you think this is a mistake.':
    'Обмены для этого аккаунта недоступны. Если считаете это ошибкой, напишите в поддержку.',

  // Header, footer
  'Sandbox notice': 'Уведомление о тестовой среде',
  'Sandbox.': 'Тестовая среда.',
  'Prices, deposits, verification and payouts are simulated. No real funds move.':
    'Цены, депозиты, проверка и выплаты имитируются. Реальные деньги не перемещаются.',
  'About the sandbox': 'О тестовой среде',
  'Service notice': 'Уведомление сервиса',
  'Not yet accepting exchanges.': 'Обмены пока не принимаются.',
  'Payment and verification providers are still being set up.': 'Платёжные провайдеры и провайдеры проверки ещё подключаются.',
  'Contact us': 'Связаться с нами',
  'Notifications, {0} unread': 'Уведомления, непрочитанных: {0}',
  Primary: 'Основная навигация',
  'Sign in': 'Войти',
  'Start an exchange': 'Начать обмен',
  Menu: 'Меню',
  Mobile: 'Мобильное меню',
  'Support messages': 'Сообщения поддержки',
  'Admin workspace': 'Рабочее место администратора',
  'Sell crypto for US dollars, or buy crypto with cash. This is the sandbox: every price, deposit and payout is simulated.':
    'Продайте криптовалюту за доллары США или купите её за наличные. Это тестовая среда: все цены, депозиты и выплаты имитируются.',
  'Sell crypto for US dollars, or buy crypto with cash collected by courier.':
    'Продайте криптовалюту за доллары США или купите её за наличные, которые заберёт курьер.',
  'Support:': 'Поддержка:',
  Product: 'Сервис',
  'Sell crypto': 'Продать криптовалюту',
  'Buy crypto with cash': 'Купить криптовалюту за наличные',
  'Cash delivery': 'Доставка наличных',
  Fees: 'Комиссии',
  Learn: 'Информация',
  'How it works': 'Как это работает',
  Security: 'Безопасность',
  Help: 'Помощь',
  'Help and support': 'Помощь и поддержка',
  Legal: 'Документы',
  'All legal documents': 'Все юридические документы',
  'CryptoBit Exchange, a company incorporated under the laws of the Republic of Panama, registration number No. 155778934, operating under the brand':
    'CryptoBit Exchange — компания, зарегистрированная по законам Республики Панама, регистрационный номер № 155778934, работающая под брендом',
  '. It is not a bank. Every Exchange Request is governed by the': '. Компания не является банком. Каждая заявка на обмен регулируется',
  'Service Rules': 'Правилами сервиса',
  ' This is the sandbox: its prices and exchange conditions are simulated and are not an offer to buy or sell any asset.':
    ' Это тестовая среда: цены и условия обмена имитируются и не являются предложением купить или продать какой-либо актив.',
  'Crypto assets are not legal tender, are not FDIC or SIPC insured, and can lose value. Blockchain transactions generally cannot be reversed.':
    'Криптоактивы не являются законным платёжным средством, не застрахованы FDIC или SIPC и могут терять в цене. Транзакции в блокчейне, как правило, необратимы.',
  'Service Rules (public offer)': 'Правила сервиса (публичная оферта)',
  'Privacy Policy': 'Политика конфиденциальности',
  'AML/KYC Notice': 'Уведомление AML/KYC',
  'Risk Disclosure': 'Раскрытие рисков',
  'Fees and exchange rates': 'Комиссии и курсы обмена',
  'Cancellations and refunds': 'Отмены и возвраты',
  'Contact and notices': 'Контакты и уведомления',
  'Service Rules, {0}': 'Правила сервиса, {0}',
  'Service Rules,': 'Правила сервиса,',
  Language: 'Язык',

  // Notifications
  'Unread:': 'Не прочитано:',
  'Open order': 'Открыть заявку',
  'Mark as read': 'Отметить прочитанным',
  'Mark all as read': 'Отметить все прочитанными',
  '{0} unread': 'непрочитанных: {0}',
  'No notifications yet.': 'Уведомлений пока нет.',

  // Price tape
  'Updates every {0}s': 'Обновление каждые {0} с',
  'Unchanged since last update': 'Без изменений с прошлого обновления',
  '{0} {1}% since last update': '{0} {1}% с прошлого обновления',
  'Reference prices': 'Справочные цены',
  Loading: 'Загрузка',
  'Sandbox prices': 'Тестовые цены',

  // Quote breakdown
  'You send': 'Вы отправляете',
  'Exchange rate': 'Курс обмена',
  'the exchange rate': 'курс обмена',
  'The rate you get for': 'Курс, по которому вы получаете за',
  'on this quote. Our commission is already included in it; the payout fee below is the only other deduction.':
    'по этой котировке. Наша комиссия уже включена в курс; кроме неё вычитается только комиссия за выплату ниже.',
  Per: 'За 1',
  'Value at this rate': 'Стоимость по этому курсу',
  'the payout fee': 'комиссия за выплату',
  'You receive': 'Вы получаете',
  'Your wallet charges its own': 'Ваш кошелёк берёт собственную комиссию сети',
  'network fee to send. It is not included above.': 'за отправку. Она не входит в расчёт выше.',
  'You pay in cash': 'Вы платите наличными',
  'Handed to the courier after an ID check': 'Передаются курьеру после проверки документа',
  'the courier fee': 'комиссия курьера',
  'Cash collection': 'Забор наличных',
  ', commission included': ', с учётом комиссии',
  'Sent on': 'Отправляется в сети',
  'to the wallet address you give, after the cash is counted and verified.':
    'на указанный вами адрес кошелька после пересчёта и проверки наличных.',
  'Getting a quote…': 'Получаем котировку…',

  // Support contact and widget
  'Telegram {0}': 'Telegram {0}',
  'Contact support on Telegram': 'Написать в поддержку в Telegram',
  'Message support here': 'Написать в поддержку на сайте',
  'Working hours:': 'Часы работы:',
  '. Use only the official contacts listed on this site.': '. Используйте только официальные контакты, указанные на этом сайте.',
  'Need help?': 'Нужна помощь?',
  'Back to conversations': 'К списку переписок',
  'New message': 'Новое сообщение',
  'Close support': 'Закрыть поддержку',
  'Sign in to message our support team. Your conversations are saved to your account.':
    'Войдите, чтобы написать в поддержку. Переписка сохраняется в вашем аккаунте.',
  'Help center': 'Центр помощи',
  'Open all conversations': 'Открыть все переписки',
  'Support, {0} unread': 'Поддержка, непрочитанных: {0}',

  // Progress
  '{0} of {1} steps completed': 'Выполнено шагов: {0} из {1}',
  'Order progress': 'Ход выполнения заявки',
  'Stopped at': 'Остановлено на шаге',
  Completed: 'Выполнено',
  'In progress': 'В процессе',
  'Not started': 'Не начато',
  Stopped: 'Остановлено',
  'Order stage': 'Этап заявки',

  // Chat
  '{0} (automated)': '{0} (автоматически)',
  '{0} support': 'Поддержка {0}',
  'Internal note': 'Внутренняя заметка',
  'Support team': 'Служба поддержки',
  Messages: 'Сообщения',
  'New messages': 'Новые сообщения',
  Sent: 'Отправлено',
  'Sending…': 'Отправка…',
  'Not sent.': 'Не отправлено.',
  Retry: 'Повторить',
  Discard: 'Удалить',
  'No messages yet.': 'Сообщений пока нет.',
  'Message type': 'Тип сообщения',
  'Reply to customer': 'Ответ клиенту',
  'Visible to staff only': 'Видно только сотрудникам',
  'Write a message': 'Напишите сообщение',
  'Messages can be up to {0} characters.': 'Длина сообщения — до {0} символов.',
  Live: 'Онлайн',
  'Connecting…': 'Подключение…',
  'Reconnecting… (checking every 10 s)': 'Переподключение… (проверка каждые 10 с)',
  'Offline (checking every 10 s)': 'Нет связи (проверка каждые 10 с)',
  'No conversations yet.': 'Переписок пока нет.',
  'No messages': 'Нет сообщений',
  'This conversation is resolved. Sending a message reopens it.': 'Обращение закрыто. Новое сообщение снова его откроет.',
  'Add a subject and a message.': 'Укажите тему и сообщение.',
  Subject: 'Тема',
  'About an order (optional)': 'По заявке (необязательно)',
  'Not about a specific order': 'Не по конкретной заявке',
  Message: 'Сообщение',
  'Never share passwords, seed phrases, private keys or full card numbers.':
    'Никогда не сообщайте пароли, сид-фразы, приватные ключи и полные номера карт.',
  'Send to support': 'Отправить в поддержку',
  'Waiting on you': 'Ждём вашего ответа',
  'Simulated sandbox data: not a real price, quote, deposit or payout':
    'Тестовые данные: это не настоящая цена, котировка, депозит или выплата',
  Close: 'Закрыть',

  // FAQ
  'Getting started': 'С чего начать',
  Pricing: 'Цены',
  Deposits: 'Депозиты',
  Payouts: 'Выплаты',
  'Accounts & safety': 'Аккаунт и безопасность',
  'Can I exchange real funds today?': 'Можно ли уже обменивать реальные средства?',
  'Which assets can I sell?': 'Какие активы можно продать?',
  'How is my payout calculated?': 'Как рассчитывается выплата?',
  'How long is a quote valid?': 'Сколько действует котировка?',
  'What happens if I send on the wrong network?': 'Что будет, если отправить в другой сети?',
  'How many confirmations does a deposit need?': 'Сколько подтверждений нужно депозиту?',
  'Can I cancel after I have sent my crypto?': 'Можно ли отменить обмен после отправки криптовалюты?',
  'How fast will I receive dollars?': 'Как быстро я получу доллары?',
  'Can I receive cash?': 'Можно ли получить наличные?',
  'What is the largest amount I can sell online?': 'Какую максимальную сумму можно продать онлайн?',
  'Will anyone from your team ask me to send crypto?': 'Может ли ваш сотрудник попросить меня отправить криптовалюту?',
  'Why do I need to verify my identity?': 'Зачем подтверждать личность?',
  'Not yet. Exchanges open only once our payment, custody and verification providers are connected and approved. Until then, the sandbox simulates prices, verification and transactions, and no real funds can be sent or received. The':
    'Пока нет. Обмены откроются только после подключения и одобрения платёжных и кастодиальных провайдеров и провайдера проверки. До тех пор тестовая среда имитирует цены, проверку и транзакции, а реальные средства отправить или получить нельзя.',
  'set out the terms that will apply to every Exchange Request.': 'определяют условия, которые будут применяться к каждой заявке на обмен.',
  'Bitcoin (BTC), Ether (ETH), Tether (USDT on Ethereum or Tron) and USD Coin (USDC on Ethereum, Solana or Base).':
    'Bitcoin (BTC), Ether (ETH), Tether (USDT в сетях Ethereum или Tron) и USD Coin (USDC в сетях Ethereum, Solana или Base).',
  'The quote shows the exchange rate you get, with our commission already included, and the value of your crypto at that rate. The payout fee is taken off as a separate line. The result is what you receive, to the cent.':
    'Котировка показывает курс обмена с уже включённой комиссией и стоимость вашей криптовалюты по этому курсу. Комиссия за выплату вычитается отдельной строкой. Итог — сумма, которую вы получите, с точностью до цента.',
  'for the full schedule.': '— там полный список комиссий.',
  'On the review screen, a quote holds for': 'На экране проверки котировка действует',
  'seconds. After you confirm, the rate is held for deposits that arrive within':
    'секунд. После подтверждения курс фиксируется для депозитов, поступивших в течение',
  'minutes. If your deposit is late, the exchange expires and you can start again.':
    'минут. Если депозит опоздает, обмен истечёт, и вы сможете начать заново.',
  'Always match the network on the deposit screen to the network your wallet uses to send. Under clause 9.9 of the':
    'Всегда сверяйте сеть на экране депозита с сетью, из которой отправляет ваш кошелёк. Согласно п. 9.9',
  ', the possibility of a refund for crypto assets sent to the wrong network is determined on a case-by-case basis, and the Service reserves the right to refuse it.':
    ', возможность возврата криптоактивов, отправленных в другой сети, определяется в каждом случае отдельно, и Сервис вправе отказать в нём.',
  ', including the return fees in clauses 9.7 and 9.8.': ', включая комиссии за возврат из пп. 9.7 и 9.8.',
  'Section 5 of the': 'Раздел 5',
  'sets 4 confirmations for BTC, and 21 for ETH and for USDT and USDC on TRC-20, ERC-20 and BEP-20. The count for your network is shown when you choose it.':
    'устанавливает 4 подтверждения для BTC и 21 — для ETH, а также для USDT и USDC в TRC-20, ERC-20 и BEP-20. Число для вашей сети показывается при её выборе.',
  'Clause 4.11 of the Service Rules lets you cancel an Exchange Request before the transaction is completed, except as provided in Sections 8 and 13. Contact support with your order reference. If you cancel after sending funds and before the exchange is completed, the return is made with retention of direct return costs and possible Company losses, up to 5% of the exchanged amount (clause 9.2). Returns are processed within 72 hours of the request, except as provided in Sections 8 and 13. See the':
    'Пункт 4.11 Правил сервиса позволяет отменить заявку до завершения операции, кроме случаев из разделов 8 и 13. Напишите в поддержку и укажите номер заявки. Если вы отменяете обмен после отправки средств и до его завершения, возврат производится с удержанием прямых расходов на возврат и возможных убытков Компании — до 5% суммы обмена (п. 9.2). Возвраты обрабатываются в течение 72 часов с момента запроса, кроме случаев из разделов 8 и 13. См.',
  'refund policy': 'правила возврата',
  'Each payout method shows an estimated time. These are estimates, not guarantees. Timing depends on network confirmations, reviews, and your bank.':
    'Для каждого способа выплаты указан ориентировочный срок. Это оценки, а не гарантии: сроки зависят от подтверждений в сети, проверок и вашего банка.',
  'Yes. Choose': 'Да. Выберите',
  'cash by courier': 'наличные с курьером',
  'as your payout method and give a US delivery address, a phone number and a preferred delivery window. A courier hands the cash only to you, after checking a photo ID that matches your verified account. You need a verified account, and the delivery area is checked by ZIP code.':
    'как способ выплаты и укажите адрес доставки в США, телефон и удобное время. Курьер передаёт наличные только вам после проверки документа с фото, совпадающего с подтверждённым аккаунтом. Нужен подтверждённый аккаунт; зона доставки проверяется по индексу.',
  'There is no maximum. The minimum is': 'Максимума нет. Минимум —',
  '. Any order may be reviewed before payout.': '. Любая заявка может быть проверена перед выплатой.',
  'No. We will never call, text or message you asking you to send crypto, share a code, or move money "to keep it safe". That is a scam. Stop and contact your bank or local law enforcement. Only contacts listed on the website are official (clause 4.21 of the':
    'Нет. Мы никогда не звоним и не пишем с просьбой отправить криптовалюту, сообщить код или перевести деньги «в безопасное место». Это мошенничество. Остановитесь и обратитесь в банк или правоохранительные органы. Официальны только контакты, указанные на сайте (п. 4.21',
  'Under Section 8 of the': 'Согласно разделу 8',
  ', we verify identity to ensure Service security and comply with anti-money laundering (AML) and counter-terrorism financing (CTF) laws, and we may request additional documents for a specific transaction if it is classified as high-risk. We use an identity-verification provider for this. In the sandbox, verification is simulated and no documents are collected.':
    ', мы проверяем личность для безопасности Сервиса и соблюдения законов о противодействии отмыванию денег (AML) и финансированию терроризма (CTF), а также можем запросить дополнительные документы по конкретной операции, если она отнесена к высокому риску. Для этого мы используем провайдера проверки личности. В тестовой среде проверка имитируется, документы не собираются.',

  // Formatting
  'Cash to {0}': 'Наличные по адресу: {0}',
  'Cash by courier': 'Наличные с курьером',
  'Bank account ending {0}': 'Банковский счёт, оканчивается на {0}',
  'Debit card ending {0}': 'Дебетовая карта, оканчивается на {0}',
  '{0} ending {1}': '{0}, оканчивается на {1}',
  '{0} h {1} min': '{0} ч {1} мин',
  'Sell crypto for US dollars': 'Продажа криптовалюты за доллары США',
};
