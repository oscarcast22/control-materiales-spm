export const formatDate = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat('es-MX', {
              dateStyle: 'medium',
              timeZone: 'UTC',
          }).format(new Date(`${value}T00:00:00Z`))
        : '—';

export const formatQuantity = (value: string | number) =>
    new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(
        Number(value),
    );

export const formatBytes = (bytes: number) =>
    bytes < 1024 * 1024
        ? `${Math.ceil(bytes / 1024)} KB`
        : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
