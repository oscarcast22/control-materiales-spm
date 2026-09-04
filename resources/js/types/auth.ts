export type UserRole = 'administrator' | 'technician';

export type User = {
    id: number;
    name: string;
    email: string | null;
    username: string | null;
    role: UserRole;
    person_id: number | null;
    avatar?: string;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User;
};

export type Capabilities = {
    manage_catalogs: boolean;
    view_reports: boolean;
    manage_accounts: boolean;
    manage_vouchers: boolean;
    view_my_vouchers: boolean;
};

export type Passkey = {
    id: number;
    name: string;
    authenticator: string | null;
    created_at_diff: string;
    last_used_at_diff: string | null;
};

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};
