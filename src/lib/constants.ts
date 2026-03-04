export const PRODUCT_UNITS = ['kg', 'g', 'lt', 'und'] as const
export type ProductUnit = (typeof PRODUCT_UNITS)[number]

export const UNIT_LABELS: Record<ProductUnit, string> = {
  kg: 'Quilograma',
  g: 'Grama',
  lt: 'Litro',
  und: 'Unidade',
}

export const UNIT_ALLOWS_FRACTIONS: Record<ProductUnit, boolean> = {
  kg: true,
  g: true,
  lt: true,
  und: false,
}

export const UNIT_STEP: Record<ProductUnit, number> = {
  kg: 0.001,
  g: 0.001,
  lt: 0.001,
  und: 1,
}
