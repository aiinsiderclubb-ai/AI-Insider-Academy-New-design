# Постоянное хранилище вместо памяти n8n

По умолчанию индекс лежит в Simple Vector Store — в памяти процесса n8n. Это работает без отдельной базы, но:

- после перезапуска или обновления n8n индекс пуст, пока не пройдёт переиндексация (ночная или по запросу);
- в режиме очереди (queue mode) у каждого воркера своя память, и вопросы попадают в пустой индекс;
- большие базы (тысячи документов) занимают память сервера n8n.

Если хоть одно из этого про вас — переведите индекс в Qdrant, PGVector или Supabase. Важно: этот переход мы не запускали на стенде — ниже порядок действий по описанию узлов n8n 2.48. После перехода обязательно прогоните evals.

## Что меняется в воркфлоу

Меняются только два узла: **Search Index** (режим Load) и **Insert Index** (режим Insert). Embeddings, Document Loader, Text Splitter, Rank Passages и всё остальное остаются: узлы векторных хранилищ n8n отдают найденные фрагменты в одном формате.

Одна разница: у Simple Vector Store есть «Clear Store» — очистка перед вставкой. У Qdrant, PGVector и Supabase такой опции в узле нет, поэтому перед Insert Index нужен узел, который удаляет старые фрагменты. Пока идёт вставка (секунды–минуты), поиск может находить не всё — запускайте переиндексацию ночью.

## Qdrant

1. Создайте кластер в Qdrant Cloud (или поднимите Qdrant у себя) и ключ API. В n8n — ключ типа Qdrant.
2. Замените **Search Index** на **Qdrant Vector Store**, режим *Get Many*, коллекция `kb_main`, Prompt `{{ $json.input.query }}`, Limit `{{ $('Config').first().json.config.search_top_k }}`, Include Metadata — да. Подключите к нему **Embeddings**. Включите в Settings узла *Always Output Data*.
3. Замените **Insert Index** на **Qdrant Vector Store**, режим *Insert Documents*, та же коллекция. Подключите **Document Loader** и **Embeddings**.
4. Между **Abort?** (выход false) и новым Insert вставьте HTTP Request **Clear Collection**: `DELETE https://ВАШ-QDRANT/collections/kb_main`, заголовок `api-key`. Узел вставки создаст коллекцию заново. Settings → On Error → Continue (если коллекции ещё нет, Qdrant ответит ошибкой).

## PGVector (свой Postgres или Postgres в Supabase)

1. В базе нужно расширение pgvector (`CREATE EXTENSION IF NOT EXISTS vector;`). Ключ n8n — Postgres.
2. Замените оба узла на **Postgres PGVector Store** с одной таблицей, например `kb_chunks`.
3. Перед Insert поставьте узел Postgres: *Execute Query* → `DELETE FROM kb_chunks;`.

## Supabase Vector Store

Нужна таблица и функция поиска в Supabase — SQL есть в документации узла n8n «Supabase Vector Store». Перед вставкой — удаление строк таблицы (узел Supabase, *Delete* по условию, или узел Postgres с `DELETE FROM documents;`).

## Удаление одного документа без полной переиндексации

В постоянном хранилище можно удалять фрагменты по метаданным: у каждого фрагмента есть `source_id` (`drive:ID_ФАЙЛА` или `url:АДРЕС`). Для Qdrant — `POST /collections/kb_main/points/delete` с фильтром по `metadata.source_id`, для PGVector — `DELETE FROM kb_chunks WHERE metadata->>'source_id' = '…'`. Набор этого не делает: по умолчанию удалённый из папки документ исчезает при следующей переиндексации.
