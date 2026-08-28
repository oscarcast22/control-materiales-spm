import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page, Request } from '@playwright/test';

const email = process.env.VISUAL_EMAIL;
const password = process.env.VISUAL_PASSWORD;
const evidenceDir = path.resolve('storage/logs/visual-audit');

type AuditViewport = {
    name: string;
    width: number;
    height: number;
    theme: 'light' | 'dark';
};

const viewports: AuditViewport[] = [
    { name: 'desktop-light', width: 1440, height: 1000, theme: 'light' },
    { name: 'desktop-dark', width: 1440, height: 1000, theme: 'dark' },
    { name: 'mobile-light', width: 390, height: 844, theme: 'light' },
];

const baseRoutes = [
    ['dashboard', '/dashboard'],
    ['vouchers', '/vouchers'],
    ['voucher-create', '/vouchers/create'],
    ['tracking', '/reports/material-tracking'],
    ['catalogs', '/catalogs'],
    ['profile', '/settings/profile'],
    ['security', '/settings/security'],
    ['appearance', '/settings/appearance'],
] as const;

async function setTheme(page: Page, theme: 'light' | 'dark') {
    await page.evaluate((value) => {
        localStorage.setItem('appearance', value);
        document.cookie = `appearance=${value};path=/;SameSite=Lax`;
    }, theme);
}

async function assertPageFrame(page: Page, route: string) {
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Server Error');
    await expect(page.locator('body')).not.toContainText('Page Expired');

    const overflow = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(
        overflow.scrollWidth,
        `La ruta ${route} desborda horizontalmente el viewport`,
    ).toBeLessThanOrEqual(overflow.clientWidth + 1);

    const mainContent = page.locator('#main-content');

    if (await mainContent.count()) {
        const mainSurface = await mainContent.evaluate((element) => {
            const styles = getComputedStyle(element);

            return {
                backgroundColor: styles.backgroundColor,
                borderRadius: styles.borderRadius,
                boxShadow: styles.boxShadow,
            };
        });

        expect(mainSurface).toEqual({
            backgroundColor: 'rgba(0, 0, 0, 0)',
            borderRadius: '0px',
            boxShadow: 'none',
        });

        const shellBackground = await page
            .locator('[data-slot="sidebar-wrapper"]')
            .evaluate((element) => getComputedStyle(element).backgroundColor);

        expect(shellBackground).toBe('rgba(0, 0, 0, 0)');
    }
}

