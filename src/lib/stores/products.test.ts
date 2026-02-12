import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import {
  products,
  searchQuery,
  filteredProducts,
  availableProducts,
} from "./products";
import { createProduct } from "$lib/test-utils/factories";
import type { Product } from "$lib/types";

describe("products store", () => {
  beforeEach(() => {
    products.set([]);
    searchQuery.set("");
  });

  describe("initialization", () => {
    it("should initialize with empty array", () => {
      const value = get(products);
      expect(value).toEqual([]);
    });

    it("should initialize with provided products", () => {
      const initialProducts = [createProduct(), createProduct()];
      products.set(initialProducts);
      expect(get(products)).toHaveLength(2);
    });
  });

  describe("add", () => {
    it("should add product to beginning of array", () => {
      const product1 = createProduct({ name: "Product 1" });
      const product2 = createProduct({ name: "Product 2" });

      products.add(product1);
      products.add(product2);

      const value = get(products);
      expect(value).toHaveLength(2);
      expect(value[0].name).toBe("Product 2");
      expect(value[1].name).toBe("Product 1");
    });
  });

  describe("updateProduct", () => {
    it("should update existing product", () => {
      const product = createProduct({ name: "Original Name" });
      products.add(product);

      products.updateProduct({ ...product, name: "Updated Name" });

      const value = get(products);
      expect(value[0].name).toBe("Updated Name");
    });

    it("should not modify other products", () => {
      const product1 = createProduct({ name: "Product 1" });
      const product2 = createProduct({ name: "Product 2" });
      products.add(product1);
      products.add(product2);

      products.updateProduct({ ...product1, name: "Updated" });

      const value = get(products);
      expect(value[0].name).toBe("Product 2"); // product2 was added second, so it's at index 0
    });
  });

  describe("delete (soft delete)", () => {
    it("should set deletedAt timestamp", () => {
      const product = createProduct();
      products.add(product);

      products.delete(product.id);

      const value = get(products);
      expect(value[0].deletedAt).toBeDefined();
      expect(value[0].deletedAt).not.toBeNull();
    });

    it("should not remove product from array", () => {
      const product = createProduct();
      products.add(product);

      products.delete(product.id);

      expect(get(products)).toHaveLength(1);
    });
  });

  describe("decrementStock", () => {
    it("should decrement stock by quantity", () => {
      const product = createProduct({ stock: 10 });
      products.add(product);

      products.decrementStock(product.id, 3);

      const value = get(products);
      expect(value[0].stock).toBe(7);
    });

    it("should not allow negative stock", () => {
      const product = createProduct({ stock: 5 });
      products.add(product);

      products.decrementStock(product.id, 10);

      const value = get(products);
      expect(value[0].stock).toBe(0);
    });
  });

  describe("filteredProducts", () => {
    it("should exclude soft-deleted products", () => {
      const activeProduct = createProduct({ name: "Active" });
      const deletedProduct = createProduct({
        name: "Deleted",
        deletedAt: new Date().toISOString(),
      });

      products.set([activeProduct, deletedProduct]);

      const filtered = get(filteredProducts);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("Active");
    });

    it("should filter by search query", () => {
      const product1 = createProduct({ name: "Apple" });
      const product2 = createProduct({ name: "Banana" });

      products.set([product1, product2]);
      searchQuery.set("app");

      const filtered = get(filteredProducts);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("Apple");
    });

    it("should be case insensitive", () => {
      const product = createProduct({ name: "APPLE" });
      products.add(product);
      searchQuery.set("apple");

      const filtered = get(filteredProducts);
      expect(filtered).toHaveLength(1);
    });

    it("should return all non-deleted products when query is empty", () => {
      const product1 = createProduct();
      const product2 = createProduct();

      products.set([product1, product2]);

      const filtered = get(filteredProducts);
      expect(filtered).toHaveLength(2);
    });
  });

  describe("availableProducts", () => {
    it("should only include products with stock > 0", () => {
      const inStock = createProduct({ stock: 5 });
      const outOfStock = createProduct({ stock: 0 });

      products.set([inStock, outOfStock]);

      const available = get(availableProducts);
      expect(available).toHaveLength(1);
      expect(available[0].stock).toBe(5);
    });

    it("should respect deleted products", () => {
      const available = createProduct({ stock: 5 });
      const deleted = createProduct({
        stock: 5,
        deletedAt: new Date().toISOString(),
      });

      products.set([available, deleted]);

      const result = get(availableProducts);
      expect(result).toHaveLength(1);
    });
  });
});
