import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("production build packages release assets", async () => {
  await Promise.all([
    access(new URL("../dist/server/index.js", import.meta.url)),
    access(new URL("../dist/client", import.meta.url)),
    access(new URL("../dist/.openai/hosting.json", import.meta.url)),
    access(new URL("../dist/.openai/drizzle", import.meta.url)),
  ]);
});

test("web app sources describe the ToTalk v1 product", async () => {
  const [page, layout, app, iceRoute, healthRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ToTalkApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/voice/ice/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/health/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /title:\s*"ToTalk — общение без границ"/);
  assert.match(page, /ToTalk запускается/);
  assert.match(page, /С возвращением/);
  assert.match(app, /voiceChannels:\s*\["Голосовой"\]/);
  assert.doesNotMatch(app, /Клуб|Игровая|Музыка|Лобби|Комната отдыха/);
  assert.match(iceRoute, /TURN_SECRET/);
  assert.match(iceRoute, /Требуется вход/);
  assert.match(healthRoute, /service:\s*"totalk"/);
  assert.match(healthRoute, /d1Configured/);
});

test("release docs and desktop shell are configurable for deployment", async () => {
  const [readme, desktopMain, hostingConfig, wranglerConfig, packageJson] = await Promise.all([
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../desktop/src/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(readme, /TURN_URLS=/);
  assert.match(readme, /TURN_SECRET=/);
  assert.match(readme, /wrangler d1 create totalk-prod/);
  assert.match(readme, /coturn/i);
  assert.match(desktopMain, /process\.env\.TOTALK_URL/);
  assert.match(hostingConfig, /"d1"\s*:\s*"DB"/);
  assert.match(wranglerConfig, /REPLACE_WITH_D1_DATABASE_ID/);
  assert.match(packageJson, /cf:deploy/);
  assert.match(packageJson, /cf:d1:migrate/);
  await access(new URL("drizzle/meta/_journal.json", root));
});
