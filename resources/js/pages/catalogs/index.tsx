import { Head } from '@inertiajs/react';
import { Page, PageHeader } from '@/components/page';
import type { Destination, Material, Paginated, Person } from '@/types';
import {
    DestinationSection,
    MaterialSection,
    PeopleSection,
    ProgramsSection,
} from './catalog-sections';
import type { CatalogPageProps, ProgramsCatalog } from './catalog-types';
import { CatalogNavigation } from './catalog-ui';

export default function Catalogs({
    section,
    filters,
    navigation,
    catalog,
    units,
    voucherTypes,
}: CatalogPageProps) {
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
                            />
                        )}
                        {section === 'destinations' && (
                            <DestinationSection
                                page={catalog as Paginated<Destination>}
                                filters={filters}
                                summary={summary}
                            />
                        )}
                        {section === 'people' && (
                            <PeopleSection
                                page={catalog as Paginated<Person>}
                                filters={filters}
                                summary={summary}
                            />
                        )}
                        {section === 'programs' && (
                            <ProgramsSection
                                catalog={catalog as ProgramsCatalog}
                                filters={filters}
                                summary={summary}
                            />
                        )}
                    </main>
                </div>
            </Page>
        </>
    );
}
