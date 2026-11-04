import { build } from "esbuild";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 构建产物（官方插件定义与打包清单的必需资产）：
// - dist/mcp/server.js：自包含 MCP server（运行时不读 node_modules）。
// - dist/ui/panel.html：Gamos Console 面板（脚本内联进 HTML）。
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "mcp"), { recursive: true });
await mkdir(join(dist, "ui"), { recursive: true });

await build({
  entryPoints: [join(root, "src", "mcp", "server.ts")],
  outfile: join(dist, "mcp", "server.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  legalComments: "none",
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require=__createRequire(import.meta.url);',
  },
});
await chmod(join(dist, "mcp", "server.js"), 0o755);

const panel = await build({
  entryPoints: [join(root, "src", "ui", "panel.ts")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
  write: false,
});
const html = (await readFile(join(root, "src", "ui", "panel.html"), "utf8")).replace(
  "/*__SCRIPT__*/",
  () => panel.outputFiles[0].text.replaceAll("</script", "<\\/script"),
);
await writeFile(join(dist, "ui", "panel.html"), html);
