// ---------------------------------------------------------------------------
// What gets ordered. The dishes themselves live in `food.yaml` — adding one is
// a data edit, never a code one — and this module is only the shape they have
// to arrive in and the rolling of a ticket.
// ---------------------------------------------------------------------------

import file from './food.yaml';
import { SERVEABLE, SPICE_NAMES } from './config';
import type { Food, FoodEvent, Order } from './types';

interface MenuFile {
  quips: Record<string, Record<FoodEvent, string[]>>;
  foods: Food[];
}

// The plugin hands back a parsed object with no idea what is in it, so the
// module that owns the file is the one that says what shape it has.
const menu = file as MenuFile;

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export function rollDish(): Food {
  return pick(menu.foods);
}

/**
 * What the dish itself says about what is happening to it, in its own
 * language — which is the entire reason a dish carries one. Returns null
 * rather than falling back to English, so a language nobody has written lines
 * for stays quiet instead of having words put in its mouth.
 */
export function foodQuip(food: Food, event: FoodEvent): string | null {
  const lines = menu.quips[food.language]?.[event];
  return lines && lines.length ? pick(lines) : null;
}

/** What the diner wants. Which dish turns up is not the order's business. */
export function rollOrder(): Order {
  return {
    doneness: pick(SERVEABLE),
    spice: pick(SPICE_NAMES),
  };
}
