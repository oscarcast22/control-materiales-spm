import { Head } from '@inertiajs/react';
import { Link2Off } from 'lucide-react';

export default function SharedVoucherUnavailable({
    title,
    message,
}: {
    title: string;
    message: string;
}) {
    return (
        <>
            <Head title={title}>
                <meta name="robots" content="noindex, nofollow, noarchive" />
                <meta name="referrer" content="no-referrer" />
            </Head>
            <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(30,96,168,0.13),transparent_30rem)] px-4 py-8">
                <section className="w-full max-w-md rounded-2xl border bg-card p-7 text-center shadow-[0_18px_50px_rgb(15_42_78/0.10)]">
                    <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-primary/15 bg-primary-subtle text-primary">
                        <Link2Off className="size-6" aria-hidden="true" />
                    </span>
                    <h1 className="mt-5 text-2xl font-bold tracking-[-0.025em]">
                        {title}
                    </h1>
                    <p className="mt-3 leading-6 text-muted-foreground">
                        {message}
                    </p>
                </section>
            </main>
        </>
    );
}
