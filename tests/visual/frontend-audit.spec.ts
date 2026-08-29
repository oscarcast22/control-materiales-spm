import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { Locator, Page, Request } from '@playwright/test';

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

async function assertNoPressScale(page: Page, control: Locator) {
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();

    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    expect(
        await control.evaluate((element) => getComputedStyle(element).scale),
    ).toBe('none');
    await page.mouse.move(0, 0);
    await page.mouse.up();
}

async function assertFloatingSurfaceDoesNotZoom(surface: Locator) {
    await expect(surface).toBeVisible();
    expect(
        await surface.evaluate((element) => getComputedStyle(element).scale),
    ).toBe('none');
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

        if (viewport.width >= 1024) {
            await expect(stickyHeader).toBeHidden();

            const sidebarPanel = page.locator(
                '[data-slot="sidebar"] [data-sidebar="sidebar"]',
            );
            const edgeTrigger = page.getByRole('button', {
                name: 'Contraer navegación',
            });
            await expect(edgeTrigger).toBeVisible();
            await expect(edgeTrigger).toHaveAttribute('aria-expanded', 'true');
            const panelBox = await sidebarPanel.boundingBox();
            const triggerBox = await edgeTrigger.boundingBox();
            expect(panelBox).not.toBeNull();
            expect(triggerBox).not.toBeNull();
            expect(triggerBox!.width).toBe(40);
            expect(triggerBox!.height).toBe(40);
            expect(
                await edgeTrigger.evaluate(
                    (element) => getComputedStyle(element, '::before').width,
                ),
            ).toBe('24px');
            expect(
                Math.abs(
                    triggerBox!.x +
                        triggerBox!.width / 2 -
                        (panelBox!.x + panelBox!.width),
                ),
            ).toBeLessThanOrEqual(1);
            const logoMark = page.locator('[data-slot="app-logo-mark"]');
            const expandedLogoBox = await logoMark.boundingBox();
            const expandedFirstNavBox = await page
                .locator(
                    '[data-sidebar="content"] [data-sidebar="menu-button"]',
                )
                .first()
                .boundingBox();
            expect(expandedLogoBox).not.toBeNull();
            expect(expandedFirstNavBox).not.toBeNull();
            const expandedNavGap =
                expandedFirstNavBox!.y -
                (expandedLogoBox!.y + expandedLogoBox!.height);

            await edgeTrigger.click();
            await page.waitForTimeout(250);
            await expect(logoMark).toBeVisible();
            const logoBox = await logoMark.boundingBox();
            expect(logoBox).not.toBeNull();
            expect(logoBox!.width).toBe(40);
            expect(logoBox!.height).toBe(40);
            const collapsedPanelBox = await sidebarPanel.boundingBox();
            expect(collapsedPanelBox).not.toBeNull();
            expect(collapsedPanelBox!.x).toBe(6);
            const logoCenter = logoBox!.x + logoBox!.width / 2;
            const collapsedNavControls = page.locator(
                '[data-sidebar="content"] [data-sidebar="menu-button"]',
            );
            const firstNavBox = await collapsedNavControls
                .first()
                .boundingBox();
            expect(firstNavBox).not.toBeNull();
            const collapsedTrigger = page.getByRole('button', {
                name: 'Abrir navegación',
            });
            const collapsedTriggerBox = await collapsedTrigger.boundingBox();
            expect(collapsedTriggerBox).not.toBeNull();
            const visibleTriggerBottom =
                collapsedTriggerBox!.y + (collapsedTriggerBox!.height + 24) / 2;
            expect(
                firstNavBox!.y - visibleTriggerBottom,
            ).toBeGreaterThanOrEqual(12);
            const collapsedNavGap =
                firstNavBox!.y - (logoBox!.y + logoBox!.height);
            expect(
                Math.abs(collapsedNavGap - expandedNavGap),
            ).toBeLessThanOrEqual(1);
            const collapsedControls = page.locator(
                '[data-sidebar="content"] [data-sidebar="menu-button"], [data-sidebar="footer"] [data-sidebar="menu-button"]',
            );
            const collapsedControlBoxes = await collapsedControls.evaluateAll(
                (elements) =>
                    elements.map((element) => {
                        const box = element.getBoundingClientRect();

                        return {
                            center: box.x + box.width / 2,
                            height: box.height,
                            width: box.width,
                        };
                    }),
            );
            expect(collapsedControlBoxes.length).toBeGreaterThanOrEqual(6);

            for (const box of collapsedControlBoxes) {
                expect(box.width).toBe(40);
                expect(box.height).toBe(40);
                expect(Math.abs(box.center - logoCenter)).toBeLessThanOrEqual(
                    1,
                );
            }

            const profileButton = page.locator(
                '[data-test="sidebar-menu-button"]',
            );
            const profileAvatar = profileButton.locator('[data-slot="avatar"]');
            const profileButtonBox = await profileButton.boundingBox();
            const profileAvatarBox = await profileAvatar.boundingBox();
            expect(profileButtonBox).not.toBeNull();
            expect(profileAvatarBox).not.toBeNull();
            expect(
                Math.abs(
                    profileButtonBox!.x +
                        profileButtonBox!.width / 2 -
                        (profileAvatarBox!.x + profileAvatarBox!.width / 2),
                ),
            ).toBeLessThanOrEqual(1);
            await expect(
                profileButton.locator('[data-slot="user-info-text"]'),
            ).toBeHidden();
            await expect(profileButton.locator('svg')).toBeHidden();

            const collapsedSpacer = page
                .locator(
                    'div[data-slot="sidebar"][data-state="collapsed"] > div',
                )
                .first();
            const collapsedSpacerBox = await collapsedSpacer.boundingBox();
            expect(collapsedSpacerBox).not.toBeNull();
            expect(collapsedSpacerBox!.width).toBeLessThanOrEqual(60);
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
            await expect(page.locator('[data-slot="metric-card"]')).toHaveCount(
                3,
            );
            await expect(
                page.getByRole('link', { name: /vales liquidados/ }),
            ).toBeVisible();
            await expect(
                page.getByText('Materiales por comprobar', { exact: true }),
            ).toBeVisible();
            await expect(
                page.locator('[data-slot="metric-notices"]'),
            ).toHaveCount(0);
            await expect(
                page.getByRole('group', { name: 'Mostrar vales de' }),
            ).toHaveCount(0);

            const themeToggle = page.getByRole('button', {
                name: 'Cambiar a tema oscuro',
            });
            await expect(themeToggle).toBeVisible();
            await assertNoPressScale(page, themeToggle);
            await themeToggle.click();
            await expect(page.locator('html')).toHaveClass(/dark/);
            expect(
                await page.evaluate(() => localStorage.getItem('appearance')),
            ).toBe('dark');
            await page
                .getByRole('button', { name: 'Cambiar a tema claro' })
                .click();
            await expect(page.locator('html')).not.toHaveClass(/dark/);
            expect(
                await page.evaluate(() => localStorage.getItem('appearance')),
            ).toBe('light');

            await page.goto('/settings/appearance', {
                waitUntil: 'networkidle',
            });
            await expect(
                page.getByRole('button', { name: 'Sistema' }),
            ).toBeVisible();

            await page.goto('/vouchers', { waitUntil: 'networkidle' });
            await expect(page.getByLabel('Tipo de vale')).toContainText(
                'Almacén',
            );
            await expect(
                page.getByRole('button', { name: 'Aplicar filtros' }),
            ).toHaveCount(0);
            await expect(page.getByText('Sin filtros activos')).toBeVisible();

            await page.goto('/vouchers/create', { waitUntil: 'networkidle' });
            const voucherTypeSelect = page.locator('#voucher-type');
            await voucherTypeSelect.click();
            await assertFloatingSurfaceDoesNotZoom(
                page.locator('[data-slot="select-content"]'),
            );
            await page.keyboard.press('Escape');

            const receiverSelect = page.locator('#voucher-receiver');
            await assertNoPressScale(page, receiverSelect);
            await receiverSelect.click();
            await assertFloatingSurfaceDoesNotZoom(
                page.locator('[data-slot="popover-content"]'),
            );
            await page.keyboard.press('Escape');

            await page.goto('/vouchers', { waitUntil: 'networkidle' });
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
                .getByRole('textbox', { name: 'Buscar', exact: true })
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
            await page.getByRole('button', { name: 'Cerrar diálogo' }).click();

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
            await page.getByRole('button', { name: 'Cerrar diálogo' }).click();

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
            await page.getByRole('button', { name: 'Cerrar diálogo' }).click();

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

            await page.goto('/catalogs', { waitUntil: 'networkidle' });
            await expect(
                page.getByRole('heading', { name: 'Personas', exact: true }),
            ).toBeVisible();
            await expect(
                page.getByRole('navigation', {
                    name: 'Catálogos disponibles',
                }),
            ).toBeVisible();
            const activeCatalog = page.getByRole('button', {
                name: /Personas/,
            });
            await expect(activeCatalog).toHaveAttribute('aria-current', 'page');
            await assertNoPressScale(page, activeCatalog);
            await page.getByRole('button', { name: /Materiales/ }).click();
            await expect(page).toHaveURL(/section=materials/);
            await expect(
                page.getByRole('heading', { name: 'Materiales', exact: true }),
            ).toBeVisible();
            await expect(
                page.getByRole('columnheader', { name: 'Unidad' }),
            ).toBeVisible();
            await expect(
                page.getByRole('columnheader', { name: 'Disponible en' }),
            ).toBeVisible();
            expect(await page.locator('tbody tr').count()).toBeLessThanOrEqual(
                25,
            );

            let catalogFilterRequests = 0;
            const countCatalogFilterRequests = (request: Request) => {
                const url = new URL(request.url());

                if (
                    url.pathname === '/catalogs' &&
                    request.headers()['x-inertia'] === 'true' &&
                    url.searchParams.has('search')
                ) {
                    catalogFilterRequests++;
                }
            };
            page.on('request', countCatalogFilterRequests);
            await page
                .getByRole('textbox', { name: 'Buscar', exact: true })
                .pressSequentially('cable', { delay: 40 });
            await expect
                .poll(() => catalogFilterRequests, { timeout: 1500 })
                .toBe(1);
            page.off('request', countCatalogFilterRequests);
            await page
                .getByRole('button', { name: /Limpiar 1 filtro/ })
                .click();
            await page.waitForLoadState('networkidle');

            await page.getByRole('button', { name: /Ubicaciones/ }).click();
            await expect(page).toHaveURL(/section=destinations/);
            await expect(
                page.getByRole('heading', {
                    name: 'Ubicaciones',
                    exact: true,
                }),
            ).toBeVisible();
            await page.goBack({ waitUntil: 'networkidle' });
            await expect(
                page.getByRole('heading', { name: 'Materiales', exact: true }),
            ).toBeVisible();
            await page
                .getByRole('button', { name: 'Gestionar unidades' })
                .click();
            await expect(
                page.getByRole('heading', { name: 'Gestionar unidades' }),
            ).toBeVisible();
            await page.getByRole('button', { name: 'Cerrar diálogo' }).click();

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

        if (viewport.name === 'mobile-light') {
            await page.goto('/dashboard', { waitUntil: 'networkidle' });
            await expect(page.locator('[data-slot="metric-card"]')).toHaveCount(
                3,
            );
            await expect(
                page.getByRole('link', { name: /vales liquidados/ }),
            ).toBeVisible();

            await page.goto('/catalogs', { waitUntil: 'networkidle' });
            await expect(
                page.getByRole('navigation', {
                    name: 'Catálogos disponibles',
                }),
            ).toBeVisible();
            await expect(
                page.getByRole('heading', { name: 'Personas', exact: true }),
            ).toBeVisible();
            await expect(page.locator('article').first()).toBeVisible();
            await expect(page.getByRole('table')).not.toBeVisible();
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
