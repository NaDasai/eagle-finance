import { print, resetStorage } from '@massalabs/massa-as-sdk';
import { SafeMath256 } from '../../lib/safeMath';
import { u128, u256 } from 'as-bignum/assembly';
import { parseMas } from '../utils';
import { getFeeFromAmount } from '../../lib/basicPoolMath';

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

describe('test getFeeFromAmount', () => {
  test('getFeeFromAmount of 0.3% of 100 should be 0.3', () => {
    const inputAmount = parseMas(100);
    const fee = f64(0.3 * 10_000); // 0.3% ===> 3000
    const result = getFeeFromAmount(inputAmount, fee);
    print('Input amount: ' + inputAmount.toString());
    print('Fee: ' + fee.toString());
    print('Result of fee amount: ' + result.toString());
    expect(result).toStrictEqual(parseMas(0.3));
  });

  test('getFeeFromAmount of 0.3% of 10 should be 0.03', () => {
    const inputAmount = parseMas(10);
    const fee = f64(0.3 * 10_000); // 0.3% ===> 3000
    const result = getFeeFromAmount(inputAmount, fee);
    print('Input amount: ' + inputAmount.toString());
    print('Fee: ' + fee.toString());
    print('Result of fee amount: ' + result.toString());
    expect(result).toStrictEqual(parseMas(0.03));
  });

  test('getFeeFromAmount of 0.3% of 5 should be 0.015', () => {
    const inputAmount = parseMas(5);
    const fee = f64(0.3 * 10_000); // 0.3% ===> 3000
    const result = getFeeFromAmount(inputAmount, fee);
    print('Input amount: ' + inputAmount.toString());
    print('Fee: ' + fee.toString());
    print('Result of fee amount: ' + result.toString());
    expect(result).toStrictEqual(parseMas(0.015));
  });
});
