export interface MarketIndexCandle {
  index_code: string;
  period_type: string;
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

export interface InvestorNetDailyItem {
  dt: string;
  market_type: string;
  period_type: string;
  foreigner_net_buy?: number;
  foreigner_net_sell?: number;
  foreigner_net?: number;
  institution_net_buy?: number;
  institution_net_sell?: number;
  institution_net?: number;
  individual_net_buy?: number;
  individual_net_sell?: number;
  individual_net?: number;
  financial_investment_net_buy?: number;
  financial_investment_net_sell?: number;
  financial_investment_net?: number;
  insurance_net_buy?: number;
  insurance_net_sell?: number;
  insurance_net?: number;
  trust_net_buy?: number;
  trust_net_sell?: number;
  trust_net?: number;
  private_equity_fund_net_buy?: number;
  private_equity_fund_net_sell?: number;
  private_equity_fund_net?: number;
  bank_net_buy?: number;
  bank_net_sell?: number;
  bank_net?: number;
  pension_fund_net_buy?: number;
  pension_fund_net_sell?: number;
  pension_fund_net?: number;
  other_financial_institution_net_buy?: number;
  other_financial_institution_net_sell?: number;
  other_financial_institution_net?: number;
}

export interface InvestorNetCumulativeItem {
  dt: string;
  market_type: string;
  period_type: string;
  foreigner_net: number;
  foreigner_cum_net: number;
  institution_net: number;
  institution_cum_net: number;
  individual_net: number;
  individual_cum_net: number;
  pension_fund_net: number;
  pension_fund_cum_net: number;
}

export interface InvestorDailyNetItem {
  sync_at: string;
  foreigner_net: number;
  institution_net: number;
  individual_net: number;
  financial_investment_net: number;
  pension_fund_net: number;
}

export interface InvestorDailyNetResponse {
  market_type: string;
  dt: string;
  next_update_at?: string;
  last_sync_at?: string;
  items: InvestorDailyNetItem[];
}

export interface MacroIndicatorItem {
  symbol: string;
  name?: string;
  period_type: string;
  date: string;
  value: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  unit?: string;
}

export interface TrackedStock {
  id: number;
  stock_code: string;
  stock_name: string;
  market: string;
  is_active: boolean;
}

export interface StockCandle {
  stock_code: string;
  period_type: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
