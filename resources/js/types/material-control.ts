export type Named = { id: number; name: string };
export type CatalogDeletion = {
    can_delete: boolean;
    blocked_reason: string | null;
};
export type Unit = Named & {
    symbol: string;
    is_active?: boolean;
    deletion?: CatalogDeletion;
};
export type VoucherType = Named & {
    code: string;
    tracking_started_on: string;
    is_active?: boolean;
};
export type Material = Named & {
    default_unit_id: number;
    default_unit?: Unit;
    is_active?: boolean;
    needs_review?: boolean;
    aliases_count?: number;
    voucher_types?: Pick<VoucherType, 'id' | 'name' | 'code'>[];
    deletion?: CatalogDeletion;
};
export type Person = Named & {
    can_receive_material: boolean;
    can_deliver_material: boolean;
    can_authorize_material: boolean;
    is_active?: boolean;
    needs_review?: boolean;
    aliases_count?: number;
    deletion?: CatalogDeletion;
};
export type Destination = Named & {
    is_active?: boolean;
    needs_review?: boolean;
    aliases_count?: number;
    aliases?: { id: number; alias: string }[];
    deletion?: CatalogDeletion;
};
export type Program = {
    id: number;
    code: string;
    name?: string | null;
    is_active?: boolean;
    deletion?: CatalogDeletion;
};
export type Action = {
    id: number;
    program_id: number;
    code: string;
    name?: string | null;
    is_active?: boolean;
    program?: Pick<Program, 'id' | 'code'>;
    deletion?: CatalogDeletion;
};
export type ActionIndicator = {
    id: number;
    action_id: number;
    code: string;
    name: string;
    is_active?: boolean;
    action?: Pick<Action, 'id' | 'program_id' | 'code' | 'name' | 'is_active'>;
};

export type MaterialApplication = {
    id: number;
    occurred_on: string;
    quantity: string;
    reference?: string | null;
    destination_snapshot?: string | null;
    notes?: string | null;
    legacy_slot?: number | null;
    voided_at?: string | null;
    void_reason?: string | null;
    attachment?: {
        id: number;
        original_name: string;
        mime_type: string;
        size: number;
    } | null;
};

export type VoucherItem = {
    id: number;
    material: Named;
    unit: Unit;
    description: string;
    quantity: string;
    used_quantity: string;
    pending_quantity: string;
    balance_state: 'pending' | 'settled' | 'anomaly' | 'received';
    legacy_anomaly: boolean;
    applications: MaterialApplication[];
};

export type Voucher = {
    id: number;
    voucher_type: VoucherType;
    folio: string;
    direction?: 'entry' | 'exit' | null;
    issued_on: string;
    received_by?: Named | null;
    delivered_by?: Named | null;
    authorized_by?: Named | null;
    program?: Program | null;
    action?: Action | null;
    indicator?: ActionIndicator | null;
    destinations: Destination[];
    usage_description?: string | null;
    destination_summary?: string | null;
    notes?: string | null;
    status: 'active' | 'loaned' | 'cancelled';
    loaned_to_name?: string | null;
    loaned_on?: string | null;
    balance_state:
        | 'pending'
        | 'settled'
        | 'anomaly'
        | 'received'
        | 'cancelled'
        | 'loaned'
        | 'not_applicable';
    needs_review: boolean;
    review_reasons: string[];
    cancellation_reason?: string | null;
    items_count: number;
    items: VoucherItem[];
    attachments: {
        id: number;
        original_name: string;
        mime_type: string;
        size: number;
        created_at: string;
    }[];
};

export type InventoryRow = {
    location: VoucherType;
    material: Named;
    unit: Unit;
    entries: string;
    exits: string;
    adjustments: string;
    available: string;
};

export type InventoryAdjustment = {
    id: number;
    location: VoucherType;
    material: Named;
    unit: Unit;
    occurred_on: string;
    quantity_delta: string;
    reason: string;
    voided_at?: string | null;
    void_reason?: string | null;
};

export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
    links: { url: string | null; label: string; active: boolean }[];
};
