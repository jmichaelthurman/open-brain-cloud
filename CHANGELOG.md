# Changelog

## 1.0.0 (2026-03-15)


### Features

* add stdio proxy for Claude Desktop integration and update build scripts ([59227f0](https://github.com/jmichaelthurman/open-brain-cloud/commit/59227f046354be2950b5e4271057eda63fc02b5f))
* **auth:** add Supabase Auth with hybrid JWT + static API key ([e2216d5](https://github.com/jmichaelthurman/open-brain-cloud/commit/e2216d5ac1a9445cca01060689400cff157f98ac))
* initial implementation of open-brain-cloud MCP server ([974ed3c](https://github.com/jmichaelthurman/open-brain-cloud/commit/974ed3cba875fde75dfcd6effae7596863d25a09))
* **mcp:** add get_thought tool — lookup by UUID ([#5](https://github.com/jmichaelthurman/open-brain-cloud/issues/5)) ([26fe2e9](https://github.com/jmichaelthurman/open-brain-cloud/commit/26fe2e9d9af194416c65ff16851309986c7e4ee9))
* **mobile:** add POST /capture REST endpoint for iOS Shortcuts ([#1](https://github.com/jmichaelthurman/open-brain-cloud/issues/1)) ([e50067f](https://github.com/jmichaelthurman/open-brain-cloud/commit/e50067f5e699db44394beb450573a33a1ede6b03))
* **mobile:** add web page content capture shortcut with Safari Reader ([46fc911](https://github.com/jmichaelthurman/open-brain-cloud/commit/46fc911be8d22b6d520e13868fb502a14b387c23))
* **mobile:** add web page content capture shortcut with Safari Reader ([3402eef](https://github.com/jmichaelthurman/open-brain-cloud/commit/3402eef711e69ecb3733a45fb1db8a80af4bc09d))


### Bug Fixes

* **auth:** fail fast on missing SERVICE_ACCOUNT_USER_ID and use JWT structure detection ([b03d6bc](https://github.com/jmichaelthurman/open-brain-cloud/commit/b03d6bcda2057777501b9d4b695f2aed2610dae2))
* **capture:** accept form-urlencoded and fix OpenRouter model slug ([b692529](https://github.com/jmichaelthurman/open-brain-cloud/commit/b692529ba33e14569c2c5d4a1d84f8286dca2be7))
* parse Supabase pooler URL manually to preserve dotted username ([8be4634](https://github.com/jmichaelthurman/open-brain-cloud/commit/8be4634ef61069ba923a963309f3f71b3be1e71f))
* **scripts:** update backfill for actual local schema (BIGSERIAL ids, vector(768)) ([33d635c](https://github.com/jmichaelthurman/open-brain-cloud/commit/33d635c9fdaa873a623a8bd4b21376d9f6fe2edf))
* **tooling:** address Copilot review findings on pre-commit hooks ([71e7338](https://github.com/jmichaelthurman/open-brain-cloud/commit/71e7338aaa48dcd15b793bb64e123c35d62f0a24))
