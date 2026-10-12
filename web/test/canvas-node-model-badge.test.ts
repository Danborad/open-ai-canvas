import { expect, test } from "bun:test";

// 画布节点角标应展示渠道模型的展示名，而不是“渠道ID::模型ID”这类后台标识。
test("画布模型角标通过渠道目录解析展示名，不再直出模型 ID", async () => {
    const [component, producedModel] = await Promise.all([
        Bun.file(new URL("../src/components/canvas/canvas-node.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/lib/canvas/produced-model.ts", import.meta.url)).text(),
    ]);
    expect(component).toContain('import { producedModelLabel } from "@/lib/canvas/produced-model"');
    expect(component).toContain("producedModelLabel({ channels }, trimmed)");
    expect(component).toContain("useConfigStore((state) => state.config.channels)");
    expect(component).not.toContain("const name = modelOptionName(trimmed)");
    expect(producedModel).toContain("displayName");
});
