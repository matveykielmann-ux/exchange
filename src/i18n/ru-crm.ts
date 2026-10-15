/** Russian: the simplified CRM (order queue, order card, action dialogs). */
export const RU_CRM: Record<string, string> = {
  Work: 'Работа',
  Administration: 'Администрирование',
  Statistics: 'Статистика',
  'Created {0}': 'Создана {0}',
  'Updated {0}': 'Обновлена {0}',
  Essentials: 'Главное',
  'Customer sends': 'Клиент отправляет',
  'Customer receives': 'Клиент получает',
  'spread {0} · {1} {2}': 'спред {0} · {1} {2}',
  courier: 'курьер',
  payout: 'выплата',
  'More actions': 'Другие действия',
  More: 'Ещё',
  Template: 'Шаблон',
  'Message the customer will receive': 'Сообщение, которое получит клиент',
  'It appears in the customer’s support messages for this order, with an account notification. In the sandbox no email is sent.':
    'Оно появится в сообщениях поддержки клиента по этой заявке, вместе с уведомлением в аккаунте. В тестовой среде email не отправляется.',
  'Comment (optional)': 'Комментарий (необязательно)',
  'Me ({0})': 'Я ({0})',
  'Note for the team (never shown to the customer)': 'Заметка для команды (клиент её не видит)',
  'Customer and operation': 'Клиент и операция',
  '{0} of {1} orders completed': 'выполнено заявок: {0} из {1}',
  Deposit: 'Депозит',
  '{0} of {1} confirmations': '{0} из {1} подтверждений',
  'Not received yet': 'Ещё не получен',
  'Format checked only, not proof of deposit': 'Проверен только формат — это не подтверждение депозита',
  Notification: 'Уведомление',
  read: 'прочитано',
  History: 'История',
  'Show all {0} entries': 'Показать все записи ({0})',
  'More details: payments, reviews, conversations, audit': 'Подробнее: платежи, проверки, переписка, аудит',
  'Payout attempt {0}': 'Попытка выплаты {0}',
  'Orders waiting on you come first. Open an order to see it and act on it.':
    'Сначала заявки, которые ждут вашего действия. Откройте заявку, чтобы посмотреть и обработать её.',
  'Quick filters': 'Быстрые фильтры',
  'Order number, customer email or name': 'Номер заявки, email или имя клиента',
  Filters: 'Фильтры',
  'Needs action first': 'Сначала требующие действий',
  'System (automatic)': 'Система',

  // Quick views and row steps
  'Needs action': 'Требуют обработки',
  'Awaiting payment': 'Ожидают оплаты',
  'Orders in progress': 'В обработке',
  'Completed orders': 'Завершены',
  'Rejected or cancelled': 'Отклонены и отменены',
  'Review order': 'Проверить',
  'Confirm payout': 'Подтвердить выплату',
  'Send to payout provider': 'Отправить провайдеру выплаты',
  'Record manual payout': 'Записать ручную выплату',
  'The payout instruction is sent to the configured payout provider. The order is completed only when that provider reports the payout as done.':
    'Инструкция на выплату отправляется настроенному провайдеру. Заявка завершается только когда провайдер подтвердит выплату.',
  'Records that the payout was completed through an explicit operational procedure (not a provider webhook). Requires a reason and an evidence reference. This is marked as operator-recorded, not provider-verified.':
    'Фиксирует, что выплата завершена по явной операционной процедуре (не webhook провайдера). Нужны причина и ссылка на доказательство. Это запись оператора, а не подтверждение провайдера.',
  'Payout instruction sent to the payout provider.': 'Инструкция на выплату отправлена провайдеру.',
  'Manual payout recorded with evidence. Marked as operator-recorded, not provider-verified.':
    'Ручная выплата записана с доказательством. Отмечено как запись оператора, не подтверждение провайдера.',
  'Waiting for deposit instructions (provider configuration)': 'Ожидание инструкций для депозита (настройка провайдера)',
  'Waiting for the customer’s crypto deposit': 'Ожидание криптодепозита от клиента',
  'Provide an evidence reference (at least 4 characters).': 'Укажите ссылку на доказательство (не менее 4 символов).',
  'This marks the payout as completed with an operator-recorded confirmation. It is not a provider-verified completion. Use only when you have reliable evidence.':
    'Это отмечает выплату как завершённую по записи оператора. Это не подтверждение провайдера. Используйте только при надёжных доказательствах.',
  'Evidence reference': 'Ссылка на доказательство',
  'Bank ref, receipt id, or desk log id': 'Банковский референс, ID квитанции или запись журнала',
  'Evidence notes (internal, optional)': 'Заметки по доказательствам (внутренние, необязательно)',
  'Resolve payout': 'Разобрать выплату',
  'Check refund': 'Проверить возврат',

  // Actions
  Confirm: 'Подтвердить',
  Reject: 'Отклонить',
  'Request information': 'Запросить информацию',
  'Send notification': 'Отправить уведомление',
  'Put on hold': 'Приостановить',
  'Release hold': 'Снять приостановку',
  'Send to compliance review': 'Отправить на проверку комплаенса',
  'Retry payout': 'Повторить выплату',
  'Start refund': 'Начать возврат',
  'Resubmit refund to provider': 'Повторно отправить возврат провайдеру',
  Assign: 'Назначить',
  'Add internal note': 'Добавить внутреннюю заметку',
  'The review is approved and the order moves to payout. Payout still needs its own confirmation.':
    'Проверка одобрена, заявка переходит к выплате. Выплату нужно будет подтвердить отдельно.',
  'The payout instruction is sent to the payout provider. The order is completed only when the provider reports the payout as done.':
    'Поручение на выплату отправляется платёжному провайдеру. Заявка будет выполнена, только когда провайдер сообщит о выплате.',
  'The order is rejected. If the customer’s funds were already received, a refund is started under Section 9 of the Service Rules.':
    'Заявка будет отклонена. Если средства клиента уже получены, начнётся возврат по разделу 9 Правил сервиса.',
  'Nothing moves this order toward a payout until the hold is released. Provider reports are still recorded.':
    'Пока заявка приостановлена, она не продвигается к выплате. Сообщения провайдеров по-прежнему записываются.',
  'Processing continues from the current status.': 'Обработка продолжится с текущего статуса.',
  'The order goes to compliance review before any payout.': 'Перед выплатой заявка пройдёт проверку комплаенса.',
  'The order goes back to “ready for payout”; confirm the payout again to resend it.':
    'Заявка вернётся в статус «Готово к выплате»; подтвердите выплату ещё раз, чтобы отправить её.',
  'A refund of the received funds is started instead of a payout.': 'Вместо выплаты будет начат возврат полученных средств.',
  'The refund instruction is sent to the provider again with the same idempotency key.':
    'Поручение на возврат будет отправлено провайдеру повторно с тем же ключом идемпотентности.',
  'Review completed, checks passed.': 'Проверка завершена, всё в порядке.',
  'Deposit final and checks complete.': 'Депозит подтверждён, проверки завершены.',
  'Checks completed.': 'Проверки завершены.',
  'Retrying after the provider failure.': 'Повтор после сбоя провайдера.',
  'Resubmitting the refund.': 'Повторная отправка возврата.',
  'Verification or compliance checks not passed': 'Не пройдена проверка личности или комплаенса',
  'The amount received does not match the order': 'Полученная сумма не совпадает с заявкой',
  'No payment received': 'Оплата не поступила',
  'At the customer’s request': 'По просьбе клиента',
  Other: 'Другое',

  // Results
  'Confirmed. The order moved on to payout.': 'Подтверждено. Заявка перешла к выплате.',
  'Payout confirmed and sent to the payout provider.': 'Выплата подтверждена и отправлена платёжному провайдеру.',
  'The order was rejected.': 'Заявка отклонена.',
  'The request was sent to the customer’s messages.': 'Запрос отправлен в сообщения клиента.',
  'The message was sent to the customer’s messages and account notifications.':
    'Сообщение отправлено клиенту в сообщения поддержки и уведомления аккаунта.',
  'The order is on hold.': 'Заявка приостановлена.',
  'The hold was released.': 'Приостановка снята.',
  'The order was sent to compliance review.': 'Заявка отправлена на проверку комплаенса.',
  'The payout will be retried.': 'Выплата будет повторена.',
  'The refund was started.': 'Возврат начат.',
  'The refund was sent to the provider again.': 'Возврат повторно отправлен провайдеру.',
  'Assignment saved.': 'Назначение сохранено.',
  'Note added.': 'Заметка добавлена.',
  'Done.': 'Готово.',
  'This order changed while you were looking at it. It has been reloaded; check it and try again.':
    'Заявка изменилась, пока вы её просматривали. Данные обновлены — проверьте и повторите.',

  // Waiting states
  'Waiting for the customer’s payment': 'Ждём оплату от клиента',
  'Waiting for network confirmations': 'Ждём подтверждений сети',
  'Automatic checks are running': 'Идут автоматические проверки',
  'Waiting for the payout provider': 'Ждём платёжного провайдера',
  'Waiting for the refund provider': 'Ждём провайдера возврата',
  'Completed. Nothing to do.': 'Выполнена. Действий не требуется.',
  'Refunded. Nothing to do.': 'Средства возвращены. Действий не требуется.',
  'Rejected. Nothing to do.': 'Отклонена. Действий не требуется.',
  'Cancelled by the customer. Nothing to do.': 'Отменена клиентом. Действий не требуется.',
  'Expired: no payment arrived in time. Nothing to do.': 'Истекла: оплата не поступила вовремя. Действий не требуется.',

  // Notification delivery
  'recorded (sandbox: no email sent)': 'записано (тест: email не отправлялся)',
  'email queued': 'email в очереди',
  'email sent': 'email отправлен',
  'email failed': 'ошибка отправки email',
  'email not configured: account only': 'email не настроен: только в аккаунте',

  // Message templates
  'Order on hold': 'Заявка приостановлена',
  'Your order {ref} is on hold while our team checks it. We will contact you if we need anything.':
    'Ваша заявка {ref} приостановлена, пока наша команда её проверяет. Если что-то понадобится, мы свяжемся с вами.',
  'Payment reminder': 'Напоминание об оплате',
  'We are still waiting for the payment for order {ref}. Send exactly the amount shown on the order page, on the network shown, before the window closes.':
    'Мы всё ещё ждём оплату по заявке {ref}. Отправьте ровно сумму, указанную на странице заявки, в указанной сети, до закрытия окна.',
  'Payment received': 'Оплата получена',
  'We have received the payment for order {ref}. It is being checked; we will update you when the payout is sent.':
    'Мы получили оплату по заявке {ref}. Она проверяется; мы сообщим, когда выплата будет отправлена.',
  'Payout in progress': 'Выплата обрабатывается',
  'The payout for order {ref} is being processed. Timing is an estimate, not a guarantee.':
    'Выплата по заявке {ref} обрабатывается. Сроки ориентировочные и не гарантируются.',
  'Order completed': 'Заявка выполнена',
  'Order {ref} is completed. Thank you for using CryptoBit Exchange.': 'Заявка {ref} выполнена. Спасибо, что выбрали CryptoBit Exchange.',
  'Order not completed': 'Заявка не выполнена',
  'We could not complete order {ref}. Contact us on Telegram or in your messages for details.':
    'Нам не удалось выполнить заявку {ref}. Подробности — в Telegram или в сообщениях на сайте.',
  'Custom message': 'Своё сообщение',
  'Not given yet. Asked for only if a refund is needed.': 'Ещё не указан. Запрашивается, только если нужен возврат.',
  'Waiting for the customer’s refund address': 'Ждём адрес для возврата от клиента',
  'Waiting for the customer’s refund address.': 'Ждём адрес для возврата от клиента.',
};
