# Подключение WhatsApp Business Platform

Интерфейс Meta меняется; названия разделов ниже — на момент выпуска набора. Официальная инструкция: Meta for Developers → WhatsApp → Get started.

## 1. Приложение

1. developers.facebook.com → My Apps → Create app → тип Business. Привяжите своё бизнес-портфолио (Business Manager).
2. Добавьте продукт **WhatsApp**.
3. В WhatsApp → API Setup Meta выдаёт тестовый номер — им можно проверить бота на своём телефоне (добавьте его в список получателей).

## 2. Свой номер

1. WhatsApp → API Setup → Add phone number. Имя для отображения должно соответствовать бизнесу.
2. Номер подтверждается кодом из SMS или звонка.
3. Номер, подключённый к Cloud API, нельзя одновременно использовать в приложении WhatsApp на телефоне. Если номер сейчас в приложении, удалите аккаунт в приложении или возьмите новый номер.
4. Подтвердите бизнес в Business Manager (Business verification), чтобы снять ограничения на число новых клиентов в сутки.

## 3. Что понадобится для n8n

| Что | Где взять | Куда вписать |
|---|---|---|
| Phone number ID | WhatsApp → API Setup, под номером | Config → `phone_number_id` |
| Постоянный токен | Business Settings → Users → System users → добавить системного пользователя (Admin) → Add assets: приложение и аккаунт WhatsApp → Generate new token, разрешения `whatsapp_business_messaging`, `whatsapp_business_management` | Учётные данные «WhatsApp token» |
| App Secret | App settings → Basic → App secret → Show | Учётные данные «WhatsApp App Secret» |
| Verify token | Придумайте сами: случайная строка | Config → `verify_token` и поле Verify token в Meta |

Временный токен со страницы API Setup живёт 24 часа — для работы не подходит.

## 4. Вебхук

1. Включите воркфлоу «Bot» в n8n.
2. WhatsApp → Configuration → Webhook → Edit:
   - Callback URL — Production URL узла **WhatsApp Webhook** (вида `https://ваш-n8n/webhook/whatsapp`);
   - Verify token — значение `verify_token` из Config.
3. Verify and save. Meta отправит GET-запрос; узел **Verify** ответит, если токен совпал.
4. Webhook fields → `messages` → Subscribe.

## 5. Версия Graph API

В Config — `graph_api_base: https://graph.facebook.com/v25.0`. Каждая версия Graph API работает около двух лет. Когда Meta объявит о прекращении поддержки, замените номер версии на актуальный — больше ничего менять не нужно.

## Правила WhatsApp, которые важно знать

- **Первым писать нельзя без шаблона.** Бот только отвечает тем, кто написал сам.
- **24 часа.** Свободные сообщения — только в течение 24 часов после последнего сообщения клиента.
- **Отписка.** Клиент должен иметь возможность перестать получать сообщения — «стоп» работает из коробки.
- **Качество номера.** Если клиенты блокируют номер или жалуются, Meta снижает рейтинг и лимиты. Не превращайте бота в рассылку.
- **Политика коммерции.** Некоторые категории товаров в WhatsApp запрещены — проверьте WhatsApp Business Commerce Policy.