test('recorrido visual de todas las pantallas', async ({ browser }) => {
    test.setTimeout(180_000);
    test.skip(!email || !password, 'Faltan VISUAL_EMAIL y VISUAL_PASSWORD.');
    await mkdir(evidenceDir, { recursive: true });

    for (const viewport of viewports) {
        const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            colorScheme: viewport.theme,
        });
        const page = await context.newPage();
        const consoleErrors: string[] = [];
        const pageErrors: string[] = [];

        page.on('console', (message) => {
            if (message.type() === 'error') {
                consoleErrors.push(message.text());
            }
        });
        page.on('pageerror', (error) => pageErrors.push(error.message));

        await page.goto('/login');
        await setTheme(page, viewport.theme);
        await page.reload({ waitUntil: 'networkidle' });
        await assertPageFrame(page, '/login');
        await page.screenshot({
            path: path.join(evidenceDir, `${viewport.name}--login.png`),
            fullPage: true,
        });

        await page.getByLabel('Correo electrónico').fill(email!);
        await page.locator('input[name="password"]').fill(password!);
        await page.locator('[data-test="login-button"]').click();
        await page.waitForURL('**/dashboard');
        await page.waitForLoadState('networkidle');

        await page.goto('/vouchers', { waitUntil: 'networkidle' });
        const voucherPath = await page.locator('a').evaluateAll((links) => {
            const hrefs = links
                .map((link) => link.getAttribute('href'))
                .filter((href): href is string => Boolean(href));

            return hrefs.find((href) => /^\/vouchers\/\d+$/.test(href)) ?? null;
        });
        const routes: [string, string][] = [...baseRoutes];

        if (voucherPath) {
            routes.splice(3, 0, ['voucher-detail', voucherPath]);
            routes.splice(4, 0, ['voucher-edit', `${voucherPath}/edit`]);
        }

        for (const [name, route] of routes) {
            await page.goto(route, { waitUntil: 'networkidle' });

            if (
                route === '/settings/security' &&
                (await page
                    .getByRole('heading', { name: 'Confirmar contraseña' })
                    .isVisible())
            ) {
                await page.locator('input[name="password"]').fill(password!);
                await page
                    .getByRole('button', {
                        name: 'Confirmar contraseña',
                        exact: true,
                    })
                    .click();
                await page.waitForURL('**/settings/security');
                await page.waitForLoadState('networkidle');
            }

            await assertPageFrame(page, route);

            if (route === '/settings/security') {
                await expect(
                    page.getByRole('heading', {
                        name: 'Actualizar contraseña',
                    }),
                ).toBeVisible();
            }

            await page.screenshot({
                path: path.join(evidenceDir, `${viewport.name}--${name}.png`),
                fullPage: true,
            });
        }

        await page.goto('/dashboard', { waitUntil: 'networkidle' });

        const stickyHeader = page.locator('#main-content > header');
        await expect
            .poll(() =>
                stickyHeader.evaluate(
                    (element) => getComputedStyle(element).backgroundColor,
                ),
            )
            .toBe('rgba(0, 0, 0, 0)');

        if (viewport.name === 'desktop-light') {
            await page.evaluate(() => window.scrollTo(0, 520));
            await expect
                .poll(() =>
                    stickyHeader.evaluate(
                        (element) => getComputedStyle(element).backgroundColor,
                    ),
                )
                .not.toBe('rgba(0, 0, 0, 0)');
            await expect(stickyHeader).toBeVisible();
            await page.screenshot({
                path: path.join(
                    evidenceDir,
                    'desktop-light--header-scrolled.png',
                ),
            });
            await page.evaluate(() => window.scrollTo(0, 0));
            await expect
                .poll(() =>
                    stickyHeader.evaluate(
                        (element) => getComputedStyle(element).backgroundColor,
                    ),
                )
                .toBe('rgba(0, 0, 0, 0)');
        }

        if (viewport.width >= 1024) {
            await page
                .getByRole('button', { name: 'Contraer navegación' })
                .click();
            await page.waitForTimeout(250);
            await page.screenshot({
                path: path.join(
                    evidenceDir,
                    `${viewport.name}--sidebar-collapsed.png`,
                ),
            });
            await page
                .getByRole('button', { name: 'Abrir navegación' })
                .click();
            await page.waitForTimeout(250);
        } else {
            await page
                .getByRole('button', { name: 'Abrir navegación' })
                .click();
            await expect(
                page.locator('[data-sidebar="sidebar"][data-mobile="true"]'),
            ).toBeVisible();
            await page.waitForTimeout(550);
            await page.screenshot({
                path: path.join(
                    evidenceDir,
                    `${viewport.name}--sidebar-open.png`,
                ),
            });
            await page.keyboard.press('Escape');
            await page.waitForTimeout(350);
        }

        if (viewport.name === 'desktop-light') {
            await page.goto('/dashboard', { waitUntil: 'networkidle' });
            await expect(
                page.getByRole('heading', { name: 'Resumen general' }),
            ).toBeVisible();
            await expect(
                page.getByRole('group', { name: 'Mostrar vales de' }),
            ).toHaveCount(0);

            await page.goto('/vouchers', { waitUntil: 'networkidle' });
            await expect(page.getByLabel('Tipo de vale')).toContainText(
                'Almacén',
            );
            await expect(
                page.getByRole('button', { name: 'Aplicar filtros' }),
            ).toHaveCount(0);
            await expect(page.getByText('Sin filtros activos')).toBeVisible();
            await expect(
                page.getByRole('button', { name: /Limpiar \d+ filtro/ }),
            ).toHaveCount(0);

            let voucherFilterRequests = 0;
            const countVoucherFilterRequests = (request: Request) => {
                const url = new URL(request.url());

                if (
                    url.pathname === '/vouchers' &&
                    request.headers()['x-inertia'] === 'true' &&
                    url.searchParams.has('search')
                ) {
                    voucherFilterRequests++;
                }
            };
            page.on('request', countVoucherFilterRequests);
            await page
                .getByLabel('Buscar')
                .pressSequentially('165', { delay: 40 });
            await expect
                .poll(() => voucherFilterRequests, { timeout: 1500 })
                .toBe(1);
            page.off('request', countVoucherFilterRequests);
            await page
                .getByRole('button', { name: 'Limpiar 1 filtro activo' })
                .click();
            await page.waitForLoadState('networkidle');
            await expect(page.getByText('Sin filtros activos')).toBeVisible();

            await page
                .getByRole('button', {
                    name: 'Registrar cancelado',
                    exact: true,
                })
                .click();
            await expect(
                page.getByRole('heading', {
                    name: 'Registrar folio cancelado',
                }),
            ).toBeVisible();
            await page.waitForTimeout(250);
            await page.screenshot({
                path: path.join(
                    evidenceDir,
                    'desktop-light--dialog-cancelled-voucher.png',
                ),
            });
            await page
                .getByRole('button', { name: 'Cerrar diálogo' })
                .click();

            await page
                .getByRole('button', {
                    name: 'Registrar aplicación',
                    exact: true,
                })
                .click();
            await expect(
                page.getByRole('heading', { name: 'Registrar aplicación' }),
            ).toBeVisible();
            await page.waitForTimeout(250);
            await page.screenshot({
                path: path.join(
                    evidenceDir,
                    'desktop-light--dialog-quick-application.png',
                ),
            });
            await page
                .getByRole('button', { name: 'Cerrar diálogo' })
                .click();

            await page.goto('/vouchers', { waitUntil: 'networkidle' });
            await page
                .getByRole('button', {
                    name: 'Registrar prestado',
                    exact: true,
                })
                .click();
            await expect(
                page.getByRole('heading', {
                    name: 'Registrar folio prestado',
                }),
            ).toBeVisible();
            await page.waitForTimeout(250);
            await page.screenshot({
                path: path.join(
                    evidenceDir,
                    'desktop-light--dialog-loaned-voucher.png',
                ),
            });
            await page
                .getByRole('button', { name: 'Cerrar diálogo' })
                .click();

            if (voucherPath) {
                await page.goto(voucherPath, { waitUntil: 'networkidle' });
                const cancelButton = page.getByRole('button', {
                    name: 'Cancelar',
                    exact: true,
                });

                if (await cancelButton.isVisible()) {
                    await cancelButton.click();
                    await expect(
                        page.getByRole('heading', { name: 'Cancelar vale' }),
                    ).toBeVisible();
                    await page.waitForTimeout(250);
                    await page.screenshot({
                        path: path.join(
                            evidenceDir,
                            'desktop-light--dialog-cancel-voucher.png',
                        ),
                    });
                    await page
                        .getByRole('button', { name: 'Cerrar diálogo' })
                        .click();
                }
            }

            await page.goto('/reports/material-tracking', {
                waitUntil: 'networkidle',
            });
            await expect(page.getByLabel('Tipo de vale')).toContainText(
                'Almacén',
            );
            await expect(
                page.getByRole('button', { name: 'Aplicar filtros' }),
            ).toHaveCount(0);
            await expect(
                page.getByRole('tab', { name: 'Por vale' }),
            ).toHaveAttribute('aria-selected', 'true');
            await expect(page.getByText('Sin filtros activos')).toBeVisible();
            await expect(
                page.getByRole('button', { name: /Limpiar \d+ filtro/ }),
            ).toHaveCount(0);

            let trackingFilterRequests = 0;
            const countTrackingFilterRequests = (request: Request) => {
                const url = new URL(request.url());

                if (
                    url.pathname === '/reports/material-tracking' &&
                    request.headers()['x-inertia'] === 'true' &&
                    url.searchParams.has('search')
                ) {
                    trackingFilterRequests++;
                }
            };
            page.on('request', countTrackingFilterRequests);
            await page
                .getByLabel('Buscar', { exact: true })
                .pressSequentially('165', { delay: 40 });
            await expect
                .poll(() => trackingFilterRequests, { timeout: 1500 })
                .toBe(1);
            page.off('request', countTrackingFilterRequests);
            await page
                .getByRole('button', { name: 'Limpiar 1 filtro activo' })
                .click();
            await page.waitForLoadState('networkidle');
            await expect(page.getByText('Sin filtros activos')).toBeVisible();

            const voucherToggles = page.getByRole('button', {
                name: /materiales del vale/,
            });

            if ((await voucherToggles.count()) > 0) {
                const firstToggle = voucherToggles.first();
                await firstToggle.click();
                await expect(firstToggle).toHaveAttribute(
                    'aria-expanded',
                    'true',
                );

                if ((await voucherToggles.count()) > 1) {
                    const secondToggle = voucherToggles.nth(1);
                    await secondToggle.click();
                    await expect(firstToggle).toHaveAttribute(
                        'aria-expanded',
                        'true',
                    );
                    await expect(secondToggle).toHaveAttribute(
                        'aria-expanded',
                        'true',
                    );
                }

                await page.waitForTimeout(250);
                await page.screenshot({
                    path: path.join(
                        evidenceDir,
                        'desktop-light--tracking-vouchers-expanded.png',
                    ),
                    fullPage: true,
                });
            }
        }

        expect(pageErrors, `Errores JavaScript en ${viewport.name}`).toEqual(
            [],
        );
        expect(
            consoleErrors.filter(
                (message) =>
                    !message.includes('favicon') &&
                    !message.includes('Failed to load resource'),
            ),
            `Errores de consola en ${viewport.name}`,
        ).toEqual([]);

        await context.close();
    }
});
