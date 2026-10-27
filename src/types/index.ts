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
}
