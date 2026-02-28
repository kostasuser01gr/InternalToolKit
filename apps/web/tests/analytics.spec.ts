
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, loginName: string, pin: string) {
  await page.goto("/login");
  await page.getByLabel("Login name").fill(loginName);
  await page.getByLabel("PIN").fill(pin);
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await expect(page).toHaveURL(/\/(overview|home|chat)$/, { timeout: 20_000 });
}

test("analytics page loads", async ({ page }) => {
  await login(page, "admin", "1234");
  await page.goto("/analytics");
  await expect(page.getByTestId("analytics-page")).toBeVisible({ timeout: 15_000 });
});
