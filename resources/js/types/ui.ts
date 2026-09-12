import type { ReactNode } from 'react';
import type { Auth, Capabilities } from '@/types/auth';
import type { BreadcrumbItem } from '@/types/navigation';

export type AppLayoutProps = {
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
};

export type AppVariant = 'header' | 'sidebar';

export type FlashToast = {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
};

export type AppSharedPageProps = {
    name: string;
    auth: Auth;
    capabilities: Capabilities;
    sidebarOpen: boolean;
    [key: string]: unknown;
};

export type ChoiceOption = {
    value: string;
    label: string;
    meta?: string;
    description?: string;
    searchTerms?: string[];
    disabled?: boolean;
};

export type AuthLayoutProps = {
    children?: ReactNode;
    name?: string;
    title?: string;
    description?: string;
};
