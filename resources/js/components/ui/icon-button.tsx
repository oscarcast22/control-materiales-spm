import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';

type IconButtonProps = Omit<
    ComponentProps<typeof Button>,
    'size' | 'aria-label'
> & {
    label: string;
};

function IconButton({ label, ...props }: IconButtonProps) {
    return <Button size="icon" aria-label={label} {...props} />;
}

export { IconButton };
