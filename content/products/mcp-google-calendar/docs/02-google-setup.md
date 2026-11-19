# Настройка Google

## Права, которые запрашивает сервер

| Право | Зачем |
|---|---|
| `https://www.googleapis.com/auth/calendar.events` | читать и создавать события |
| `https://www.googleapis.com/auth/calendar.freebusy` | видеть занятость календарей |

Сервер не просит `.../auth/calendar` — полный доступ с удалением календарей и сменой доступа ему не нужен.

## OAuth-клиент

1. console.cloud.google.com → проект → APIs & Services → Library → Google Calendar API → Enable.
2. Google Auth Platform → Branding: название приложения и ваш email.
3. Audience:
   - **Internal** — если календарь в Google Workspace вашей компании; refresh token не истекает через 7 дней;
   - **External** — для обычного аккаунта Gmail. Добавьте свой адрес в Test users.
4. Data Access → Add or remove scopes → два права из таблицы выше.
5. Clients → Create client → **Desktop app**. Client ID и Client secret — в переменные `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET`.

## Срок жизни доступа

У External-приложения в статусе **Testing** Google отзывает refresh token через 7 дней. Сервер в этом случае ответит агенту «Google не выдал доступ… refresh token живёт 7 дней».

Чтобы доступ не истекал: Audience → **Publish app** (In production). Для приложения, которым пользуетесь только вы, проверка Google не обязательна. При входе Google покажет «Google hasn't verified this app» → Advanced → Go to … — это ваше собственное приложение. Затем получите refresh token заново.

Refresh token также перестаёт работать, если вы отозвали доступ на myaccount.google.com/permissions или не пользовались им 6 месяцев.

## get_refresh_token.py

```bash
GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... python3 server/get_refresh_token.py
```

- Запускает временный сервер на `127.0.0.1` на случайном порту и открывает страницу входа Google.
- Использует PKCE (S256) и проверку `state`.
- Обменивает код на токены и печатает `GOOGLE_REFRESH_TOKEN`. Токен никуда, кроме Google, не отправляется и на диск не пишется.

На сервере без браузера: запустите скрипт на своём компьютере, а refresh token перенесите на сервер как переменную окружения.

## Несколько календарей

- Пишет сервер в один календарь — `calendar_id`.
- Занятость учитывается по всем `busy_calendars`. Аккаунт, который выдал доступ, должен видеть эти календари: свои — да, чужие — если владелец открыл вам доступ хотя бы к «Показывать только занятость».
- ID календаря: Настройки → нужный календарь → Интеграция календаря → Идентификатор календаря.
