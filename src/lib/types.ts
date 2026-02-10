export interface Store {
  id: string;
  name: string;
  createdAt: string;
}

export interface UserStoreMembership {
  id: string;
  userId: string;
  storeId: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  storeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Sale {
  id: string;
  items: CartItem[];
  total: number;
  createdAt: string;
}
