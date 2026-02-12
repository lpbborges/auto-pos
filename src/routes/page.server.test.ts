import { describe, it, expect, vi, beforeEach } from "vitest";
import { actions } from "./+page.server";
import {
  createMockLocals,
  createMockFormData,
  createMockCookies,
} from "$lib/test-utils/factories";

vi.mock("@sveltejs/kit", () => ({
  redirect: vi.fn((status, location) => {
    throw { status, location };
  }),
}));

describe("actions", () => {
  let locals: ReturnType<typeof createMockLocals>;
  let cookies: ReturnType<typeof createMockCookies>;

  beforeEach(() => {
    locals = createMockLocals();
    cookies = createMockCookies();
    vi.clearAllMocks();
  });

  describe("createProduct", () => {
    it("should create product with valid data", async () => {
      const formData = createMockFormData({
        name: "Test Product",
        price: "100",
        stock: "10",
      });

      const result = await actions.createProduct({
        request: { formData: () => Promise.resolve(formData) },
        locals,
      } as any);

      expect(result.success).toBe(true);
      expect(result.product).toBeDefined();
      expect(result.product.name).toBe("Test Product");
    });

    it("should return error for missing name", async () => {
      const formData = createMockFormData({
        price: "100",
        stock: "10",
      });

      const result = await actions.createProduct({
        request: { formData: () => Promise.resolve(formData) },
        locals,
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid product data");
    });

    it("should return error for invalid price", async () => {
      const formData = createMockFormData({
        name: "Test",
        price: "invalid",
        stock: "10",
      });

      const result = await actions.createProduct({
        request: { formData: () => Promise.resolve(formData) },
        locals,
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid product data");
    });

    it("should return error when user not authenticated", async () => {
      locals.user = null;
      const formData = createMockFormData({
        name: "Test",
        price: "100",
        stock: "10",
      });

      const result = await actions.createProduct({
        request: { formData: () => Promise.resolve(formData) },
        locals,
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("User not authenticated");
    });

    it("should include store_id in product", async () => {
      const formData = createMockFormData({
        name: "Test",
        price: "100",
        stock: "10",
      });

      const result = await actions.createProduct({
        request: { formData: () => Promise.resolve(formData) },
        locals,
      } as any);

      expect(result.success).toBe(true);
      expect(result.product.store_id).toBeDefined();
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

      const result = await actions.updateProduct({
        request: { formData: () => Promise.resolve(formData) },
        locals,
      } as any);

      expect(result.success).toBe(true);
    });

    it("should return error for missing id", async () => {
      const formData = createMockFormData({
        name: "Test",
        price: "100",
        stock: "10",
      });

      const result = await actions.updateProduct({
        request: { formData: () => Promise.resolve(formData) },
        locals,
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid product data");
    });
  });

  describe("deleteProduct", () => {
    it("should soft delete product", async () => {
      const formData = createMockFormData({ id: "product-1" });

      const result = await actions.deleteProduct({
        request: { formData: () => Promise.resolve(formData) },
        locals,
      } as any);

      expect(result.success).toBe(true);
    });

    it("should return error for missing id", async () => {
      const formData = createMockFormData({});

      const result = await actions.deleteProduct({
        request: { formData: () => Promise.resolve(formData) },
        locals,
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Product ID is required");
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

      const result = await actions.processSale({
        request: { formData: () => Promise.resolve(formData) },
        locals,
      } as any);

      expect(result.success).toBe(true);
      expect(result.sale).toBeDefined();
    });

    it("should return error for invalid items", async () => {
      const formData = createMockFormData({
        total: "100",
      });

      const result = await actions.processSale({
        request: { formData: () => Promise.resolve(formData) },
        locals,
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid sale data");
    });

    it("should return error when user not authenticated", async () => {
      locals.user = null;
      const formData = createMockFormData({
        items: JSON.stringify([]),
        total: "0",
      });

      const result = await actions.processSale({
        request: { formData: () => Promise.resolve(formData) },
        locals,
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("User not authenticated");
    });
  });

  describe("logout", () => {
    it("should sign out user and redirect", async () => {
      try {
        await actions.logout({
          locals,
          cookies,
        } as any);
        expect.fail("Should have thrown redirect");
      } catch (error: any) {
        expect(error.status).toBe(303);
        expect(error.location).toBe("/login");
      }
    });

    it("should return error on sign out failure", async () => {
      locals.supabase.auth.signOut = vi
        .fn()
        .mockResolvedValue({ error: { message: "Sign out failed" } });

      const result = await actions.logout({
        locals,
        cookies,
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Sign out failed");
    });
  });
});
