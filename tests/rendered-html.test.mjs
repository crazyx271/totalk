import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("production build packages release assets", async () => {
  await Promise.all([
    access(new URL("../dist/server/index.js", import.meta.url)),
    access(new URL("../dist/client", import.meta.url)),
    access(new URL("../dist/standalone/server.js", import.meta.url)),
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
  assert.doesNotMatch(iceRoute, /cloudflare:workers/);
  assert.match(healthRoute, /service:\s*"totalk"/);
  assert.match(healthRoute, /dbConfigured/);
});

test("self-hosted build and deploy docs are wired up", async () => {
  const [readme, desktopMain, packageJson, dbIndex, nextConfig] = await Promise.all([
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../desktop/src/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
  ]);

  assert.match(readme, /TURN_URLS=/);
  assert.match(readme, /TURN_SECRET=/);
  assert.match(readme, /coturn/i);
  assert.match(readme, /systemd/i);
  assert.match(readme, /DATABASE_PATH/);
  assert.doesNotMatch(readme, /wrangler|Cloudflare Workers|totalk-prod/i);
  assert.match(desktopMain, /process\.env\.TOTALK_URL/);
  assert.doesNotMatch(desktopMain, /audioOnly/);
  assert.match(packageJson, /db:migrate/);
  assert.match(packageJson, /better-sqlite3/);
  assert.doesNotMatch(packageJson, /wrangler|@cloudflare\/vite-plugin/);
  assert.doesNotMatch(dbIndex, /cloudflare:workers/);
  assert.match(nextConfig, /output:\s*"standalone"/);
  assert.match(nextConfig, /serverExternalPackages/);
  await access(new URL("drizzle/meta/_journal.json", root));
});

test("video calling is wired up in the voice call stack", async () => {
  const [voiceHook, voiceRoute] = await Promise.all([
    readFile(new URL("../app/useVoiceChat.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/voice/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(voiceHook, /toggleCamera/);
  assert.match(voiceRoute, /32_000/);
});
