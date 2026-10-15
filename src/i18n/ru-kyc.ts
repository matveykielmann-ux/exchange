/** Russian: identity verification by documents (customer page, CRM review, server messages). */
export const RU_KYC: Record<string, string> = {
  // Domain labels
  'Driver’s license': 'Водительское удостоверение',
  'State ID': 'State ID (удостоверение штата)',
  Passport: 'Паспорт',
  'Front of the ID': 'Лицевая сторона документа',
  'Back of the ID': 'Обратная сторона документа',
  Selfie: 'Селфи',
  'Proof of address': 'Подтверждение адреса',

  // Customer page
  'Not verified': 'Не подтверждена',
  'In review': 'На проверке',
  Verified: 'Подтверждена',
  'More information needed': 'Нужна дополнительная информация',
  'Not approved': 'Не одобрена',
  'The side with your photo. All four corners visible, no glare, every word readable.':
    'Сторона с фотографией. Видны все четыре угла, нет бликов, весь текст читается.',
  'The other side of the same card, including the barcode.': 'Другая сторона того же документа, включая штрихкод.',
  'A clear photo of your face in good light, without sunglasses or a hat. JPEG or PNG.':
    'Чёткое фото вашего лица при хорошем освещении, без солнцезащитных очков и головного убора. JPEG или PNG.',
  'A recent utility bill, bank or card statement, or government letter showing your full name and residential address.':
    'Недавний счёт за коммунальные услуги, выписка из банка или по карте либо письмо госоргана, где указаны ваше полное имя и адрес проживания.',
  'Upload a JPEG or PNG file.': 'Загрузите файл JPEG или PNG.',
  'The file is larger than 8 MB. Use a smaller photo or scan.': 'Файл больше 8 МБ. Используйте фото или скан меньшего размера.',
  'The file’s contents don’t match its type. Upload a JPEG or PNG file.':
    'Содержимое файла не соответствует его типу. Загрузите файл JPEG или PNG.',
  'Open the PDF': 'Открыть PDF',
  View: 'Посмотреть',
  'Replace the file': 'Заменить файл',
  'Choose a file': 'Выберите файл',
  'Document upload is not available yet: document storage is not connected.':
    'Загрузка документов пока недоступна: хранилище документов не подключено.',
  'Service Rules, clause 8.1: verification may include an identification document (passport, ID card, driver’s license) and a selfie for identity confirmation. We also ask for a proof of address.':
    'Правила сервиса, п. 8.1: верификация может включать документ, удостоверяющий личность (паспорт, ID-карта, водительское удостоверение), и селфи для подтверждения личности. Мы также просим подтверждение адреса.',
  'Sandbox: use test images, not real documents': 'Тестовая среда: используйте тестовые изображения, а не настоящие документы',
  'Files are checked and kept encrypted in the sandbox database. A reviewer approves or rejects them in the CRM. A name containing “Sanctioned” fails screening.':
    'Файлы проверяются и хранятся в зашифрованном виде в тестовой базе данных. Проверяющий одобряет или отклоняет их в CRM. Имя, содержащее «Sanctioned», не проходит санкционную проверку.',
  'Your identity is verified': 'Ваша личность подтверждена',
  'You can place exchanges.': 'Вы можете оформлять обмены.',
  'Start an exchange': 'Начать обмен',
  'Your documents are being reviewed': 'Ваши документы на проверке',
  'Sent {0}. We will notify you by email and in your account when the review is finished.':
    'Отправлено {0}. Мы сообщим по email и в личном кабинете, когда проверка завершится.',
  'Reviewer’s note:': 'Комментарий проверяющего:',
  'Replace the files the note mentions, then send them for review again.':
    'Замените файлы, о которых говорится в комментарии, и отправьте их на проверку снова.',
  '1. Choose your photo ID': '1. Выберите документ с фотографией',
  'Type of ID': 'Тип документа',
  'The photo page': 'Страница с фотографией',
  'Front and back': 'Лицевая и обратная сторона',
  '2. Upload your documents': '2. Загрузите документы',
  'Your documents': 'Ваши документы',
  'Files are encrypted when stored. Only you and our verification reviewers can open them.':
    'Файлы хранятся в зашифрованном виде. Открыть их можете только вы и наши сотрудники, проверяющие документы.',
  'Send for review': 'Отправить на проверку',
  'Sending…': 'Отправка…',
  'Still needed: {0}': 'Ещё нужно: {0}',
  'Uploading…': 'Загрузка…',

  // Account section and exchange notice
  'Sandbox: upload test images, not real documents. A reviewer decides in the CRM.':
    'Тестовая среда: загружайте тестовые изображения, а не настоящие документы. Решение принимает проверяющий в CRM.',
  'Verify my identity': 'Подтвердить личность',
  'Update my documents': 'Обновить документы',
  'View my documents': 'Мои документы',
  'Verify your identity before your first exchange: upload a photo ID, a selfie and a proof of address. You only need to do this once.':
    'Подтвердите личность перед первым обменом: загрузите документ с фотографией, селфи и подтверждение адреса. Это нужно сделать один раз.',
  'Our team is reviewing your documents. We will notify you when the review is finished.':
    'Наша команда проверяет ваши документы. Мы сообщим, когда проверка завершится.',
  'Our team needs more information to finish verifying you. Open your documents to see the reviewer’s note.':
    'Нам нужна дополнительная информация, чтобы завершить проверку. Откройте документы, чтобы увидеть комментарий проверяющего.',
  'Identity verification is required before an exchange (Service Rules, Section 8): a photo ID, a selfie and a proof of address. Additional documents may be requested for a transaction classified as high-risk.':
    'Перед обменом нужно подтвердить личность (Правила сервиса, раздел 8): документ с фотографией, селфи и подтверждение адреса. Для операции с высоким уровнем риска могут запросить дополнительные документы.',
  'You can confirm the exchange once our team approves your verification. We will notify you when the review is finished.':
    'Вы сможете подтвердить обмен, когда наша команда одобрит верификацию. Мы сообщим, когда проверка завершится.',
  'Open your documents to see the reviewer’s note. You can confirm the exchange once verification is complete.':
    'Откройте документы, чтобы увидеть комментарий проверяющего. Подтвердить обмен можно после завершения верификации.',

  // CRM
  'Photo ID, selfie and proof of address sent by customers. Every decision needs a reason and is written to the audit log.':
    'Документы с фото, селфи и подтверждения адреса от клиентов. Каждое решение требует причины и записывается в журнал аудита.',
  'Waiting for review': 'Ждёт проверки',
  'More information requested': 'Запрошена информация',
  Approved: 'Одобрена',
  Rejected: 'Отклонена',
  Draft: 'Черновик',
  'Nothing here.': 'Здесь пока пусто.',
  Files: 'Файлы',
  'Open full size': 'Открыть в полном размере',
  Decision: 'Решение',
  Approve: 'Одобрить',
  'Approve verification': 'Одобрить верификацию',
  'The customer can place exchanges.': 'Клиент сможет оформлять обмены.',
  'Ask for more information': 'Запросить информацию',
  'Send the request': 'Отправить запрос',
  'The customer sees this note and can replace files.': 'Клиент увидит этот комментарий и сможет заменить файлы.',
  Reject: 'Отклонить',
  'Reject verification': 'Отклонить верификацию',
  'Final. The customer can’t place exchanges.': 'Окончательно. Клиент не сможет оформлять обмены.',
  'Note to the customer (also recorded in the audit log)': 'Комментарий для клиента (также записывается в журнал аудита)',
  'All verifications': 'Все верификации',
  'Test documents': 'Тестовые документы',
  'Customer profile': 'Профиль клиента',
  Phone: 'Телефон',
  Email: 'Email',
  'Account created': 'Аккаунт создан',
  'Sent for review': 'Отправлено на проверку',
  Reviewed: 'Проверено',
  Reason: 'Причина',
  'Earlier submissions: {0}': 'Предыдущие заявки: {0}',
  Documents: 'Документы',
  'Each view is recorded in the audit log': 'Каждый просмотр записывается в журнал аудита',
  'Decided: {0}': 'Решение: {0}',
  'The customer can replace files and send them again.': 'Клиент может заменить файлы и отправить их снова.',

  // Server messages
  'We could not verify your identity. Contact support if you think this is a mistake.':
    'Мы не смогли подтвердить вашу личность. Если считаете это ошибкой, напишите в поддержку.',
  'Your documents are being reviewed. You can change them if we ask for more information.':
    'Ваши документы на проверке. Изменить их можно, если мы запросим дополнительную информацию.',
  'Choose the type of ID first.': 'Сначала выберите тип документа.',
  'A passport needs only the photo page.': 'Для паспорта нужна только страница с фотографией.',
  'Upload every document before you send them for review.': 'Загрузите все документы перед отправкой на проверку.',
  'File not found.': 'Файл не найден.',
  'Verification not found.': 'Верификация не найдена.',
  'This verification has already been decided.': 'По этой верификации уже принято решение.',
  'You cannot review your own verification.': 'Нельзя проверять собственную верификацию.',
};
