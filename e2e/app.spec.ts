import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should redirect to login when not authenticated", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/.*login/);
  });

  test("should login successfully", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "wrong@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Invalid")).toBeVisible();
  });
});

test.describe("Products", () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]"');
  });

  test("should display product list", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Produtos")).toBeVisible();
    await expect(page.locator("table")).toBeVisible();
  });

  test("should add new product", async ({ page }) => {
    await page.goto("/");
    await page.click('button:has-text("Adicionar")');
    await page.fill('input[name="name"]', "New Test Product");
    await page.fill('input[name="price"]', "99.99");
    await page.fill('input[name="stock"]', "50");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=New Test Product")).toBeVisible();
  });

  test("should search products", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[type="search"]', "test");
    await expect(page.locator("table tbody tr")).toHaveCount(1);
  });

  test("should edit product", async ({ page }) => {
    await page.goto("/");
    await page.click('button[title="Editar"]').first();
    await page.fill('input[name="name"]', "Updated Name");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Updated Name")).toBeVisible();
  });

  test("should soft delete product", async ({ page }) => {
    await page.goto("/");
    const productName = await page
      .locator("table tbody tr:first-child td:first-child")
      .textContent();
    await page.click('button[title="Deletar"]').first();
    await page.click('button:has-text("Deletar")');
    await expect(page.locator(`text=${productName}`)).not.toBeVisible();
  });
});

test.describe("Sales", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
  });

  test("should switch to sales tab", async ({ page }) => {
    await page.goto("/");
    await page.click('button:has-text("Vendas")');
    await expect(page.locator("text=Vendas")).toBeVisible();
  });

  test("should add product to cart", async ({ page }) => {
    await page.goto("/");
    await page.click('button:has-text("Vendas")');
    await page.click(".product-card").first();
    await expect(page.locator('button:has-text("Carrinho")')).toContainText(
      "1",
    );
  });

  test("should open cart and checkout", async ({ page }) => {
    await page.goto("/");
    await page.click('button:has-text("Vendas")');
    await page.click(".product-card").first();
    await page.click('button:has-text("Carrinho")');
    await expect(page.locator("text=Itens no carrinho")).toBeVisible();
    await page.click('button:has-text("Finalizar")');
    await expect(page.locator("text=Confirmar venda")).toBeVisible();
  });

  test("should process sale and clear cart", async ({ page }) => {
    await page.goto("/");
    await page.click('button:has-text("Vendas")');
    await page.click(".product-card").first();
    await page.click('button:has-text("Carrinho")');
    await page.click('button:has-text("Finalizar")');
    await page.click('button:has-text("Confirmar")');
    await expect(page.locator('button:has-text("Carrinho")')).not.toContainText(
      "1",
    );
  });
});

test.describe("Sales History", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
  });

  test("should view sales history", async ({ page }) => {
    await page.goto("/sales");
    await expect(page.locator("text=Histórico de Vendas")).toBeVisible();
  });

  test("should filter by today", async ({ page }) => {
    await page.goto("/sales");
    await page.click('button:has-text("Hoje")');
    await expect(page.locator("button.bg-primary:has-text('Hoje')")).toBeVisible();
  });

  test("should filter by week", async ({ page }) => {
    await page.goto("/sales");
    await page.click('button:has-text("7 dias")');
    await expect(page.locator("button.bg-primary:has-text('7 dias')")).toBeVisible();
  });

  test("should filter by month", async ({ page }) => {
    await page.goto("/sales");
    await page.click('button:has-text("Mês")');
    await expect(page.locator("button.bg-primary:has-text('Mês')")).toBeVisible();
  });

  test("should show total revenue", async ({ page }) => {
    await page.goto("/sales");
    await expect(page.locator("text=Total do período")).toBeVisible();
  });
});

test.describe("Profile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
  });

  test("should navigate to profile", async ({ page }) => {
    await page.goto("/");
    await page.click('button:has-text("Perfil")');
    await expect(page.locator("text=Perfil")).toBeVisible();
    await expect(page.locator("text=test@example.com")).toBeVisible();
  });

  test("should toggle theme", async ({ page }) => {
    await page.goto("/");
    await page.click('button:has-text("Perfil")');
    await page.click('button:has-text("Modo")');
    // Check if theme changed
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    expect(isDark).toBeTruthy();
  });

  test("should logout", async ({ page }) => {
    await page.goto("/");
    await page.click('button:has-text("Perfil")');
    await page.click('button:has-text("Sair")');
    await expect(page).toHaveURL(/.*login/);
  });
});

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
  });

  test("should show bottom navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('button:has-text("Produtos")')).toBeVisible();
    await expect(page.locator('button:has-text("Vendas")')).toBeVisible();
    await expect(page.locator('button:has-text("Perfil")')).toBeVisible();
  });

  test("should highlight active tab", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator('button.bg-primary:has-text("Produtos")'),
    ).toBeVisible();
    await page.click('button:has-text("Vendas")');
    await expect(
      page.locator('button.bg-primary:has-text("Vendas")'),
    ).toBeVisible();
  });
});
