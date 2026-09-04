import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import type { User } from '@/types';

export function UserInfo({
    user,
    showEmail = false,
}: {
    user: User;
    showEmail?: boolean;
}) {
    const getInitials = useInitials();

    return (
        <>
            <Avatar className="size-8 overflow-hidden rounded-md">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-md bg-primary-subtle text-primary">
                    {getInitials(user.name)}
                </AvatarFallback>
            </Avatar>
            <div
                data-slot="user-info-text"
                className="grid flex-1 text-left text-sm leading-tight"
            >
                <span className="truncate font-medium">{user.name}</span>
                {showEmail && (
                    <span className="truncate text-xs text-muted-foreground">
                        {user.email ?? user.username ?? 'Cuenta técnica'}
                    </span>
                )}
            </div>
        </>
    );
}
