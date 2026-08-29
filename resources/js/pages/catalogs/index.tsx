import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import type { Destination, Material, Paginated, Person } from '@/types';
import {
    DestinationSection,
    MaterialSection,
    PeopleSection,
    ProgramsSection,
} from './catalog-sections';
import type {
    CatalogPageProps,
    ProgramsCatalog,
    StatusTarget,
} from './catalog-types';
import { CatalogNavigation, CatalogStatusDialog } from './catalog-ui';

export default function Catalogs({
    section,
    filters,
    navigation,
    catalog,
    units,
    voucherTypes,
    programOptions,
}: CatalogPageProps) {
    const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);
    const summary =
        navigation.find((item) => item.key === section) ?? navigation[0];

    return (
        <>
            <Head title="Catálogos" />
            <Page width="wide">
                <PageHeader
                    eyebrow="Administración"
                    title="Catálogos"
                    description="Mantén ordenados los nombres y clasificaciones que se reutilizan al capturar vales. Las correcciones conservan el historial registrado."
                />

                <div className="grid gap-5">
                    <CatalogNavigation section={section} items={navigation} />

                    <main className="min-w-0">
                        {section === 'materials' && (
                            <MaterialSection
                                page={catalog as Paginated<Material>}
                                filters={filters}
                                summary={summary}
                                units={units}
                                voucherTypes={voucherTypes}
                                onStatus={setStatusTarget}
                            />
                        )}
                        {section === 'destinations' && (
                            <DestinationSection
                                page={catalog as Paginated<Destination>}
                                filters={filters}
                                summary={summary}
                                onStatus={setStatusTarget}
                            />
                        )}
                        {section === 'people' && (
                            <PeopleSection
                                page={catalog as Paginated<Person>}
                                filters={filters}
                                summary={summary}
                                onStatus={setStatusTarget}
                            />
                        )}
                        {section === 'programs' && (
                            <ProgramsSection
                                catalog={catalog as ProgramsCatalog}
                                filters={filters}
                                summary={summary}
                                programOptions={programOptions}
                                onStatus={setStatusTarget}
                            />
                        )}
                    </main>
                </div>
            </Page>

            <CatalogStatusDialog
                key={
                    statusTarget
                        ? `${statusTarget.type}-${statusTarget.id}`
                        : 'closed'
                }
                target={statusTarget}
                onClose={() => setStatusTarget(null)}
            />
        </>
    );
}
