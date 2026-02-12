import { describe, it, expect, vi, beforeEach } from "vitest";
import { actions } from "./+page.server";
import type { RequestEvent } from "@sveltejs/kit";
import type { Actions } from "./$types";
import {
  createMockLocals,
  createMockFormData,
  createMockCookies,
} from "$lib/test-utils/factories";
import type { Product } from "$lib/types";

// Define proper return types for actions
// Note: Database returns snake_case, not camelCase
type DbProduct = Product & { store_id: string };

type ActionResult =
  | { success: true; product: DbProduct }
  | { success: false; error: string };

type SaleResult =
  | { success: true; sale: { id: string; total: number; store_id: string } }
  | { success: false; error: string };

type DeleteResult = { success: true } | { success: false; error: string };

// Type guard functions
function isSuccessResult(
  result: ActionResult | DeleteResult | SaleResult,
): result is { success: true; product: Product } {
  return (
    result.success === true &&
    "product" in result &&
    result.product !== undefined
  );
}

function isErrorResult(
  result: ActionResult | DeleteResult | SaleResult,
): result is { success: false; error: string } {
  return result.success === false && "error" in result;
}

function isSaleSuccess(
  result: SaleResult | ActionResult | DeleteResult,
): result is { success: true; sale: { id: string; total: number } } {
  return result.success === true && "sale" in result;
}

function isDeleteSuccess(
  result: DeleteResult | ActionResult | SaleResult,
): result is { success: true } {
  return (
    result.success === true && !("product" in result) && !("sale" in result)
  );
}

// Mock redirect
vi.mock("@sveltejs/kit", async () => {
  const actual =
    await vi.importActual<typeof import("@sveltejs/kit")>("@sveltejs/kit");
  return {
    ...actual,
    redirect: vi.fn((status: number, location: string) => {
      throw { status, location };
    }),
  };
});

// Helper to create mock request event
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockRequestEvent(formData: FormData, localsOverride?: any): any {
  const locals = (localsOverride ??
    createMockLocals()) as unknown as App.Locals;
  return {
    request: {
      formData: () => Promise.resolve(formData),
    } as unknown as Request,
    locals,
    cookies: createMockCookies() as unknown as RequestEvent["cookies"],
    params: {},
    url: new URL("http://localhost:3000"),
    isDataRequest: false,
  };
}

