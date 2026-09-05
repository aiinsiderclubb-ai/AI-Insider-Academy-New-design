# Linting

`npm run lint` runs [oxlint](https://oxc.rs), not ESLint.

## Why not ESLint

`next lint` was removed in Next 16, so ESLint would have to be invoked
directly. Every ESLint route into a `.ts`/`.tsx` file goes through
`typescript-eslint`, and that package refuses to load against TypeScript 7 —
this project's version — with:

```
typescript-eslint does not support TS 7.0.
```

That covers `eslint-config-next` too, which depends on it. `@typescript-eslint/parser`
throws the same error at import time, so there is no partial setup that works
either. oxlint parses TS and TSX itself, has no TypeScript dependency at all,
and ships the Next.js, React, React-hooks, import and jsx-a11y rulesets.

Move back to `eslint-config-next` once typescript-eslint supports TS 7 —
[typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)
tracks it.

## What fails a build

The `correctness` category is an error and fails; `suspicious` and `perf` are
warnings that stay visible. `pedantic` and `style` are off — this is a linter
for defects, and formatting is not one.

Type-level correctness is `npm run typecheck`, not the linter.

## Rules demoted to `warn`, and why

Each of these fires on a pattern the codebase uses deliberately. They are kept
visible rather than switched off, so a genuine instance still shows up in the
output.

| Rule | Why it is not an error here |
| --- | --- |
| `react/set-state-in-effect` | The DOM, `localStorage` and `matchMedia` are unknowable to a server render, so the first client paint corrects itself on purpose — the theme toggle, the sticky header, the scroll rail. |
| `react/immutability` | `document.cookie = …` inside an event handler reads to the rule as mutating an outer binding. Real render-phase mutation still surfaces. |
| `react/refs` | Passing a ref object — not `.current` — into a render prop is `Popover`'s intended API. |
| `jsx-a11y/click-events-have-key-events`, `jsx-a11y/no-noninteractive-element-interactions` | `<dialog onClick>` closing on a backdrop hit is the canonical pattern; Esc is handled by `onCancel`, and `<dialog>` is natively interactive. |
| `jsx-a11y/label-has-associated-control`, `jsx-a11y/control-has-associated-label` | Fire on labels and `<summary>` elements whose text sits in nested spans. |
| `jsx-a11y/interactive-supports-focus` | Focus belongs on the tabs via roving `tabIndex`, not on the `tablist` container. |
| `jsx-a11y/prefer-tag-over-role` | The roles sit on spans and divs that carry their own styling; the semantic element would drag in UA styling the design does not want. |
| `jsx-a11y/no-autofocus` | The admin login field is the only control on its screen. |
| `jsx-a11y/media-has-caption` | Course trailers have no caption files yet. Left as a warning so it is not forgotten once subtitles exist. |

## Rules switched off

| Rule | Why |
| --- | --- |
| `react/react-in-jsx-scope` | The automatic JSX transform means React is never in scope by name. |
| `react/no-unescaped-entities` | Cyrillic copy is full of quotes and apostrophes; escaping them would make the dictionaries unreadable to the people who translate them. |
| `unicorn/no-array-sort` | Every `.sort()` in the codebase runs on an array just produced by `map`/`filter`/spread, so there is nothing to mutate. Re-enable if a raw fetched array is ever sorted in place — that one *would* corrupt the data cache. |
