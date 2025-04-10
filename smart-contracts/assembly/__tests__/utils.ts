import { u256 } from 'as-bignum/assembly';

export const TOKENS_DEFAULT_DECIMALS = 9;

export function formatUnits(value: u256, decimals: u32): string {
  return value.toString() + '.' + value.toString().padStart(decimals, '0');
}

export function parseUnits(value: string, decimals: u32): u256 {
  return u256.from(
    value.split('.')[0] + value.split('.')[1].padEnd(decimals, '0'),
  );
}

export function parseMas(value: f64): u256 {
  return u256.fromF64(value * f64(10 ** TOKENS_DEFAULT_DECIMALS));
}
