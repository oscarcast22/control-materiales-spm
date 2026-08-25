export type Named = { id: number; name: string };
export type Unit = Named & { symbol: string; is_active?: boolean };
export type StorageLocation = Named & {
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
};
export type Person = Named & {
    can_receive_material: boolean;
    can_deliver_material: boolean;
    is_active?: boolean;
    needs_review?: boolean;
    aliases_count?: number;
};
export type Action = {
    id: number;
    code: string;
    name?: string | null;
    program_id?: number;
    is_active?: boolean;
};
export type Program = Action & { actions: Action[] };

export type Disposition = {
    id: number;
    type: 'consumption' | 'return';
    occurred_on: string;
    quantity: string;
    reference?: string | null;
    destination?: string | null;
    notes?: string | null;
    legacy_slot?: number | null;
    voided_at?: string | null;
    void_reason?: string | null;
};

export type VoucherItem = {
    id: number;
    material: Named;
    unit: Unit;
    description: string;
    quantity: string;
    used_quantity: string;
    returned_quantity: string;
    pending_quantity: string;
    balance_state: 'pending' | 'settled' | 'anomaly' | 'received';
    legacy_anomaly: boolean;
    dispositions: Disposition[];
};

export type Voucher = {
    id: number;
    location: StorageLocation;
    folio: string;
    direction: 'entry' | 'exit';
    reference?: string | null;
    issued_on: string;
    issued_time?: string | null;
    received_by: Named;
    delivered_by: Named;
    authorized_by?: Named | null;
    program?: Action | null;
    action?: Action | null;
    destination: string;
    notes?: string | null;
    status: 'active' | 'cancelled';
    balance_state: 'pending' | 'settled' | 'anomaly' | 'received' | 'cancelled';
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
    location: StorageLocation;
    material: Named;
    unit: Unit;
    entries: string;
    exits: string;
    returns: string;
    adjustments: string;
    available: string;
};

export type InventoryAdjustment = {
    id: number;
    location: StorageLocation;
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
