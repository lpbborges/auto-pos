import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import { cart, cartTotal, cartItemCount } from "./cart";
import { createProduct } from "$lib/test-utils/factories";

describe("cart store", () => {
  beforeEach(() => {
    cart.clear();
  });

  describe("initialization", () => {
    it("should initialize empty", () => {
      expect(get(cart)).toEqual([]);
    });
  });

  describe("add", () => {
    it("should add product to cart", () => {
      const product = createProduct();
      cart.add(product);

      const items = get(cart);
      expect(items).toHaveLength(1);
      expect(items[0].product.id).toBe(product.id);
      expect(items[0].quantity).toBe(1);
    });

    it("should increment quantity if product already in cart", () => {
      const product = createProduct();
      cart.add(product);
      cart.add(product);

      const items = get(cart);
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(2);
    });

    it("should add different products separately", () => {
      const product1 = createProduct({ id: "1" });
      const product2 = createProduct({ id: "2" });

      cart.add(product1);
      cart.add(product2);

      const items = get(cart);
      expect(items).toHaveLength(2);
    });
  });

  describe("remove", () => {
    it("should remove product from cart", () => {
      const product = createProduct();
      cart.add(product);
      cart.remove(product.id);

      expect(get(cart)).toHaveLength(0);
    });

    it("should only remove specified product", () => {
      const product1 = createProduct({ id: "1" });
      const product2 = createProduct({ id: "2" });

      cart.add(product1);
      cart.add(product2);
      cart.remove(product1.id);

      const items = get(cart);
      expect(items).toHaveLength(1);
      expect(items[0].product.id).toBe("2");
    });
  });

  describe("updateQuantity", () => {
    it("should update quantity", () => {
      const product = createProduct();
      cart.add(product);
      cart.updateQuantity(product.id, 5);

      const items = get(cart);
      expect(items[0].quantity).toBe(5);
    });

    it("should remove item when quantity is 0", () => {
      const product = createProduct();
      cart.add(product);
      cart.updateQuantity(product.id, 0);

      expect(get(cart)).toHaveLength(0);
    });

    it("should remove item when quantity is negative", () => {
      const product = createProduct();
      cart.add(product);
      cart.updateQuantity(product.id, -1);

      expect(get(cart)).toHaveLength(0);
    });
  });

  describe("clear", () => {
    it("should remove all items", () => {
      const product1 = createProduct({ id: "1" });
      const product2 = createProduct({ id: "2" });

      cart.add(product1);
      cart.add(product2);
      cart.clear();

      expect(get(cart)).toHaveLength(0);
    });
  });

  describe("cartTotal", () => {
    it("should calculate total correctly", () => {
      const product1 = createProduct({ price: 100 });
      const product2 = createProduct({ price: 50 });

      cart.add(product1);
      cart.add(product1); // quantity 2
      cart.add(product2); // quantity 1

      expect(get(cartTotal)).toBe(250); // 100*2 + 50*1
    });

    it("should return 0 for empty cart", () => {
      expect(get(cartTotal)).toBe(0);
    });
  });

  describe("cartItemCount", () => {
    it("should count total items", () => {
      const product1 = createProduct({ id: "1" });
      const product2 = createProduct({ id: "2" });

      cart.add(product1);
      cart.add(product1);
      cart.add(product2);

      expect(get(cartItemCount)).toBe(3);
    });

    it("should return 0 for empty cart", () => {
      expect(get(cartItemCount)).toBe(0);
    });
  });
});
