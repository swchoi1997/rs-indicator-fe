import axios from 'axios';
import type {
  MarketIndexCandle,
  InvestorNetDailyItem,
  InvestorNetCumulativeItem,
  InvestorDailyNetResponse,
  MacroIndicatorItem,
  TrackedStock,
  StockCandle,
} from './types';


const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getIndexCandles = async (
  startDate: string,
  endDate: string,
  indexCode = 'KOSPI',
  periodType = 'D'
): Promise<MarketIndexCandle[]> => {
  const { data } = await api.get<MarketIndexCandle[]>('/market/index-candles', {
    params: {
      start_date: startDate,
      end_date: endDate,
      index_code: indexCode,
      period_type: periodType,
    },
  });
  return data;
};

export const getInvestorNet = async (
  startDate: string,
  endDate: string,
  marketType = 'KOSPI',
  investorType = 'ALL',
  periodType = 'D'
): Promise<InvestorNetDailyItem[]> => {
  const { data } = await api.get<InvestorNetDailyItem[]>('/market/investor-net', {
    params: {
      start_date: startDate,
      end_date: endDate,
      market_type: marketType,
      investor_type: investorType,
      period_type: periodType,
    },
  });
  return data;
};

export const getInvestorNetCumulative = async (
  startDate: string,
  endDate: string,
  marketType = 'KOSPI'
): Promise<InvestorNetCumulativeItem[]> => {
  const { data } = await api.get<InvestorNetCumulativeItem[]>('/market/investor-net-cumulative', {
    params: {
      start_date: startDate,
      end_date: endDate,
      market_type: marketType,
    },
  });
  return data;
};

export const getInvestorDailyNet = async (
  marketType = 'KOSPI',
  dt?: string
): Promise<InvestorDailyNetResponse> => {
  const { data } = await api.get<InvestorDailyNetResponse>('/market/investor-daily-net', {
    params: {
      market_type: marketType,
      dt,
    },
  });
  return data;
};

export const getMacroIndicators = async (
  startDate: string,
  endDate: string,
  symbol = 'US10Y',
  periodType = 'D'
): Promise<MacroIndicatorItem[]> => {
  const { data } = await api.get<MacroIndicatorItem[]>('/market/macro-indicators', {
    params: {
      start_date: startDate,
      end_date: endDate,
      symbol,
      period_type: periodType,
    },
  });
  return data;
};

export const getTrackedStocks = async (): Promise<TrackedStock[]> => {
  const { data } = await api.get<TrackedStock[]>('/stocks');
  return data;
};

export const getStockCandles = async (
  startDate: string,
  endDate: string,
  stockCode: string,
  periodType = 'D',
  source: 'ALL' | 'KRX' = 'ALL'
): Promise<StockCandle[]> => {
  const { data } = await api.get<StockCandle[]>('/stocks/candles', {
    params: {
      start_date: startDate,
      end_date: endDate,
      stock_code: stockCode,
      period_type: periodType,
      source,
    },
  });
  return data;
};

export const getBatchSchedules = async (): Promise<any[]> => {
  const { data } = await api.get<any[]>('/market/batch-schedules');
  return data;
};

export default api;
