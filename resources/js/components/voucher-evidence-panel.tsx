import { Download, Expand, FileText, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

type VoucherAttachment = {
    id: number;
    original_name: string;
    mime_type: string;
    size: number;
};

export function VoucherEvidencePanel({
    attachments,
}: {
    attachments: VoucherAttachment[];
}) {
    if (attachments.length === 0) {
        return null;
    }

    return (
        <section
            aria-labelledby="voucher-evidence-title"
            className="overflow-hidden rounded-xl border border-amber-300/45 bg-[linear-gradient(145deg,var(--color-surface-raised),color-mix(in_oklab,var(--color-warning)_7%,var(--color-surface-raised)))] shadow-sm"
        >
            <div className="flex items-start gap-3 border-b border-amber-300/35 px-4 py-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-subtle text-foreground">
                    <Images className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h2
                        id="voucher-evidence-title"
                        className="text-sm font-semibold text-foreground"
                    >
                        Vale físico
                    </h2>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        Consulta el documento mientras verificas o corriges la
                        captura.
                    </p>
                </div>
            </div>
            <div className="grid gap-3 p-3 sm:grid-cols-2">
                {attachments.map((file) =>
                    file.mime_type.startsWith('image/') ? (
                        <EvidenceImage key={file.id} file={file} />
                    ) : (
                        <EvidenceFile key={file.id} file={file} />
                    ),
                )}
            </div>
        </section>
    );
}

function EvidenceImage({ file }: { file: VoucherAttachment }) {
    const previewUrl = `/attachments/${file.id}/preview`;

    return (
        <article className="group relative overflow-hidden rounded-lg border border-border/80 bg-muted/35">
            <Dialog>
                <DialogTrigger asChild>
                    <button
                        type="button"
                        className="relative block aspect-video w-full cursor-zoom-in overflow-hidden bg-slate-950/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                        aria-label={`Ampliar ${file.original_name}`}
                    >
                        <img
                            src={previewUrl}
                            alt={`Fotografía del vale: ${file.original_name}`}
                            className="size-full object-contain transition-transform duration-200 group-hover:scale-[1.015]"
                            loading="lazy"
                        />
                        <span className="absolute right-2 bottom-2 flex size-8 items-center justify-center rounded-lg border border-white/30 bg-slate-950/70 text-white shadow-sm">
                            <Expand className="size-4" aria-hidden="true" />
                        </span>
                    </button>
                </DialogTrigger>
                <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] gap-3 overflow-hidden p-3 sm:max-w-6xl">
                    <DialogHeader className="pr-12">
                        <DialogTitle className="truncate">
                            {file.original_name}
                        </DialogTitle>
                        <DialogDescription>
                            Evidencia privada del vale físico.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex min-h-0 items-center justify-center overflow-auto rounded-xl bg-slate-950/95 p-2">
                        <img
                            src={previewUrl}
                            alt={`Fotografía ampliada del vale: ${file.original_name}`}
                            className="max-h-[calc(100dvh-9rem)] max-w-full object-contain"
                        />
                    </div>
                </DialogContent>
            </Dialog>
            <EvidenceFooter file={file} />
        </article>
    );
}

function EvidenceFile({ file }: { file: VoucherAttachment }) {
    return (
        <article className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-border/80 bg-surface-raised p-4 text-center">
            <FileText
                className="size-8 text-muted-foreground"
                aria-hidden="true"
            />
            <EvidenceFooter file={file} />
        </article>
    );
}

function EvidenceFooter({ file }: { file: VoucherAttachment }) {
    return (
        <div className="flex min-w-0 items-center justify-between gap-2 border-t border-border/70 bg-surface-raised/90 px-3 py-2">
            <span
                className="min-w-0 truncate text-xs font-medium"
                title={file.original_name}
            >
                {file.original_name}
            </span>
            <Button variant="ghost" size="icon" className="size-8" asChild>
                <a
                    href={`/attachments/${file.id}`}
                    aria-label={`Descargar ${file.original_name}`}
                >
                    <Download aria-hidden="true" />
                </a>
            </Button>
        </div>
    );
}
