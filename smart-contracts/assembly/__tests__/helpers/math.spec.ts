import { print, resetStorage } from '@massalabs/massa-as-sdk';
import { SafeMath256 } from '../../lib/safeMath';
import { u128, u256 } from 'as-bignum/assembly';
import { parseMas, parseUnits } from '../utils';
import { getFeeFromAmount } from '../../lib/basicPoolMath';
import { normalizeToDecimals } from '../../lib/math';

beforeEach(() => {
  resetStorage();
});

// describe('test sqrt calculations', () => {
//   it('sqrt calculation', () => {
//     const sqrt = SafeMath256.sqrt(u256.from(25));
//     print(`sqrt of 25: ${sqrt.toString()}`);
//     expect(sqrt).toBe(u256.from(5));
//   });
// });

// describe('test getFeeFromAmount', () => {
//   test('getFeeFromAmount of 0.3% of 100 should be 0.3', () => {
//     const inputAmount = parseMas(100);
//     const fee = u64(0.3 * 10_000); // 0.3% ===> 3000
//     const result = getFeeFromAmount(inputAmount, fee);
//     print('Input amount: ' + inputAmount.toString());
//     print('Fee: ' + fee.toString());
//     print('Result of fee amount: ' + result.toString());
//     expect(result).toStrictEqual(parseMas(0.3));
//   });

//   test('getFeeFromAmount of 0.3% of 10 should be 0.03', () => {
//     const inputAmount = parseMas(10);
//     const fee = u64(0.3 * 10_000); // 0.3% ===> 3000
//     const result = getFeeFromAmount(inputAmount, fee);
//     print('Input amount: ' + inputAmount.toString());
//     print('Fee: ' + fee.toString());
//     print('Result of fee amount: ' + result.toString());
//     expect(result).toStrictEqual(parseMas(0.03));
//   });

//   test('getFeeFromAmount of 0.3% of 5 should be 0.015', () => {
//     const inputAmount = parseMas(5);
//     const fee = u64(0.3 * 10_000); // 0.3% ===> 3000
//     const result = getFeeFromAmount(inputAmount, fee);
//     print('Input amount: ' + inputAmount.toString());
//     print('Fee: ' + fee.toString());
//     print('Result of fee amount: ' + result.toString());
//     expect(result).toStrictEqual(parseMas(0.015));
//   });
// });

describe('test NormalizeToDecimals', () => {
  test('NormalizeToDecimals of 100 of 9 should be 1000000000000000000', () => {
    const inputAmount = parseMas(100);
    const result = normalizeToDecimals(inputAmount, 9);
    print('Input amount: ' + inputAmount.toString());
    print('Result of normalized amount: ' + result.toString());
    expect(result.toString()).toStrictEqual('100000000000000000000');
  });

  test('NormalizeToDecimals of 100 of 6 should be 100000000000000000000', () => {
    const inputAmount = parseMas(100);
    const result = normalizeToDecimals(inputAmount, 6);
    print('Input amount: ' + inputAmount.toString());
    print('Result of normalized amount: ' + result.toString());
    expect(result.toString()).toStrictEqual('100000000000000000000000');
  });

  test('reserve k normalization', () => {
    const reserveB = f64(0.000000001) * f64(10 ** 9);
    const reserveA = 158;

    const normA = normalizeToDecimals(u256.fromU64(reserveA), 18);
    const normB = normalizeToDecimals(u256.fromF64(reserveB), 9);

    print('Normalized reserve A: ' + normA.toString());
    print('Normalized reserve B: ' + normB.toString());
    print('Reserve K: ' + SafeMath256.mul(normA, normB).toString());

    print('Price A: ' + SafeMath256.div(normB, normA).toString());

    print('Price B: ' + SafeMath256.div(normA, normB).toString());

    print("Reserve A wITHOUT NORMALIZATION: " + reserveA.toString());
    print("Reserve B wITHOUT NORMALIZATION: " + reserveB.toString());
    // print("Reserve K wITHOUT NORMALIZATION: " + reserveA * reserveB);


    print(
      'Price A wITHOUT NORMALIZATION: ' +
        SafeMath256.div(
          u256.fromF64(reserveB),
          u256.fromU64(reserveA),
        ).toString(),
    );
  });
});
