/**
 * gamos-panel 公共入口：导出稳定接口（module.ts 声明的 publicEntrypoints 之一）。
 * 面板、hook 脚本与测试只依赖这里与 contract.ts 暴露的形状。
 */
export * from "./contract.js";
export { GameOSStore, GamosStateError } from "./lib/store.js";
export { newId, nowIso, slugify } from "./lib/ids.js";
export {
  createWorld,
  emptyGameIr,
  inspectWorld,
  listWorlds,
  updateWorld,
} from "./gameos/worlds.js";
export {
  packageGraph,
  registerPackage,
  refreshPackageValidation,
  validatePackage,
} from "./gameos/packages.js";
export { playtestReport, recordBuild, recordPlaytest } from "./gameos/evidence.js";
export {
  approveRelease,
  checkGates,
  evaluateGates,
  publishWorld,
  requestApproval,
  worldAtlas,
  worldUsage,
} from "./gameos/release.js";
export { buildConsoleState } from "./gameos/console-state.js";
export { createGamosServer, main } from "./mcp/server.js";
export { gamosTools } from "./mcp/tools.js";
export { gamosPanelModule } from "./module.js";
