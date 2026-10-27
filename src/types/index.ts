export interface Product {
  id: string;
  code: string;
  name: string;
  technicalName: string;
  category: string;
  packSize: string;
  bottlesPerCase?: number;
  casePrice?: number;
  caseSize?: string;
  unitLabel?: string;
  mrp: number;
  dealerPrice: number;
  distributorPrice?: number;
  gst?: number;
  stock?: number;
  reservedStock?: number;
  warehouse?: string;
  recommendedCrops?: string[];
  dosage?: string;
  description?: string;
  imageUrl?: string;
  status: 'Available' | 'Unavailable' | string;
  is_available?: boolean;
  is_priced?: boolean;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  packSize: string;
  quantity: number; // Number of full cases
  cases?: number;
  bottlesPerCase?: number;
  casePrice?: number;
  totalBottles?: number;
  dealerPrice: number;
  mrp: number;
  subtotal: number;
  imageUrl?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  date: string;
  dealerId: string;
  dealerName: string;
  dealerCode: string;
  dealerCity: string;
  distributorId: string;
  distributorName: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  status: string;
  paymentStatus: string;
  remarks?: string;
  createdAt: string;
}

export interface Dealer {
  id: string;
  code: string;
  name: string;
  ownerName?: string;
  phone?: string;
  email?: string;
  city: string;
  state?: string;
  address?: string;
  gstin?: string;
  creditLimit?: number;
  distributorId?: string;
  distributorName?: string;
}
