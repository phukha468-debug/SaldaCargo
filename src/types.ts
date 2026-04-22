export type UserRole = 'driver' | 'loader' | 'mechanic' | 'mechanic_lead' | 'dispatcher' | 'accountant' | 'admin' | 'owner';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  roles: UserRole[];
  activeVehicleId?: string;
  balance: number;
}

export type VehicleType = 'valday' | 'gazelle' | 'mitsubishi';

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  type: VehicleType;
  capacity: string;
  gpsEnabled: boolean;
  currentOdometer: number;
  nextServiceKm: number;
}

export type LifecycleStatus = 'draft' | 'approved' | 'cancelled';
export type SettlementStatus = 'pending' | 'completed';

export interface Trip {
  id: string;
  driverId: string;
  loaderId?: string;
  vehicleId: string;
  startTime: any; // Firestore Timestamp
  endTime?: any;
  startOdometer: number;
  endOdometer?: number;
  status: LifecycleStatus;
  revenue: number;
  driverSalary: number;
  loaderSalary: number;
  expenses: number;
  profit: number;
}

export type PaymentMethod = 'cash' | 'qr' | 'invoice' | 'debt' | 'card';

export interface Order {
  id: string;
  tripId: string;
  clientName: string;
  amount: number;
  driverSalary: number;
  loaderSalary: number;
  paymentMethod: PaymentMethod;
  settlementStatus: SettlementStatus;
  lifecycleStatus: LifecycleStatus;
  createdAt: any;
}

export interface Expense {
  id: string;
  tripId: string;
  category: string;
  amount: number;
  paymentMethod: string;
  photoUrl?: string;
  lifecycleStatus: LifecycleStatus;
  createdAt: any;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'in' | 'out';
  category: string;
  tripId?: string;
  orderId?: string;
  expenseId?: string;
  settlementStatus?: SettlementStatus;
  createdAt: any;
  description: string;
}
