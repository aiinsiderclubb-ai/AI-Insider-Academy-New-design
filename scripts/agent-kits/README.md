# Agent kit builders

Sources of the store's AI-agent products (`content/products/<slug>`). Not shipped to buyers.

- `nk.py` — workflow builder: nodes, connections, agent tools (one definition → n8n Workflow Tool node + OpenAI and Anthropic schemas), the test variant that points Google and Telegram at the mock.
- `mock.cjs` — one fake for everything a kit calls: OpenAI chat completions and Anthropic messages with scripted tool calls, embeddings, Google Sheets values API, Google Calendar, Telegram. Control endpoints are listed at the top of the file.
- `stand.py` — throwaway n8n (`npx -p node@24 -p n8n@2.48.6`) with the test variants imported and published.
- `flatted.py` — reads n8n's stored execution data when a run fails.
- `common/` — helpers inlined into Code nodes (`// @include text.js`) and the evals runner copied into each kit.
- `<kit>/build.py` writes the product's workflows and tool schemas from `<kit>/js/*.js` and the prompt in the product folder; `<kit>/e2e.py` runs the kit end to end.

```bash
python3 scripts/agent-kits/support/build.py      # rebuild the workflow after editing js/ or the prompt
python3 scripts/agent-kits/support/e2e.py        # end to end in a local n8n (a few minutes)
npm run pack:products && npx vitest run          # repack and run the unit tests
```

`KEEP_STAND=1` keeps the stand's folder (database, logs) for inspection.
