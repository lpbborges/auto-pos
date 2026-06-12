import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ProductUnit } from './constants'
import { PRODUCT_UNITS, UNIT_ALLOWS_FRACTIONS } from './constants'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount)
}

export function formatQuantity(quantity: number, unit: ProductUnit): string {
  if (UNIT_ALLOWS_FRACTIONS[unit]) {
    return `${quantity.toFixed(3)} ${unit}`
  }
  return `${Math.round(quantity)} ${unit}`
}

export function formatPricePerUnit(price: number, unit: ProductUnit): string {
  return `${formatCurrency(price)}/${unit}`
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatDateOnly(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export function validateProductData(
  name: string | null | undefined,
  price: number,
  unit: string,
): string | null {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return 'Nome do produto inválido'
  if (trimmed.length > 255) return 'Nome do produto muito longo'
  if (isNaN(price) || price <= 0) return 'Preço inválido'
  if (!PRODUCT_UNITS.includes(unit as (typeof PRODUCT_UNITS)[number]))
    return 'Unidade inválida'
  return null
}
