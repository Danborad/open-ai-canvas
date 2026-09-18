import { AlipayCircleFilled, WechatFilled } from "@ant-design/icons";

export const ZHIFUFM_LOGO_SRC =
    "data:image/png;base64,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";

export function PaymentBrandIcon({ providerId, compact = false }: { providerId: string; compact?: boolean }) {
    const size = compact ? "size-6" : "size-10";
    if (providerId === "wechat-native" || providerId === "official-payment-wechat-native") {
        return (
            <span className={`grid ${size} shrink-0 place-items-center rounded-lg bg-[#07c160]/10 text-[#07c160]`}>
                <WechatFilled className={compact ? "text-sm" : "text-xl"} aria-hidden />
            </span>
        );
    }
    if (providerId === "alipay-page-pay" || providerId === "official-payment-alipay-page") {
        return (
            <span className={`grid ${size} shrink-0 place-items-center rounded-lg bg-[#1677ff]/10 text-[#1677ff]`}>
                <AlipayCircleFilled className={compact ? "text-sm" : "text-xl"} aria-hidden />
            </span>
        );
    }
    if (providerId === "zhifufm-pay" || providerId === "official-payment-zhifufm") {
        return (
            <span className={`grid ${size} shrink-0 place-items-center rounded-lg bg-[#2D1B69] p-1.5 shadow-sm overflow-hidden`}>
                <img src={ZHIFUFM_LOGO_SRC} alt="支付FM" className="size-full object-contain select-none pointer-events-none" />
            </span>
        );
    }
    return <span className={`grid ${size} shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold`}>PAY</span>;
}
