import type { GamePackage, PackageType, World, WorldFiles } from "./types.js";
import { GameOSStore } from "../lib/store.js";
/**
 * 包图与 intake 校验（规格 §2.3 / §3）：
 * 权利元数据（license+author）、出处、引擎兼容、文件存在、依赖可解析。
 * 任一 fail ⇒ 包 invalid ⇒ 发布门禁 packages-validated 不过。
 */
export interface RegisterPackageInput {
    name: string;
    type: PackageType;
    path: string;
    engine?: GamePackage["engine"];
    version?: string;
    dependencies?: string[];
    license: string;
    author: string;
    sourceUrl?: string;
    attribution?: string;
    origin?: GamePackage["provenance"]["origin"];
    createdBy?: GamePackage["provenance"]["createdBy"];
}
export declare function registerPackage(store: GameOSStore, workspaceRoot: string, worldId: string, input: RegisterPackageInput): Promise<GamePackage>;
export declare function validatePackage(pkg: GamePackage, all: GamePackage[], world: World): GamePackage["validation"];
/** 重跑校验（含文件存在检查）。单个包或全部。 */
export declare function refreshPackageValidation(store: GameOSStore, workspaceRoot: string, worldId: string, packageId?: string): Promise<GamePackage[]>;
export declare function packageGraph(files: WorldFiles): {
    nodes: {
        id: string;
        name: string;
        type: PackageType;
        validation: string;
        engine: string;
    }[];
    edges: {
        from: string;
        to: string;
    }[];
    unresolved: string[];
};
//# sourceMappingURL=packages.d.ts.map