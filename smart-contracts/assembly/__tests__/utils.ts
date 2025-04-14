import { u256 } from 'as-bignum/assembly';

export const TOKENS_DEFAULT_DECIMALS = 9;

// export function formatUnits(value: u256, decimals: u32): f64 {
//   return f64(value) / f64(10 ** decimals);
// }

// export function parseUnits(value: string, decimals: u32): u256 {
//   return u256.from(
//     value.split('.')[0] + value.split('.')[1].padEnd(decimals, '0'),
//   );
// }

export function parseMas(value: u64): u256 {
  return u256.fromU64(value * 10 ** TOKENS_DEFAULT_DECIMALS);
}

export function parseUnits(value: f64, decimals: u32): u256 {
  return u256.fromF64(value * 10 ** decimals);
}
