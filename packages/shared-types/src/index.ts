import * as ApiTypes from './api.types';

export * from './api.types';

export interface MoneyMapSummary {
  assets: number;
  liabilities: number;
  netPosition: number;
  monthlyProfit: number;
}
