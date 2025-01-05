import { print, resetStorage } from '@massalabs/massa-as-sdk';
import { SafeMath256 } from '../lib/safeMath';
import { u128, u256 } from 'as-bignum/assembly';
import { f64ToU256, normalizeToDecimals } from '../lib/math';

beforeEach(() => {
  resetStorage();
});

describe('test sqrt calculations', () => {
  it('sqrt calculation', () => {
    const sqrt = SafeMath256.sqrt(u256.from(25));
    print(`sqrt of 25: ${sqrt.toString()}`);
    expect(sqrt).toBe(u256.from(5));
  });
});

describe('test f64ToU256', () => {
  it('test f64ToU256', () => {
    const input = 0.001; // f64 input
    const result = f64ToU256(input, 9); // Call the function to test
    const expected = u256.from(1000000); // 0.001 * 10^9

    print(`f64ToU256(${input}): ${result.toString()}`);
    expect(result).toStrictEqual(expected); // Validate the result
  });

  it('test f64ToU256 with larget number 1', () => {
    const input = 1; // f64 input
    const result = f64ToU256(input, 9);
    const expected = u256.from(1000000000); // 1 * 10^9

    print(`f64ToU256(${input}): ${result.toString()}`);
    expect(result).toStrictEqual(expected);
  });

  it('test f64ToU256 with edge case (zero)', () => {
    const input = 0.0; // f64 input
    const result = f64ToU256(input, 9);
    const expected = u256.from(0); // 0 * 10^9

    print(`f64ToU256(${input}): ${result.toString()}`);
    expect(result).toStrictEqual(expected);
  });

  it('test f64ToU256 with edge case (negative value)', () => {
    const input = -0.001; // f64 input

    expect(() => {
      f64ToU256(input, 9); // This should throw an error
    }).toThrow('Negative values are not supported.');
  });
});

describe('test convertU256To18Decimals', () => {
  it('normalize 9 decimals to 18 decimals', () => {
    const input = u256.from(1000000000); // 1e9 (with 9 decimals)
    const currentDecimals = 9;
    const result = normalizeToDecimals(input, currentDecimals, 18);
    const expected = u256.from(1000000000000000000); // 1e9

    print(
      `normalizeToDecimals(${input.toString()}, ${currentDecimals}): ${result.toString()}`,
    );
    expect(result).toStrictEqual(expected);
  });

  it('already normalized to 18 decimals', () => {
    const input = u256.from(1000000000000000000); // 1e18
    const currentDecimals = 18;
    const result = normalizeToDecimals(input, currentDecimals, 18);
    const expected = u256.from(1000000000000000000); // No change

    print(
      `normalizeToDecimals(${input.toString()}, ${currentDecimals}): ${result.toString()}`,
    );
    expect(result).toStrictEqual(expected);
  });

  it('normalize 6 decimals to 18 decimals', () => {
    const input = u256.from(234567); // 234567 (with 6 decimals)
    const currentDecimals = 6;
    const result = normalizeToDecimals(input, currentDecimals, 18);
    const expected = u256.from(234567000000000000); // 234567 * 10^12

    print(
      `normalizeToDecimals(${input.toString()}, ${currentDecimals}): ${result.toString()}`,
    );
    expect(result).toStrictEqual(expected);
  });

  it('handle 0 value with any decimals', () => {
    const input = u256.from(0); // Zero
    const currentDecimals = 9;
    const result = normalizeToDecimals(input, currentDecimals, 18);
    const expected = u256.from(0); // Still zero

    print(
      `normalizeToDecimals(${input.toString()}, ${currentDecimals}): ${result.toString()}`,
    );
    expect(result).toStrictEqual(expected);
  });

  it('throws error for invalid decimals greater than 18', () => {
    expect(() => {
      const input = u256.from(123456); // Example value
      const currentDecimals = 20; // Invalid decimals (>18)

      normalizeToDecimals(input, currentDecimals, 18); // Should throw
    }).toThrow('Decimals greater than 18 are not supported.');
  });

  it('normalize 18 decimals to 9 decimals', () => {
    const input = u256.from(1000000000000000000); // 1e18
    const currentDecimals = 18;
    const result = normalizeToDecimals(input, currentDecimals, 9);
    const expected = u256.from(1000000000); // 1e9

    print(
      `normalizeToDecimals(${input.toString()}, ${currentDecimals}): ${result.toString()}`,
    );
    expect(result).toStrictEqual(expected);
  });

  it('normalize 18 decimals to 6 decimals', () => {
    const input = u256.fromU128(u128.fromString('123456000000000000000')); // 123.456 * 10^18
    const currentDecimals = 18;
    const result = normalizeToDecimals(input, 18, 6);
    const expected = u256.from(123456000); // 123.456 * 10^6

    print(
      `normalizeTo18Decimals(${input.toString()}, ${currentDecimals}): ${result.toString()}`,
    );
    expect(result).toStrictEqual(expected);
  });
});
