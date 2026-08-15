import api from './client';

export interface MenuItem {
  id: number;
  category_code: string;
  item_code: string;
  item_name: string;
  target_type: string;
  target_symbol?: string;
  route_path: string;
  display_order: number;
  is_active: boolean;
}

export interface MenuCategory {
  id: number;
  category_code: string;
  category_name: string;
  icon: string;
  display_order: number;
  is_active: boolean;
  items: MenuItem[];
}

export const getMenuTree = async (): Promise<MenuCategory[]> => {
  const { data } = await api.get<MenuCategory[]>('/menu/tree');
  return data;
};
