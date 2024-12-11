import { u128, u256 } from 'as-bignum/assembly';

export const SCALE_OFFSET = 128;

/**
 * Returns the value of x^y. It calculates `1 / x^abs(y)` if x is bigger than 2^128.
 *  At the end of the operations, we invert the result if needed.
 * @param x The unsigned 128.128-binary fixed-point number for which to calculate the power
 * @param y A relative number without any decimals, needs to be between ]-2^20; 2^20[
 * @return The result of `x^y`
 */
export function powerU256(x: u256, y: i64): u256 {
  let invert = false;
  let absY: i64 = 0;

  let result: u256 = u256.Zero;

  if (y == 0) return u256.shl(u256.One, SCALE_OFFSET);

  absY = y;
  if (absY < 0) {
    absY = sub(0, absY);
    invert = !invert;
  }

  if (absY < 0x100000) {
    result = u256.shl(u256.One, SCALE_OFFSET);
    let pow = x;
    if (u256.gt(x, u256.from(u128.Max))) {
      pow = u256.div(u256.Zero.not(), x);
      invert = !invert;
    }

    if (absY & 0x1) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x2) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x4) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x8) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x10) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x20) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x40) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x80) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x100) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x200) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x400) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x800) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x1000) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x2000) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x4000) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x8000) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x10000) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x20000) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x40000) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
    pow = u256.shr(u256.mul(pow, pow), 128);
    if (absY & 0x80000) {
      result = u256.shr(u256.mul(result, pow), 128);
    }
  }

  // revert if y is too big or if x^y underflowed
  assert(
    result != u256.Zero,
    `PowerUnderflow: x=${x.toString()} y=${y.toString()}`,
  );

  return invert ? u256.div(u256.Max, result) : result;
}
