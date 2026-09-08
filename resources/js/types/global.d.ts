import type { Auth, Capabilities } from '@/types/auth';
import type { FlashToast } from '@/types/ui';

declare module 'react' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        flashDataType: {
            toast?: FlashToast;
        };
        sharedPageProps: {
            name: string;
            auth: Auth;
            capabilities: Capabilities;
            sidebarOpen: boolean;
            [key: string]: unknown;
        };
    }
}