describe("actions", () => {
  let locals: App.Locals;
  let cookies: RequestEvent["cookies"];

  beforeEach(() => {
    locals = createMockLocals() as unknown as App.Locals;
    cookies = createMockCookies() as unknown as RequestEvent["cookies"];
    vi.clearAllMocks();
  });

  describe("createProduct", () => {
    it("should create product with valid data", async () => {
      const formData = createMockFormData({
        name: "Test Product",
        price: "100",
        stock: "10",
      });

      const event = createMockRequestEvent(formData, locals);
      const result = (await actions.createProduct(
        event as unknown as Parameters<Actions["createProduct"]>[0],
      )) as ActionResult;

      expect(isSuccessResult(result)).toBe(true);
      if (isSuccessResult(result)) {
        expect(result.product).toBeDefined();
        expect(result.product.name).toBe("Test Product");
        expect(result.product.store_id).toBe("store-1");
      }
    });

    it("should return error for missing name", async () => {
      const formData = createMockFormData({
        price: "100",
        stock: "10",
      });

      const event = createMockRequestEvent(formData, locals);
      const result = (await actions.createProduct(
        event as unknown as Parameters<Actions["createProduct"]>[0],
      )) as ActionResult;

      expect(isErrorResult(result)).toBe(true);
      if (isErrorResult(result)) {
        expect(result.error).toBe("Invalid product data");
      }
    });

    it("should return error for invalid price", async () => {
      const formData = createMockFormData({
        name: "Test",
        price: "invalid",
        stock: "10",
      });

      const event = createMockRequestEvent(formData, locals);
      const result = (await actions.createProduct(
        event as unknown as Parameters<Actions["createProduct"]>[0],
      )) as ActionResult;

      expect(isErrorResult(result)).toBe(true);
      if (isErrorResult(result)) {
        expect(result.error).toBe("Invalid product data");
      }
    });

    it("should return error when user not authenticated", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      locals.user = null as any;
      const formData = createMockFormData({
        name: "Test",
        price: "100",
        stock: "10",
      });

      const event = createMockRequestEvent(formData, locals);
      const result = (await actions.createProduct(
        event as unknown as Parameters<Actions["createProduct"]>[0],
      )) as ActionResult;

      expect(isErrorResult(result)).toBe(true);
      if (isErrorResult(result)) {
        expect(result.error).toBe("User not authenticated");
      }
    });
  });

  describe("updateProduct", () => {
    it("should update product with valid data", async () => {
      const formData = createMockFormData({
        id: "product-1",
        name: "Updated Name",
        price: "150",
        stock: "20",
      });

      const event = createMockRequestEvent(formData, locals);
      const result = (await actions.updateProduct(
        event as unknown as Parameters<Actions["updateProduct"]>[0],
      )) as ActionResult;

      expect(isSuccessResult(result)).toBe(true);
    });

    it("should return error for missing id", async () => {
      const formData = createMockFormData({
        name: "Test",
        price: "100",
        stock: "10",
      });

      const event = createMockRequestEvent(formData, locals);
      const result = (await actions.updateProduct(
        event as unknown as Parameters<Actions["updateProduct"]>[0],
      )) as ActionResult;

      expect(isErrorResult(result)).toBe(true);
      if (isErrorResult(result)) {
        expect(result.error).toBe("Invalid product data");
      }
    });
  });

  describe("deleteProduct", () => {
    it("should soft delete product", async () => {
      const formData = createMockFormData({ id: "product-1" });

      const event = createMockRequestEvent(formData, locals);
      const result = (await actions.deleteProduct(
        event as unknown as Parameters<Actions["deleteProduct"]>[0],
      )) as DeleteResult;

      expect(isDeleteSuccess(result)).toBe(true);
    });

    it("should return error for missing id", async () => {
      const formData = createMockFormData({});

      const event = createMockRequestEvent(formData, locals);
      const result = (await actions.deleteProduct(
        event as unknown as Parameters<Actions["deleteProduct"]>[0],
      )) as DeleteResult;

      expect(isErrorResult(result)).toBe(true);
      if (isErrorResult(result)) {
        expect(result.error).toBe("Product ID is required");
      }
    });
  });

  describe("processSale", () => {
    it("should process sale with valid data", async () => {
      const items = [
        {
          product: { id: "prod-1", price: 100, stock: 10 },
          quantity: 2,
        },
      ];
      const formData = createMockFormData({
        items: JSON.stringify(items),
        total: "200",
      });

      const event = createMockRequestEvent(formData, locals);
      const result = (await actions.processSale(
        event as unknown as Parameters<Actions["processSale"]>[0],
      )) as SaleResult;

      expect(isSaleSuccess(result)).toBe(true);
      if (isSaleSuccess(result)) {
        expect(result.sale).toBeDefined();
        expect(result.sale.total).toBe(200);
      }
    });

    it("should return error for invalid items", async () => {
      const formData = createMockFormData({
        total: "100",
      });

      const event = createMockRequestEvent(formData, locals);
      const result = (await actions.processSale(
        event as unknown as Parameters<Actions["processSale"]>[0],
      )) as SaleResult;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid sale data");
      }
    });

    it("should return error when user not authenticated", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      locals.user = null as any;
      const formData = createMockFormData({
        items: JSON.stringify([]),
        total: "0",
      });

      const event = createMockRequestEvent(formData, locals);
      const result = (await actions.processSale(
        event as unknown as Parameters<Actions["processSale"]>[0],
      )) as SaleResult;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("User not authenticated");
      }
    });
  });

  describe("logout", () => {
    it("should sign out user and redirect", async () => {
      const event = {
        locals,
        cookies,
      } as unknown as Parameters<Actions["logout"]>[0];

      try {
        await actions.logout(event);
        expect.fail("Should have thrown redirect");
      } catch (error: unknown) {
        const redirectError = error as { status: number; location: string };
        expect(redirectError.status).toBe(303);
        expect(redirectError.location).toBe("/login");
      }
    });

    it("should return error on sign out failure", async () => {
      locals.supabase.auth.signOut = vi
        .fn()
        .mockResolvedValue({ error: { message: "Sign out failed" } });

      const event = {
        locals,
        cookies,
      } as unknown as Parameters<Actions["logout"]>[0];

      const result = await actions.logout(event);

      expect(result).toEqual({
        success: false,
        error: "Sign out failed",
      });
    });
  });
});
