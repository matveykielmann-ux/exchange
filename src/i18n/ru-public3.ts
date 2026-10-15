/** Russian: public site, part 3 (exchange, home, legal index, order pages, support). */
export const RU_PUBLIC3: Record<string, string> = {
  // Exchange
  'What are you selling?': 'Что вы продаёте?',
  'Send only on {0}': 'Отправляйте только в сети {0}',
  'sent on any other network may be lost. Check the network your wallet or exchange uses before you continue.':
    ', отправленные в другой сети, могут быть потеряны. Перед продолжением проверьте сеть вашего кошелька или биржи.',
  'Continue to payout': 'Перейти к выплате',
  'How do you want to receive dollars?': 'Как вы хотите получить доллары?',
  'Not eligible': 'Недоступно',
  'Timing is estimated from when your deposit is final and any review is complete. It is not guaranteed. For':
    'Срок отсчитывается от окончательного подтверждения депозита и завершения проверок. Он не гарантирован. Для способа',
  'you give a delivery address in the next step.': 'адрес доставки указывается на следующем шаге.',
  'Continue to details': 'Перейти к данным',
  'You need an account to save a payout destination and confirm an exchange. Your amount and choices are kept.':
    'Чтобы сохранить реквизиты выплаты и подтвердить обмен, нужен аккаунт. Сумма и выбранные параметры сохранятся.',
  'Where should the courier bring it?': 'Куда курьеру привезти наличные?',
  'Where should we send it?': 'Куда отправить выплату?',
  'Delivery address': 'Адрес доставки',
  'Loading saved destinations…': 'Загрузка сохранённых реквизитов…',
  'No saved delivery addresses yet. Add one below.': 'Сохранённых адресов доставки пока нет. Добавьте адрес ниже.',
  'No saved destinations can receive {0} payouts yet.': 'Пока нет сохранённых реквизитов для выплат способом «{0}».',
  '{0} destination': 'Реквизиты: {0}',
  'Sandbox: a test card is added for you': 'Тест: для вас будет добавлена тестовая карта',
  'Cards are added through our card provider': 'Карты добавляются через нашего карточного провайдера',
  'The sandbox adds a test debit card. No card number is entered.':
    'В тестовой среде добавляется тестовая дебетовая карта. Номер карты не вводится.',
  'Card numbers are entered only in the card provider’s secure form, never on this site. The security code (CVV) is never stored.':
    'Номер карты вводится только в защищённой форме карточного провайдера и никогда на этом сайте. Код безопасности (CVV) не хранится.',
  'Adding…': 'Добавление…',
  'Add a delivery address': 'Добавить адрес доставки',
  'Save or choose a delivery address.': 'Сохраните или выберите адрес доставки.',
  'Choose where to send your dollars.': 'Выберите, куда отправить доллары.',
  'Refund address ({0})': 'Адрес для возврата ({0})',
  'The exchange rate, payout fee, minimum, quote validity and deposit window shown here are the conditions of this exchange. Under clause 4.24 of the':
    'Курс обмена, комиссия за выплату, минимум, срок действия котировки и окно депозита, указанные здесь, — условия этого обмена. Согласно п. 4.24',
  'I will send exactly': 'Я отправлю ровно',
  ', from a wallet I control, within the deposit window. Blockchain transactions can’t be reversed, and nobody from this service will ever ask me to send crypto on their behalf.':
    'с кошелька, который я контролирую, в пределах окна депозита. Транзакции в блокчейне необратимы, и никто из сервиса никогда не попросит меня отправить криптовалюту от его имени.',
  'Payout method': 'Способ выплаты',
  'Deposit window': 'Окно депозита',
  'minutes after you confirm': 'минут после подтверждения',
  'Exchange direction': 'Направление обмена',
  'Buy crypto with US dollar cash': 'Купить криптовалюту за наличные доллары США',
  Exchange: 'Обмен',

  // Home
  'Crypto to US dollars': 'Криптовалюта в доллары США',
  'Sell crypto.': 'Продайте криптовалюту.',
  'Get dollars.': 'Получите доллары.',
  'Every fee shown.': 'Все комиссии видны.',
  'Before you confirm.': 'До подтверждения.',
  'Send BTC, ETH, USDT or USDC and receive US dollars in your bank account, with the exchange rate and the payout fee listed as separate lines.':
    'Отправьте BTC, ETH, USDT или USDC и получите доллары США на банковский счёт — курс обмена и комиссия за выплату указаны отдельными строками.',
  'At a glance': 'Коротко',
  assets: 'актива',
  networks: 'сетей',
  'Chosen together with the asset': 'Выбирается вместе с активом',
  'No maximum': 'Без максимума',
  From: 'От',
  'per exchange': 'за обмен',
  '$0 ACH fee': 'ACH без комиссии',
  'Get a quote': 'Получите котировку',
  'See exactly what you will receive.': 'Узнайте точно, сколько получите.',
  'One quote and one status page, from deposit to payout': 'Одна котировка и одна страница статуса — от депозита до выплаты',
  'Network chosen with the asset, with clear warnings': 'Сеть выбирается вместе с активом, с понятными предупреждениями',
  'Quote anatomy': 'Из чего состоит котировка',
  'Every charge on its own line.': 'Каждая плата — отдельной строкой.',
  'We list the exchange rate and the payout fee separately, so you can check the math yourself. How the commission is defined is set out in Section 6 of the':
    'Мы указываем курс обмена и комиссию за выплату отдельно, чтобы вы могли проверить расчёт. Как определяется комиссия, описано в разделе 6',
  'The rate you get per coin at the moment of the quote, with our commission already included.':
    'Курс за одну монету на момент котировки, наша комиссия уже включена.',
  'Set by the payout method you choose. Bank transfer has no payout fee.':
    'Зависит от выбранного способа выплаты. Для банковского перевода комиссии нет.',
  'The exact dollar amount sent to you. The lines above always add up to it.':
    'Точная сумма в долларах, которую вы получите. Строки выше всегда сходятся с ней.',
  'Example quote': 'Пример котировки',
  Illustrative: 'Для примера',
  'Example only: 1.5 ETH at an illustrative $3,400.00, paid by bank transfer.':
    'Только пример: 1,5 ETH по условной цене $3,400.00, выплата банковским переводом.',
  'Four steps, one status page.': 'Четыре шага, одна страница статуса.',
  'Read the full walkthrough': 'Подробное описание',
  'Assets and networks': 'Активы и сети',
  'Pick the asset and its network together.': 'Выбирайте актив вместе с его сетью.',
  'The same token can exist on several networks. We ask for both up front, and repeat the network on the deposit screen, so funds are sent where they can be received.':
    'Один и тот же токен может существовать в нескольких сетях. Мы сразу спрашиваем и то, и другое и повторяем сеть на экране депозита, чтобы средства ушли туда, где их можно получить.',
  Comparison: 'Сравнение',
  'Confirmation counts follow Section 5 of the Service Rules where it sets them.':
    'Число подтверждений соответствует разделу 5 Правил сервиса там, где он его устанавливает.',
  Networks: 'Сети',
  'Choose how dollars reach you.': 'Выберите, как получить доллары.',
  'Timings are estimates. They depend on confirmations, reviews and your bank, and are never guaranteed.':
    'Сроки ориентировочные. Они зависят от подтверждений, проверок и вашего банка и никогда не гарантируются.',
  Why: 'Почему',
  'Security and compliance': 'Безопасность и соответствие требованиям',
  'Designed for regulated operation.': 'Создан для работы по правилам.',
  'These controls run on our server for every order.': 'Эти проверки выполняются на нашем сервере для каждой заявки.',
  ' In the sandbox, the providers behind them are simulated.': ' В тестовой среде провайдеры за ними имитируются.',
  ' In this development environment, provider integrations may be simulated for staff testing only.':
    ' В этой среде разработки интеграции провайдеров могут имитироваться только для тестирования сотрудниками.',
  'None of them is a claim of licensing or insurance.': 'Ни одна из них не является заявлением о лицензии или страховании.',
  'Customers verify their identity before their first exchange. High-risk transactions may need additional documents.':
    'Клиенты подтверждают личность перед первым обменом. Для операций с высоким риском могут понадобиться дополнительные документы.',
  Screening: 'Скрининг',
  'Account protection': 'Защита аккаунта',
  'Two-step sign-in, saved payout destinations stored only as the last four digits, and time-limited sessions.':
    'Двухэтапный вход, хранение реквизитов выплат только в виде последних четырёх цифр и сеансы с ограниченным сроком.',
  'How we approach security': 'Наш подход к безопасности',
  Questions: 'Вопросы',
  'Before you start.': 'Перед началом.',
  'All questions': 'Все вопросы',
  'Pick the asset and network, enter an amount, and see the full breakdown before anything else.':
    'Выберите актив и сеть, введите сумму и сразу увидите полный расчёт.',
  'Choose your payout': 'Выберите выплату',
  'Bank transfer, wire, debit card or cash by courier. Each option shows its fee and estimated timing.':
    'Банковский перевод, wire, дебетовая карта или наличные с курьером. Для каждого варианта указаны комиссия и ориентировочный срок.',
  'Confirm, then send to the deposit address shown, on the network shown, before the window closes.':
    'Подтвердите и отправьте на указанный адрес депозита в указанной сети до закрытия окна.',
  'Receive dollars': 'Получите доллары',
  'Track confirmations and your payout on one status page. Every step is time-stamped.':
    'Следите за подтверждениями и выплатой на одной странице статуса. Каждый шаг отмечен временем.',

  // Legal pages (interface only; the documents themselves are in English)
  'Reviewer notes:': 'Заметки для проверки:',
  'points where this document and the current site differ or details are missing (shown in the sandbox only)':
    'места, где документ расходится с текущим сайтом или не хватает данных (только в тестовой среде)',
  'Legal documents.': 'Юридические документы.',
  'The terms, policies and disclosures that apply to your account and your orders. Each one is versioned, and we keep a record of the version you accepted.':
    'Условия, политики и раскрытия, которые применяются к вашему аккаунту и заявкам. У каждого документа есть версия, и мы храним запись о принятой вами версии.',
  'For your information': 'Для информации',
  'Pending legal review': 'Ожидает юридической проверки',
  'This document is a draft awaiting review by counsel and may change before it takes effect.':
    'Документ — проект, ожидающий проверки юристом, и может измениться до вступления в силу.',
  'This document is a draft awaiting review by counsel and has no effective date yet.':
    'Документ — проект, ожидающий проверки юристом; дата вступления в силу ещё не определена.',
  'These documents are drafts awaiting review by counsel and have no effective date yet.':
    'Документы — проекты, ожидающие проверки юристом; дата вступления в силу ещё не определена.',
  'Highlighted notes mark facts the owner or counsel still has to supply.':
    'Выделенные заметки отмечают сведения, которые ещё должны предоставить владелец или юрист.',
  'Some details are still to be confirmed.': 'Некоторые детали ещё уточняются.',
  'Review item {0}': 'Пункт проверки {0}',
  Effective: 'Действует с',
  'Not yet in effect': 'Ещё не действует',
  'Last updated': 'Обновлён',
  Acceptance: 'Принятие',
  'Accepted when you create an account': 'Принимается при создании аккаунта',
  'Accepted with each order': 'Принимается с каждой заявкой',
  'Legal documents are published in English. The English text is the binding version.':
    'Юридические документы опубликованы на английском языке. Обязательной является английская версия.',

  // Order page
  Copied: 'Скопировано',
  'Sandbox autopilot': 'Тестовый автопилот',
  'The sandbox': 'Тестовый',
  'courier and cash desk': 'курьер и касса',
  'deposit monitor': 'мониторинг депозитов',
  'moves this order one step about every': 'продвигает заявку на шаг примерно каждые',
  'seconds using signed test events. Nothing real is collected, sent or broadcast.':
    'секунд с помощью подписанных тестовых событий. Ничего реального не забирается, не отправляется и не публикуется в сети.',
  'Sandbox controls': 'Тестовое управление',
  'Simulate the courier': 'Имитировать курьера',
  'Simulate the blockchain': 'Имитировать блокчейн',
  'These buttons send a signed test event from the sandbox': 'Эти кнопки отправляют подписанное тестовое событие от тестового',
  'cash provider': 'провайдера наличных',
  '. The server checks the signature and moves the order through the same rules a real':
    '. Сервер проверяет подпись и проводит заявку по тем же правилам, что и настоящий',
  'would. They don’t exist outside the sandbox.': '. Вне тестовой среды этих кнопок нет.',
  'Courier collects the exact cash': 'Курьер забирает точную сумму',
  'Deposit the exact amount': 'Внести точную сумму',
  'Cash is short': 'Наличных не хватает',
  'Deposit too little': 'Внести меньше',
  'Finish the cash count': 'Завершить пересчёт',
  'Transaction hash submitted for review': 'Хеш транзакции отправлен на проверку',
  'Received at': 'Получен',
  '. A hash helps our team find your transfer, but it does not confirm a deposit: the order moves on only when deposit monitoring reports the transaction on the':
    '. Хеш помогает нам найти ваш перевод, но не подтверждает депозит: заявка продвинется, только когда мониторинг зафиксирует транзакцию в сети',
  'network.': '.',
  'If more proof is needed, support will contact you in your': 'Если понадобятся доказательства, поддержка свяжется с вами в',
  ', or you can reach us on': ', или напишите нам в',
  'Sent it? Submit the transaction hash': 'Отправили? Укажите хеш транзакции',
  'Transaction hash (TXID)': 'Хеш транзакции (TXID)',
  'Copy it from your wallet’s transaction details. We check its format only; it doesn’t confirm the deposit.':
    'Скопируйте его из деталей транзакции в кошельке. Мы проверяем только формат; хеш не подтверждает депозит.',
  'Submitting…': 'Отправка…',
  'Submit for review': 'Отправить на проверку',
  'Choose a photo or scan of your ID.': 'Выберите фото или скан документа.',
  'Upload a JPEG, PNG or PDF file.': 'Загрузите файл JPEG, PNG или PDF.',
  'The file is larger than 4 MB. Use a smaller photo or scan.': 'Файл больше 4 МБ. Используйте фото или скан меньшего размера.',
  'The file could not be read. Choose it again.': 'Не удалось прочитать файл. Выберите его снова.',
  'Photo ID for the courier': 'Документ с фото для курьера',
  'Demo upload': 'Демо-загрузка',
  'KB · received': 'КБ · получен',
  ' · checked and discarded (sandbox: the file is not kept)': ' · проверен и удалён (тест: файл не хранится)',
  'Upload the photo ID you will show the courier. The courier collects cash only from the verified account holder.':
    'Загрузите документ с фото, который покажете курьеру. Курьер забирает наличные только у подтверждённого владельца аккаунта.',
  ' Sandbox: use a test image, not a real document. The file is checked and then discarded.':
    ' Тест: используйте тестовое изображение, а не настоящий документ. Файл проверяется и удаляется.',
  'Add another file': 'Добавить ещё файл',
  'ID document (JPEG, PNG or PDF, up to 4 MB)': 'Документ (JPEG, PNG или PDF, до 4 МБ)',
  'Uploading…': 'Загрузка…',
  'Upload ID': 'Загрузить документ',
  'Questions? Reach support on': 'Есть вопросы? Напишите в поддержку в',
  'or in your': 'или в',
  ' (sandbox simulation)': ' (тестовая имитация)',
  'Arranging the courier': 'Организуем курьера',
  'Preparing your deposit address': 'Готовим адрес депозита',
  'This usually takes a moment. The page updates by itself.': 'Обычно это занимает мгновение. Страница обновится сама.',
  'Cash collected{0}': 'Наличные получены{0}',
  'Deposit seen{0}': 'Депозит замечен{0}',
  'The courier reported collecting the cash. It is now counted and checked before any crypto is sent.':
    'Курьер сообщил, что забрал наличные. Сейчас их пересчитывают и проверяют перед отправкой криптовалюты.',
  'Deposit monitoring reported a transfer for this order. It becomes final after {0} network confirmations.':
    'Мониторинг зафиксировал перевод по этой заявке. Он станет окончательным после {0} подтверждений сети.',
  'Cash verified{0}': 'Наличные проверены{0}',
  'Deposit final{0}': 'Депозит подтверждён{0}',
  'Automatic checks are running. This page updates by itself.': 'Идут автоматические проверки. Страница обновится сама.',
  'Held for review': 'На проверке',
  'A member of our team is checking this order before': 'Сотрудник проверяет заявку, прежде чем',
  'the crypto is sent': 'будет отправлена криптовалюта',
  'the payout is sent': 'будет отправлена выплата',
  ' Reason: {0}': ' Причина: {0}',
  'Approved: waiting for the transfer to be authorized': 'Одобрено: ожидается авторизация перевода',
  'Approved for payout': 'Одобрено к выплате',
  'The cash is verified and checks are complete. A member of our team authorizes each crypto transfer before it is sent.':
    'Наличные проверены, проверки завершены. Сотрудник авторизует каждый перевод криптовалюты перед отправкой.',
  'Your deposit is final and checks are complete. A member of our team authorizes each payout before it goes to the payout provider.':
    'Депозит подтверждён, проверки завершены. Сотрудник авторизует каждую выплату перед передачей платёжному провайдеру.',
  'Crypto transfer in progress{0}': 'Перевод криптовалюты выполняется{0}',
  'Payout in progress{0}': 'Выплата выполняется{0}',
  'The transfer of {0} was handed to the custody provider. This page shows it as completed only when the provider reports it.':
    'Перевод {0} передан кастодиальному провайдеру. Страница покажет его выполненным только после сообщения провайдера.',
  'The payout instruction was accepted by the payout provider. This page shows it as completed only when the provider reports it.':
    'Платёжный провайдер принял поручение на выплату. Страница покажет её выполненной только после сообщения провайдера.',
  ' In the sandbox nothing is broadcast or paid.': ' В тестовой среде ничего не отправляется и не выплачивается.',
  'The crypto transfer didn’t go through': 'Перевод криптовалюты не прошёл',
  'The payout didn’t go through': 'Выплата не прошла',
  'Our team has been alerted and will retry or contact you. If the exchange cannot be completed, clause 4.2 of the':
    'Наша команда получила уведомление и повторит попытку или свяжется с вами. Если обмен невозможно завершить, п. 4.2',
  'governs the return of funds.': 'определяет порядок возврата средств.',
  'Cash return in progress': 'Возврат наличных выполняется',
  'Refund in progress': 'Возврат выполняется',
  'The courier will return your cash to you after an ID check. ': 'Курьер вернёт вам наличные после проверки документа. ',
  'We are returning your {0} on-chain to the refund address you gave. ':
    'Мы возвращаем ваши {0} в блокчейне на указанный вами адрес для возврата. ',
  'Return fees and timeframes are set by Section 9 of the Service Rules; see the':
    'Комиссии и сроки возврата определяет раздел 9 Правил сервиса; см.',
  Refunded: 'Возвращено',
  'The provider reported your cash as returned.': 'Провайдер сообщил, что наличные возвращены.',
  'Your {0} was returned to your refund address.': 'Ваши {0} возвращены на адрес для возврата.',
  'The collection window closed': 'Окно забора закрылось',
  'The deposit window closed': 'Окно депозита закрылось',
  'The cash wasn’t collected in time, so this order expired. Nothing was taken. Start a new exchange or':
    'Наличные не были забраны вовремя, поэтому заявка истекла. Ничего не забрано. Начните новый обмен или',
  'contact support': 'напишите в поддержку',
  'No deposit was seen in time, so this order expired. If you sent funds after the window closed,':
    'Депозит не поступил вовремя, поэтому заявка истекла. Если вы отправили средства после закрытия окна,',
  '. Under clause 4.14 of the': '. Согласно п. 4.14',
  ', such funds are transferred back with the related commission fees deducted, and if you ask to proceed with the exchange instead, the rate and terms may be changed.':
    ', такие средства возвращаются за вычетом связанных комиссий, а если вы попросите всё же провести обмен, курс и условия могут измениться.',
  'We couldn’t accept this order': 'Мы не смогли принять эту заявку',
  'If you already sent funds, their return is handled under Sections 8 and 9 of the':
    'Если вы уже отправили средства, их возврат выполняется по разделам 8 и 9',
  'Exchange completed': 'Обмен выполнен',
  'Payout completed': 'Выплата выполнена',
  'Completed (demo)': 'Выполнено (демо)',
  'Cash paid': 'Оплачено наличными',
  'You sent': 'Вы отправили',
  'Crypto received': 'Получено криптовалюты',
  'You received': 'Вы получили',
  'Sent to': 'Отправлено на',
  'Paid to': 'Выплачено на',
  'Provider reference': 'Ссылка провайдера',
  'This is a sandbox demo. The amounts are simulated and nothing was': 'Это тестовая демонстрация. Суммы имитируются, и ничего не было',
  'collected, sent or broadcast': 'забрано, отправлено или опубликовано в сети',
  'received or paid out': 'получено или выплачено',
  'The custody provider reported the transfer as completed. Your wallet may take time to show it.':
    'Кастодиальный провайдер сообщил, что перевод выполнен. Кошелёк может показать его не сразу.',
  'The payout provider reported the payout as completed. {0}': 'Платёжный провайдер сообщил, что выплата выполнена. {0}',
  'Your bank may take time to show it.': 'Банк может отразить её не сразу.',
  'Next steps': 'Что дальше',
  'Keep the order number': 'Сохраните номер заявки',
  'for your records; the receipt is on this page.': '— квитанция находится на этой странице.',
  'Something doesn’t match? Contact support with the order number on': 'Что-то не сходится? Напишите в поддержку с номером заявки в',
  'Start another exchange': 'Начать новый обмен',
  'View all orders': 'Все заявки',
  per: 'за',
  ', ID check at the door': ', проверка документа у двери',
  'Transfer ref.': 'Ссылка перевода',
  'Payout ref.': 'Ссылка выплаты',
  'Refund to': 'Возврат на',
  'Return ref.': 'Ссылка возврата',
  'Refund tx': 'Транзакция возврата',
  'This order could not be loaded.': 'Не удалось загрузить заявку.',
  'Loading your order…': 'Загрузка заявки…',
  'Order not found': 'Заявка не найдена',
  'It may belong to a different account, or the link is wrong.': 'Возможно, она принадлежит другому аккаунту или ссылка неверна.',
  'Back to orders': 'Назад к заявкам',
  'Buying {0} for {1} in cash': 'Покупка {0} за {1} наличными',
  'Selling {0} for {1}': 'Продажа {0} за {1}',
  '· created': '· создана',
  'Your order is on hold': 'Ваша заявка приостановлена',
  'Our team is checking it. Nothing moves until the hold is released; we will message you if we need anything.':
    'Наша команда её проверяет. До снятия приостановки заявка не продвигается; если что-то понадобится, мы напишем.',
  'Order {0} placed': 'Заявка {0} оформлена',
  'Your rate is held for the cash amount shown. The courier will call to confirm the collection time.':
    'Курс зафиксирован для указанной суммы наличных. Курьер позвонит, чтобы согласовать время забора.',
  'Your rate is held for a deposit of exactly the quoted amount that arrives in the window below.':
    'Курс зафиксирован для депозита ровно на сумму котировки, поступившего в окне ниже.',
  ' This is a sandbox order: no courier will come and no crypto will be sent.':
    ' Это тестовая заявка: курьер не приедет, криптовалюта не будет отправлена.',
  ' This is a sandbox order: the deposit address is a placeholder. Do not send funds to it.':
    ' Это тестовая заявка: адрес депозита — заглушка. Не отправляйте на него средства.',
  Send: 'Отправьте',
  'Network:': 'Сеть:',
  'Window closes in': 'Окно закроется через',
  'Window closed': 'Окно закрыто',
  Copy: 'Копировать',
  'Deposit address withheld': 'Адрес депозита не показан',
  'No usable deposit address is available for this order. Do not send funds. Contact support.':
    'Для этой заявки нет пригодного адреса депозита. Не отправляйте средства. Напишите в поддержку.',
  'Deposit instructions unavailable': 'Инструкции для депозита недоступны',
  'A deposit address has not been issued for this order yet. Do not send funds until instructions appear here. If this persists, contact support.':
    'Адрес депозита по этой заявке ещё не выдан. Не отправляйте средства, пока инструкции не появятся здесь. Если это не исправится, напишите в поддержку.',
  'Payout evidence reference': 'Ссылка на доказательство выплаты',
  'Operations recorded this payout as completed with evidence. This is an operator-recorded confirmation, not an automated provider report.':
    'Операции зафиксировали эту выплату как завершённую с доказательством. Это запись оператора, а не автоматический отчёт провайдера.',
  'Memo / tag:': 'Memo / тег:',
  'Sandbox placeholder. Do not send funds.': 'Тестовая заглушка. Не отправляйте средства.',
  'It is deliberately invalid on every network.': 'Он намеренно недействителен во всех сетях.',
  'Only send {0} on {1}': 'Отправляйте только {0} в сети {1}',
  'Sending a different asset, or using a different network, may result in permanent loss. Send exactly the amount shown; a different amount is held for review.':
    'Отправка другого актива или в другой сети может привести к безвозвратной потере. Отправьте ровно указанную сумму; другая сумма задерживается для проверки.',
  Have: 'Подготовьте',
  'in cash ready': 'наличными',
  'Collection window closes in': 'Окно забора закроется через',
  'Upload the photo ID you will show the courier (below).': 'Загрузите документ с фото, который покажете курьеру (ниже).',
  'The courier calls to confirm the time, checks your ID and collects exactly':
    'Курьер позвонит, чтобы согласовать время, проверит документ и заберёт ровно',
  'The cash is counted and verified, then': 'Наличные пересчитываются и проверяются, затем',
  'is sent to your': 'отправляется на ваш кошелёк',
  'wallet.': '.',
  'Sandbox order.': 'Тестовая заявка.',
  'No courier will come. Don’t hand cash to anyone for this order.': 'Курьер не приедет. Не передавайте никому наличные по этой заявке.',
  'Hand cash only to the courier at your saved address': 'Передавайте наличные только курьеру по сохранённому адресу',
  'Nobody from this service will ask you to pay elsewhere, send crypto, or hand cash to someone without an ID check. If anything seems wrong, stop and contact support.':
    'Никто из сервиса не попросит заплатить в другом месте, отправить криптовалюту или передать наличные без проверки документа. Если что-то кажется странным, остановитесь и напишите в поддержку.',
  Progress: 'Ход выполнения',
  Updated: 'Обновлено',
  'Refresh the order': 'Обновить заявку',
  'Cancel this order': 'Отменить заявку',
  'Cancel this order? Only before the courier collects the cash.': 'Отменить заявку? Только до того, как курьер заберёт наличные.',
  'Cancel this order? Only do this if you have not sent any funds.': 'Отменить заявку? Делайте это, только если вы не отправляли средства.',
  'Only before the courier collects the cash. After that, contact support: returns are handled under Section 9 of the':
    'Только до того, как курьер заберёт наличные. После этого напишите в поддержку: возвраты выполняются по разделу 9',
  'Only before you send funds. Already sent them? You can still ask support to cancel before the exchange is completed (clause 4.11 of the':
    'Только до отправки средств. Уже отправили? Можно попросить поддержку отменить обмен до его завершения (п. 4.11',
  '); return costs under clause 9.2 apply.': '); применяются расходы на возврат по п. 9.2.',
  Activity: 'История',
  'Sandbox events': 'Тестовые события',
  'Questions about this order?': 'Вопросы по заявке?',
  'Mention order': 'Укажите номер заявки',
  'so we can find it quickly.': ', чтобы мы быстро её нашли.',
  Receipt: 'Квитанция',
  'Courier scheduled': 'Курьер назначен',
  'Cash delivered': 'Наличные доставлены',

  // Orders and support
  'Every exchange on your account, newest first.': 'Все обмены в вашем аккаунте, сначала новые.',
  'Sandbox orders': 'Тестовые заявки',
  'Orders could not be loaded.': 'Не удалось загрузить заявки.',
  'No orders yet': 'Заявок пока нет',
  'When you confirm an exchange, it appears here with its status and receipt.':
    'Подтверждённый обмен появится здесь со статусом и квитанцией.',
  Buy: 'Покупка',
  Sell: 'Продажа',
  cash: 'наличные',
  Page: 'Страница',
  'Our team replies here. Conversations stay in your account; you can link one to an order.':
    'Наша команда отвечает здесь. Переписка хранится в аккаунте; её можно привязать к заявке.',
  'Conversations could not be loaded.': 'Не удалось загрузить переписку.',
  Conversation: 'Переписка',
  'Start a conversation': 'Начать переписку',
  'Choose a conversation, or start a new one.': 'Выберите переписку или начните новую.',
  'When do you ask for a refund address?': 'Когда нужен адрес для возврата?',
  "Only if an exchange can't be completed, for example after a failed review. You don't give one up front: we then ask for it on the order page, check it and return the crypto there. Returns follow Section 9 of the":
    'Только если обмен не удаётся завершить, например после неудачной проверки. Заранее указывать адрес не нужно: в этом случае мы попросим его на странице заявки, проверим и вернём криптовалюту на него. Возвраты выполняются по разделу 9',
  "Sign in and choose or add the account that will receive dollars. No refund address is needed up front: if the exchange can't be completed, we ask for one on the order page.":
    'Войдите и выберите или добавьте счёт для получения долларов. Адрес для возврата заранее не нужен: если обмен не удастся завершить, мы попросим его на странице заявки.',
  'Refund addresses are screened before any refund is sent.': 'Адреса для возврата проверяются перед отправкой возврата.',
  'Transactions are screened against sanctions and blockchain-risk data before payout, and refund addresses before any refund.':
    'Транзакции до выплаты, а адреса возврата до возврата проверяются по санкционным спискам и данным о рисках в блокчейне.',
  'Where should we return your deposit?': 'Куда вернуть ваш депозит?',
  'This order can’t be completed, so your {0} will be returned. Enter an address on {1} that you control.':
    'Эту заявку не удаётся завершить, поэтому ваши {0} будут возвращены. Укажите адрес в сети {1}, которым вы владеете.',
  'We check the address before sending the refund. Once saved, it can’t be changed.':
    'Мы проверим адрес перед отправкой возврата. После сохранения его нельзя изменить.',
  'Save refund address': 'Сохранить адрес для возврата',
  'We need a refund address to return your {0}: enter it below. ': 'Чтобы вернуть ваши {0}, нужен адрес для возврата: укажите его ниже. ',
  'Refund address needed': 'Нужен адрес для возврата',

  // Pricing: 3% exchange fee, no spread (2026-10-15)
  'The market rate for': 'Рыночный курс',
  'at the moment of this quote. There is no spread: the fee below is the only deduction.':
    'на момент расчёта. Спреда нет: комиссия ниже — единственное удержание.',
  'the fee': 'комиссия',
  ', market rate': ', рыночный курс',
  'The quote shows the market exchange rate, with no spread, and the value of your crypto at that rate. The fee is taken off as a separate line: 3% for bank transfer, wire and debit card, or the courier fee for cash by courier. The result is what you receive, to the cent.':
    'В расчёте указан рыночный курс без спреда и стоимость вашей криптовалюты по этому курсу. Комиссия списывается отдельной строкой: 3% для банковского перевода, wire и дебетовой карты или стоимость курьера для наличных с курьером. Итог — это сумма, которую вы получите, до цента.',
  "Choose the asset and the network you'll send on, then enter an amount. You see the market exchange rate, the value of your crypto at that rate and the fee, all before you share any personal details.":
    'Выберите актив и сеть, в которой будете отправлять, и введите сумму. Вы увидите рыночный курс, стоимость вашей криптовалюты по этому курсу и комиссию ещё до того, как укажете личные данные.',
  'One fee, shown on the quote.': 'Одна комиссия, и она видна в расчёте.',
  'A 3% exchange fee on every payout method except cash by courier, which has a courier fee instead. There is no spread: you get the market rate. Return fees apply only if funds have to be returned.':
    'Комиссия за обмен 3% на все способы выплаты, кроме наличных с курьером: там вместо неё стоимость курьера. Спреда нет, вы получаете рыночный курс. Комиссии за возврат применяются, только если средства приходится возвращать.',
  'Your quote uses the market reference price at the moment of the quote, with no spread added. The fee for your method is shown as a separate line in dollars.':
    'В расчёте используется рыночная справочная цена на момент расчёта, без спреда. Комиссия за выбранный способ показана отдельной строкой в долларах.',
  'Fees by method': 'Комиссии по способам',
  'The fee above is how the commission appears in your quote. The Service Rules define the commission as follows:':
    'Комиссия выше — это то, как вознаграждение Сервиса отражается в расчёте. Правила Сервиса определяют комиссию так:',
  'The exchange rate, fee, minimum, quote validity and deposit window shown here are the conditions of this exchange. Under clause 4.24 of the':
    'Курс, комиссия, минимум, срок действия расчёта и окно для депозита, указанные здесь, — условия этого обмена. Согласно пункту 4.24',
  'Send BTC, ETH, USDT or USDC and receive US dollars in your bank account, with the market exchange rate and the fee listed as separate lines.':
    'Отправьте BTC, ETH, USDT или USDC и получите доллары США на банковский счёт. Рыночный курс и комиссия указаны отдельными строками.',
  'We list the exchange rate and the fee separately, so you can check the math yourself. How the commission is defined is set out in Section 6 of the':
    'Мы указываем курс и комиссию отдельно, чтобы вы могли сами проверить расчёт. Как определяется комиссия, описано в разделе 6',
  'The market rate per coin at the moment of the quote. There is no spread.': 'Рыночный курс за монету на момент расчёта. Спреда нет.',
  'Exchange fee': 'Комиссия за обмен',
  '3% of the value, for bank transfer, wire and debit card. Cash by courier has a courier fee instead.':
    '3% от суммы для банковского перевода, wire и дебетовой карты. Для наличных с курьером вместо неё стоимость курьера.',
};
