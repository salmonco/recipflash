import { Menu } from './Menu';

export interface Recipe {
  id: number;
  title: string;
  menus: Menu[];
}
