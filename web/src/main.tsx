import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import { installChunkRecovery } from "@/lib/chunk-recovery";
import { bootstrapAppearance } from "@/services/appearance-bootstrap";
import { isIsolatedPrevisRepro } from "@/lib/dev-repro";

installChunkRecovery();

function notifyBootFailure() {
    (window as Window & { __showBootRecovery?: () => void }).__showBootRecovery?.();
}

// The public film entry checks its availability independently of workspace bootstrap.
if (/^\/welcome\/?$/.test(window.location.pathname)) {
    void bootstrapAppearance().catch(() => undefined);
    void import("./welcome-application").catch(notifyBootFailure);
} else {
    // The backend-free DEV lab must not make requests before AppProviders isolates it.
    const appearanceReady = isIsolatedPrevisRepro(import.meta.env.DEV, window.location.pathname) ? Promise.resolve() : bootstrapAppearance();
    void import("./application").catch(notifyBootFailure);
    void appearanceReady.catch(() => undefined);
}
