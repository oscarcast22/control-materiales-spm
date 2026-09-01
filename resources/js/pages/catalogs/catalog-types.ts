import type {
    Action,
    ActionIndicator,
    CatalogDeletion,
    Destination,
    Material,
    Paginated,
    Person,
    Program,
    Unit,
    VoucherType,
} from '@/types';

export type CatalogSection =
    'materials' | 'destinations' | 'people' | 'programs';

export type CatalogFilters = {
    search: string;
    status: 'all' | 'active' | 'inactive';
    review: 'all' | 'pending';
    voucher_type_id: string;
    role: 'all' | 'receive' | 'deliver' | 'authorize';
};

export type CatalogNavigationItem = {
    key: CatalogSection;
    label: string;
    total: number;
    pending_review: number;
    secondary_total?: number;
};

export type ProgramsCatalog = {
    programs: Program[];
    actions: Action[];
    indicators: ActionIndicator[];
};

export type CatalogData =
    | Paginated<Material>
    | Paginated<Destination>
    | Paginated<Person>
    | ProgramsCatalog;

export type CatalogPageProps = {
    section: CatalogSection;
    filters: CatalogFilters;
    navigation: CatalogNavigationItem[];
    catalog: CatalogData;
    units: Unit[];
    voucherTypes: VoucherType[];
};

export type StatusTarget = {
    type:
        | 'materials'
        | 'destinations'
        | 'people'
        | 'units'
        | 'programs'
        | 'actions'
        | 'indicators';
    id: number;
    name: string;
    active: boolean;
};

export type CatalogDeleteTarget = {
    type: StatusTarget['type'];
    id: number;
    name: string;
    deletion?: CatalogDeletion;
};
