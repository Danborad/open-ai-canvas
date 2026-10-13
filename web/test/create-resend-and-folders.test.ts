import { expect, test } from "bun:test";

test("创作窗口点击重新发送完整还原之前参考图与提示词，且参考弹窗展示用户自定义分类列表", async () => {
    const [createPage, messagesView, pickerModal] = await Promise.all([
        Bun.file(new URL("../src/pages/create/index.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/pages/create/creation-workspace-messages.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/assets/asset-library-picker-modal.tsx", import.meta.url)).text(),
    ]);

    // 1. 用户消息点击“编辑并重新发送”传递完整 CreationMessage，并通过 restoreMessageDraft 恢复参考图与参数
    expect(messagesView).toContain("onEditUserMessage: (message: CreationMessage) => void");
    expect(messagesView).toContain("onClick={() => onEditUserMessage(item)}");
    expect(createPage).toContain("restoreMessageDraft(message);");
    expect(createPage).toContain("const nextAttachments = item.attachments ? [...item.attachments] : [];");
    expect(createPage).toContain("setAttachments(nextAttachments);");
    expect(createPage).toContain("attachmentsRef.current = nextAttachments;");

    // 2. 参考素材弹窗自动加载用户自定义分类（listAssetFolders），并在本地源下展示“我的分类”及按 folderId 过滤
    expect(pickerModal).toContain('import { listAssetFolders } from "@/services/api/user-data"');
    expect(pickerModal).toContain('queryKey: ["asset-folders", userId]');
    expect(pickerModal).toContain("if (userFolders.length) return userFolders;");
    expect(pickerModal).toContain('source === "local" ? "我的分类" : "文件夹"');
    expect(pickerModal).toContain('folderId: folderId !== "all" && folderId !== "uncategorized" ? folderId : undefined');
    expect(pickerModal).toContain('uncategorized: folderId === "uncategorized"');
});
