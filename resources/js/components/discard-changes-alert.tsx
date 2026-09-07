import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function DiscardChangesAlert({
    open,
    onOpenChange,
    onDiscard,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDiscard: () => void;
}) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Descartar los cambios?</AlertDialogTitle>
                    <AlertDialogDescription>
                        La información que capturaste en este formulario no se
                        guardará.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Seguir editando</AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        onClick={onDiscard}
                    >
                        Descartar cambios
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
