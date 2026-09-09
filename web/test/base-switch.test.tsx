import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Switch } from "../src/components/ui/base/switch";

describe("base Switch component", () => {
    test("renders checked state with thumb shifted to the right and inverted colors", () => {
        const html = renderToStaticMarkup(<Switch size="sm" checked={true} />);
        expect(html).toContain('role="switch"');
        expect(html).toContain('data-state="on"');
        expect(html).toContain('aria-checked="true"');
        expect(html).toContain("translate-x-3.5");
        expect(html).toContain("bg-background");
    });

    test("renders unchecked state with thumb at initial position", () => {
        const html = renderToStaticMarkup(<Switch size="sm" checked={false} />);
        expect(html).toContain('data-state="off"');
        expect(html).toContain('aria-checked="false"');
        expect(html).toContain("translate-x-0");
        expect(html).toContain("bg-surface-strong");
    });

    test("supports medium size with larger translation offset", () => {
        const onHtml = renderToStaticMarkup(<Switch size="md" checked={true} />);
        expect(onHtml).toContain("translate-x-6");

        const offHtml = renderToStaticMarkup(<Switch size="md" checked={false} />);
        expect(offHtml).toContain("translate-x-0");
    });
});
