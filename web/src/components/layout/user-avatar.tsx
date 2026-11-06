import { useEffect, useState } from "react";
import { Bot, Camera, Cat, CircleUserRound, Clapperboard, Rabbit, Rocket, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDefaultUserAvatarID, type DefaultUserAvatarID } from "@/lib/default-user-avatars";
import { resolveUserAvatarURL } from "@/lib/user-avatar-url";
import { apiBaseURL } from "@/services/api/request";
import type { LocalUser } from "@/stores/use-user-store";

const defaultAvatarIcons: Record<DefaultUserAvatarID, LucideIcon> = {
    person: CircleUserRound,
    director: Clapperboard,
    camera: Camera,
    cat: Cat,
    rabbit: Rabbit,
    robot: Bot,
    rocket: Rocket,
    sparkles: Sparkles,
};

export function UserAvatar({ user, className, iconClassName }: { user: LocalUser; className?: string; iconClassName?: string }) {
    const [failed, setFailed] = useState(false);
    const avatarUrl = user.avatarMode === "default" ? "" : resolveUserAvatarURL(user.avatarUrl, apiBaseURL);
    const DefaultAvatarIcon = defaultAvatarIcons[isDefaultUserAvatarID(user.avatarPreset) ? user.avatarPreset : "person"];

    useEffect(() => setFailed(false), [avatarUrl]);

    const hasImage = Boolean(avatarUrl && !failed);

    return (
        <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full", hasImage && "!p-0 !bg-transparent", className)}>
            {hasImage ? (
                <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="size-full object-cover rounded-full" onError={() => setFailed(true)} />
            ) : (
                <DefaultAvatarIcon className={cn("size-full", iconClassName)} aria-hidden />
            )}
        </span>
    );
}
