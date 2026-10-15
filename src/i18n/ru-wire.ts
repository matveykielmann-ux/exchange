/** Russian: buying crypto with a bank wire (wire → crypto), customer pages, CRM and order states. */
export const RU_WIRE: Record<string, string> = {
  // Exchange flow
  'How you pay': 'Способ оплаты',
  'Bank wire': 'Банковский перевод',
  'Cash by courier': 'Наличные через курьера',
  'You send a wire from your own US bank account. No wallet or card needed on our side.':
    'Вы отправляете банковский перевод со своего счёта в банке США. Кошелёк или карта с нашей стороны не нужны.',
  'A courier collects US dollar cash from you after an ID check.':
    'Курьер забирает у вас наличные доллары США после проверки документа.',
  'min {0}': 'мин. {0}',
  'Dollars you wire (USD)': 'Сумма перевода (USD)',
  'Sent by bank wire to the instructions on your order page. Minimum {0}; wires have their own minimum.':
    'Отправляется банковским переводом по реквизитам на странице заявки.',
  'Sent by bank wire to the instructions on your order page.':
    'Отправляется банковским переводом по реквизитам на странице заявки.',
  'Paying by wire isn’t available for this amount': 'Оплата переводом недоступна для этой суммы',
  Wallet: 'Кошелёк',
  'Where should we send the crypto?': 'Куда отправить криптовалюту?',
  'You need an account to confirm an exchange. Your amount and choices are kept.':
    'Чтобы подтвердить обмен, нужен аккаунт. Сумма и выбранные параметры сохранятся.',
  'We send the {0} here once the wire is matched and verified. Use a wallet you control on {1}; transfers can’t be reversed.':
    'Мы отправим {0} сюда после того, как перевод будет сопоставлен и проверен. Используйте кошелёк в сети {1}, которым управляете вы; переводы нельзя отменить.',
  'After you confirm, the wire instructions appear on your order page. Send the wire from a US bank account in your own name and quote the order number as the reference.':
    'После подтверждения реквизиты для перевода появятся на странице заявки. Отправьте перевод со счёта в банке США, открытого на ваше имя, и укажите номер заявки в назначении платежа.',
  'The exchange rate, wire fee, minimum, quote validity and wire window shown here are the conditions of this exchange. Under clause 4.24 of the':
    'Курс, комиссия за перевод, минимум, срок действия котировки и окно для перевода, указанные здесь, являются условиями этого обмена. Согласно пункту 4.24',
  'I will wire exactly': 'Я переведу ровно',
  'from a US bank account in my own name, only to the instructions on my order page, with the order number as the reference. The':
    'со счёта в банке США на моё имя, только по реквизитам на странице заявки, указав номер заявки в назначении платежа.',
  'You pay by': 'Способ оплаты',
  'Bank wire. Instructions appear on your order page after you confirm.':
    'Банковский перевод. Реквизиты появятся на странице заявки после подтверждения.',
  'Wire window': 'Окно для перевода',

  // Order page
  Wire: 'Переведите',
  'Wire instructions': 'Реквизиты для перевода',
  Beneficiary: 'Получатель',
  Bank: 'Банк',
  'Account number': 'Номер счёта',
  'Routing number (ABA)': 'Routing number (ABA)',
  'Reference / memo': 'Назначение платежа',
  Pending: 'Ожидает',
  'Do not send a wire yet.': 'Пока не отправляйте перевод.',
  'Live bank details are issued only after the bank payout provider is connected for this order.':
    'Рабочие банковские реквизиты выдаются только после подключения банковского выплатного провайдера для этой заявки.',
  'Use only the instructions on this page': 'Используйте только реквизиты с этой страницы',
  'Send the wire from a US bank account in your own name and quote the order number as the reference. Nobody from this service will send you bank details by email, chat or phone. If anything seems wrong, stop and contact support.':
    'Отправляйте перевод со счёта в банке США на ваше имя и указывайте номер заявки в назначении платежа. Никто из сервиса не будет присылать вам реквизиты по почте, в чате или по телефону. Если что-то кажется странным, остановитесь и напишите в поддержку.',
  'You marked the wire as sent': 'Вы отметили, что перевод отправлен',
  ' · your reference {0}': ' · ваш номер {0}',
  'This does not confirm a payment: the order moves on only when the bank reports the wire.':
    'Это не подтверждает оплату: заявка продвинется, только когда банк сообщит о переводе.',
  'Sent the wire? Let us know': 'Отправили перевод? Сообщите нам',
  'Your bank’s reference (optional)': 'Номер перевода в вашем банке (необязательно)',
  'For example the Fed or confirmation number your bank shows. It helps us find the wire; it doesn’t confirm it.':
    'Например, Fed reference или номер подтверждения из вашего банка. Он помогает найти перевод, но не подтверждает его.',
  'I’ve sent the wire': 'Я отправил перевод',
  'Use 64 characters or fewer.': 'Используйте не более 64 символов.',
  'Use letters, digits, spaces and . _ / # - only.': 'Используйте только буквы, цифры, пробелы и символы . _ / # -.',
  'Preparing your wire instructions': 'Готовим реквизиты для перевода',
  'Wire received{0}': 'Перевод получен{0}',
  'The bank reported a wire for this order. It is now matched and checked before any crypto is sent.':
    'Банк сообщил о переводе по этой заявке. Сейчас он сопоставляется и проверяется перед отправкой криптовалюты.',
  'Wire verified{0}': 'Перевод проверен{0}',
  'The wire is verified and checks are complete. A member of our team authorizes each crypto transfer before it is sent.':
    'Перевод проверен, проверки завершены. Каждый перевод криптовалюты подтверждает сотрудник команды перед отправкой.',
  'Wire return in progress': 'Идёт возврат перевода',
  'The wire will be returned to the bank account it came from. ': 'Перевод будет возвращён на счёт, с которого он пришёл. ',
  'The bank reported your wire as returned to the sending account.': 'Банк сообщил, что перевод возвращён на счёт отправителя.',
  'The wire window closed': 'Окно для перевода закрыто',
  'No wire was received in time, so this order expired. If you already sent a wire,':
    'Перевод не поступил вовремя, поэтому заявка истекла. Если вы уже отправили перевод,',
  ': it is returned under Section 9 of the Service Rules.': ': он возвращается по разделу 9 Правил сервиса.',
  'Paid by wire': 'Оплачено переводом',
  'wired, sent or broadcast': 'переведено, отправлено или передано в сеть',
  'You pay by wire': 'Вы платите переводом',
  'Wire fee': 'Комиссия за перевод',
  'Wire received': 'Перевод получен',
  'Your wire ref.': 'Ваш номер перевода',
  'Buying {0} for {1} by bank wire': 'Покупка {0} за {1} банковским переводом',
  'Your rate is held for a wire of exactly the amount shown that arrives in the window.':
    'Курс зафиксирован для перевода ровно на указанную сумму, поступившего в пределах окна.',
  ' Do not send a wire: bank details for this order are not live.':
    ' Не отправляйте перевод: банковские реквизиты для этой заявки не рабочие.',
  ' Do not hand over cash: no courier is dispatched for this order.':
    ' Не передавайте наличные: курьер по этой заявке не выезжает.',
  ' Do not send funds: the deposit address for this order is not payable.':
    ' Не отправляйте средства: депозитный адрес для этой заявки не принимает платежи.',
  'Do not send funds.': 'Не отправляйте средства.',
  'This address is deliberately invalid on every network.': 'Этот адрес намеренно недействителен во всех сетях.',
  'No courier will come.': 'Курьер не приедет.',
  'Don’t hand cash to anyone for this order.': 'Не передавайте наличные никому по этой заявке.',
  'Cancel this order? Only if you have not sent the wire.': 'Отменить заявку? Только если вы ещё не отправили перевод.',
  'Only before you send the wire. Already sent it? Contact support: returns are handled under Section 9 of the':
    'Только до отправки перевода. Уже отправили? Напишите в поддержку: возвраты проводятся по разделу 9',

  // Sandbox controls
  'bank desk': 'банковский отдел',
  'Simulate the bank': 'Симуляция банка',
  'bank provider': 'банковского провайдера',
  wire: 'перевод',
  collection: 'забор',
  deposit: 'депозит',
  'The exact wire arrives': 'Поступает точный перевод',
  'The wire is short': 'Перевод меньше суммы',
  'Match the wire': 'Сопоставить перевод',

  // CRM
  'Buy · wire → crypto': 'Покупка · перевод → крипта',
  'Waiting for wire instructions to be issued': 'Ждём выдачи реквизитов для перевода',
  'Mark wire instructions issued (demo)': 'Отметить: реквизиты выданы (демо)',
  'Mark wire received (demo)': 'Отметить: перевод получен (демо)',

  // Order states
  'Preparing wire instructions': 'Подготовка реквизитов',
  'Awaiting wire': 'Ожидается перевод',
  'Matching wire': 'Сопоставление перевода',
  'Wire verified': 'Перевод проверен',
  'Wire return pending': 'Ожидается возврат перевода',
  'Wire returned': 'Перевод возвращён',
  'Wire matched and verified': 'Перевод сопоставлен и проверен',
  'Wire return': 'Возврат перевода',
  'Wire instructions issued. Send the exact amount before the deadline.': 'Реквизиты выданы. Отправьте точную сумму до окончания срока.',
  'We could not issue wire instructions for this order. Nothing was sent.':
    'Не удалось выдать реквизиты для этой заявки. Ничего не отправлено.',
  'You cancelled this order before the wire was received.': 'Вы отменили заявку до получения перевода.',
  'You told us you sent the wire. We will update this order when the wire is received; your report alone does not confirm a payment.':
    'Вы сообщили, что отправили перевод. Мы обновим заявку, когда перевод поступит; ваше сообщение само по себе не подтверждает оплату.',
  'No wire was received before the deadline. The quote has expired.': 'Перевод не поступил до окончания срока. Котировка истекла.',
  'Your wire was received. It is being matched to this order and checked.':
    'Ваш перевод получен. Он сопоставляется с заявкой и проверяется.',
  'A wire arrived after the window closed. It cannot be exchanged at the quoted rate and will be reviewed for return.':
    'Перевод поступил после закрытия окна. Его нельзя обменять по зафиксированному курсу; он будет рассмотрен для возврата.',
  'A wire arrived for an order that was already closed. It will be reviewed for return.':
    'Перевод поступил по уже закрытой заявке. Он будет рассмотрен для возврата.',
  'The wire received differs from the quoted amount. It cannot be exchanged at the quoted rate and will be reviewed for return.':
    'Сумма перевода отличается от котировки. Его нельзя обменять по зафиксированному курсу; он будет рассмотрен для возврата.',
  'Your wire was matched to this order and matches the quote.': 'Ваш перевод сопоставлен с заявкой и совпадает с котировкой.',
  'We could not complete this exchange. Your wire will be returned to the sending account under Section 9 of the Service Rules, which sets the return fees.':
    'Мы не смогли завершить обмен. Ваш перевод будет возвращён на счёт отправителя по разделу 9 Правил сервиса, который устанавливает комиссии за возврат.',
  'A return of your wire to the sending account has been started.': 'Начат возврат вашего перевода на счёт отправителя.',
  'Your wire was returned to the sending account.': 'Ваш перевод возвращён на счёт отправителя.',
};
