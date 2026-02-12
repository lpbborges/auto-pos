import type { Product, CartItem, Sale } from "$lib/types";
import { vi } from "vitest";

export function createProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: crypto.randomUUID(),
    name: "Test Product",
    price: 100,
    stock: 10,
    storeId: "store-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  };
}

export function createCartItem(overrides: Partial<CartItem> = {}): CartItem {
  const product = createProduct(overrides.product);
  return {
    product,
    quantity: 1,
    ...overrides,
  };
}

export function createSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: crypto.randomUUID(),
    items: [],
    total: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockSupabaseClient() {
  const mockData: Record<string, any[]> = {
    products: [],
    sales: [],
    sale_items: [],
    stores: [],
    store_memberships: [{ store_id: "store-1", user_id: "user-1" }],
  };

  const createQueryBuilder = (table: string) => {
    let currentData = [...(mockData[table] || [])];
    let filters: Array<(record: any) => boolean> = [];
    let selectedColumns: string | null = null;

    const applyFilters = () => {
      return currentData.filter((record) =>
        filters.every((filter) => filter(record)),
      );
    };

    const builder = {
      // select() returns the builder for chaining
      select: vi.fn((columns = "*") => {
        selectedColumns = columns;
        return builder;
      }),

      // eq() adds filter and returns builder
      eq: vi.fn((column: string, value: any) => {
        filters.push((record) => record[column] === value);
        return builder;
      }),

      // is() adds null check filter
      is: vi.fn((column: string, value: any) => {
        filters.push((record) =>
          value === null ? record[column] === null : record[column] === value,
        );
        return builder;
      }),

      // order() returns builder
      order: vi.fn((column: string, { ascending = true } = {}) => {
        currentData.sort((a, b) => {
          if (ascending) return a[column] > b[column] ? 1 : -1;
          return a[column] < b[column] ? 1 : -1;
        });
        return builder;
      }),

      // gte() adds filter
      gte: vi.fn((column: string, value: any) => {
        filters.push((record) => record[column] >= value);
        return builder;
      }),

      // single() executes query and returns single result
      single: vi.fn(() => {
        const filtered = applyFilters();
        const record = filtered[0] || null;
        return Promise.resolve({
          data: record,
          error: record ? null : { message: "Not found" },
        });
      }),

      // insert() creates new records
      insert: vi.fn((records: any[]) => {
        const newRecords = records.map((r) => ({
          ...r,
          id: r.id || crypto.randomUUID(),
          created_at: new Date().toISOString(),
        }));
        mockData[table] = [...(mockData[table] || []), ...newRecords];
        
        // Return builder that supports .select().single()
        return {
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: newRecords[0],
                error: null,
              }),
            ),
          })),
          data: newRecords,
          error: null,
        };
      }),

      // update() updates records
      update: vi.fn((updates: any) => ({
        eq: vi.fn((column: string, value: any) => ({
          select: vi.fn(() => ({
            single: vi.fn(() => {
              const index = mockData[table]?.findIndex(
                (r) => r[column] === value,
              );
              if (index > -1) {
                mockData[table][index] = {
                  ...mockData[table][index],
                  ...updates,
                };
                return Promise.resolve({
                  data: mockData[table][index],
                  error: null,
                });
              }
              return Promise.resolve({ data: null, error: null });
            }),
          })),
        })),
      })),

      // delete() removes records
      delete: vi.fn(() => ({
        eq: vi.fn((column: string, value: any) => {
          mockData[table] =
            mockData[table]?.filter((r) => r[column] !== value) || [];
          return Promise.resolve({ error: null });
        }),
      })),

      // data and error for direct access
      get data() {
        return applyFilters();
      },
      error: null,
    };

    return builder;
  };

  return {
    from: vi.fn((table: string) => createQueryBuilder(table)),
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: {
            session: {
              user: { id: "user-1", email: "test@example.com" },
            },
          },
          error: null,
        }),
      ),
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: { id: "user-1", email: "test@example.com" } },
          error: null,
        }),
      ),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
    _mockData: mockData,
  };
}

export function createMockLocals() {
  return {
    user: { id: "user-1", email: "test@example.com" },
    session: { user: { id: "user-1", email: "test@example.com" } },
    supabase: createMockSupabaseClient(),
  };
}

export function createMockFormData(data: Record<string, string>): FormData {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
}

export function createMockCookies() {
  const cookies: Record<string, string> = {};
  return {
    get: vi.fn((name: string) => cookies[name] || null),
    set: vi.fn((name: string, value: string, options?: any) => {
      cookies[name] = value;
    }),
    delete: vi.fn((name: string, options?: any) => {
      delete cookies[name];
    }),
  };
}
