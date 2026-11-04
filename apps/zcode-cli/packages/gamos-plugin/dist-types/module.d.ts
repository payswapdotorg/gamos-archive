/**
 * gamos-panel 模块清单（architecture-governance managed 模块）。
 * 层：app。修改 requires 时同步更新 architecture-policy.yaml（检查器会校验两者一致）。
 */
export declare const gamosPanelModule: {
    readonly id: "gamos-panel";
    readonly requires: readonly [];
    readonly provides: readonly ["gamos-panel"];
    readonly publicEntrypoints: readonly ["index.ts", "contract.ts"];
};
//# sourceMappingURL=module.d.ts.map