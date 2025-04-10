import { print, resetStorage } from '@massalabs/massa-as-sdk';
import { SafeMath256 } from '../../lib/safeMath';
import { u128, u256 } from 'as-bignum/assembly';
import { parseMas } from '../utils';
import { getFeeFromAmount } from '../../lib/basicPoolMath';
import { denormalizeFromDecimals, normalizeToDecimals } from '../../lib/math';
import {
  INITIAL_LIQUIDITY_LOCK_PERCENTAGE,
  ONE_PERCENT,
} from '../../utils/constants';

beforeEach(() => {
  resetStorage();
});

/* describe('test sqrt calculations', () => {
  it('sqrt calculation', () => {
    const sqrt = SafeMath256.sqrt(u256.from(25));
    print(`sqrt of 25: ${sqrt.toString()}`);
    expect(sqrt).toBe(u256.from(5));
  });
});

describe('test getFeeFromAmount', () => {
  test('getFeeFromAmount of 0.3% of 100 should be 0.3', () => {
    const inputAmount = parseMas(100);
    const fee = u64(0.3 * 10_000); // 0.3% ===> 3000
    const result = getFeeFromAmount(inputAmount, fee);
    print('Input amount: ' + inputAmount.toString());
    print('Fee: ' + fee.toString());
    print('Result of fee amount: ' + result.toString());
    expect(result).toStrictEqual(parseMas(0.3));
  });

  test('getFeeFromAmount of 0.3% of 10 should be 0.03', () => {
    const inputAmount = parseMas(10);
    const fee = u64(0.3 * 10_000); // 0.3% ===> 3000
    const result = getFeeFromAmount(inputAmount, fee);
    print('Input amount: ' + inputAmount.toString());
    print('Fee: ' + fee.toString());
    print('Result of fee amount: ' + result.toString());
    expect(result).toStrictEqual(parseMas(0.03));
  });

  test('getFeeFromAmount of 0.3% of 5 should be 0.015', () => {
    const inputAmount = parseMas(5);
    const fee = u64(0.3 * 10_000); // 0.3% ===> 3000
    const result = getFeeFromAmount(inputAmount, fee);
    print('Input amount: ' + inputAmount.toString());
    print('Fee: ' + fee.toString());
    print('Result of fee amount: ' + result.toString());
    expect(result).toStrictEqual(parseMas(0.015));
  });
});
 */
// describe('test normalization', () => {
//   const aAmount = 10_000; // 10_000 units
//   const bAmount = 1; // 1 unit
//   const aDecimals = 18;
//   const bDecimals = 9;
//   const aNormalized = normalizeToDecimals(u256.fromU64(aAmount), aDecimals, 18);
//   const bNormalized = normalizeToDecimals(u256.fromU64(bAmount), bDecimals, 18);

//   print(`aNormalized: ${aNormalized.toString()}`);
//   print(`bNormalized: ${bNormalized.toString()}`);
//   const product = SafeMath256.mul(aNormalized, bNormalized);
//   print(`product: ${product.toString()}`);
//   const totalLiquidity = SafeMath256.sqrt(product);
//   print(`Total liquidity: ${totalLiquidity.toString()}`);
//   const initialLiquidityLock = SafeMath256.div(
//     SafeMath256.mul(totalLiquidity, INITIAL_LIQUIDITY_LOCK_PERCENTAGE),
//     u256.fromU64(ONE_PERCENT * 100),
//   );
//   print(`Initial liquidity lock: ${initialLiquidityLock.toString()}`);
//   const liquidity = SafeMath256.sub(totalLiquidity, initialLiquidityLock);
//   print(`Liquidity: ${liquidity.toString()}`);
// });

// describe('test normalization 2 where min liq = 1000:', () => {
//   const aAmount = 100000;
//   const bAmount = 1;
//   const aDecimals = 18;
//   const bDecimals = 9;
//   const aNormalized = normalizeToDecimals(u256.fromU64(aAmount), aDecimals, 18);
//   const bNormalized = normalizeToDecimals(u256.fromU64(bAmount), bDecimals, 18);

//   print(`aNormalized: ${aNormalized.toString()}`);
//   print(`bNormalized: ${bNormalized.toString()}`);
//   const product = SafeMath256.mul(aNormalized, bNormalized);
//   print(`product: ${product.toString()}`);
//   const totalLiquidity = SafeMath256.sqrt(product);
//   print(`Total liquidity: ${totalLiquidity.toString()}`);
//   const initialLiquidityLock = SafeMath256.div(
//     SafeMath256.mul(totalLiquidity, INITIAL_LIQUIDITY_LOCK_PERCENTAGE),
//     u256.fromU64(ONE_PERCENT * 100),
//   );
//   print(`Initial liquidity lock: ${initialLiquidityLock.toString()}`);
//   const liquidity = SafeMath256.sub(totalLiquidity, initialLiquidityLock);
//   print(`Liquidity: ${liquidity.toString()}`);
// });

// describe('test normalization 2 where min liq = 10000:', () => {
//   const aAmount = 100000;
//   const bAmount = 100;
//   const aDecimals = 18;
//   const bDecimals = 9;
//   const aNormalized = normalizeToDecimals(u256.fromU64(aAmount), aDecimals, 18);
//   const bNormalized = normalizeToDecimals(u256.fromU64(bAmount), bDecimals, 18);

//   print(`aNormalized: ${aNormalized.toString()}`);
//   print(`bNormalized: ${bNormalized.toString()}`);
//   const product = SafeMath256.mul(aNormalized, bNormalized);
//   print(`product: ${product.toString()}`);
//   const totalLiquidity = SafeMath256.sqrt(product);
//   print(`Total liquidity: ${totalLiquidity.toString()}`);
//   const initialLiquidityLock = SafeMath256.div(
//     SafeMath256.mul(totalLiquidity, INITIAL_LIQUIDITY_LOCK_PERCENTAGE),
//     u256.fromU64(ONE_PERCENT * 100),
//   );
//   print(`Initial liquidity lock: ${initialLiquidityLock.toString()}`);
//   const liquidity = SafeMath256.sub(totalLiquidity, initialLiquidityLock);
//   print(`Liquidity: ${liquidity.toString()}`);
// });

// describe('test normalization  where min liq = 2000:', () => {
//   const aAmount = 200000;
//   const bAmount = 2;
//   const aDecimals = 18;
//   const bDecimals = 9;
//   const aNormalized = normalizeToDecimals(u256.fromU64(aAmount), aDecimals, 18);
//   const bNormalized = normalizeToDecimals(u256.fromU64(bAmount), bDecimals, 18);

//   print(`aNormalized: ${aNormalized.toString()}`);
//   print(`bNormalized: ${bNormalized.toString()}`);
//   const product = SafeMath256.mul(aNormalized, bNormalized);
//   print(`product: ${product.toString()}`);
//   const totalLiquidity = SafeMath256.sqrt(product);
//   print(`Total liquidity: ${totalLiquidity.toString()}`);
//   const initialLiquidityLock = SafeMath256.div(
//     SafeMath256.mul(totalLiquidity, INITIAL_LIQUIDITY_LOCK_PERCENTAGE),
//     u256.fromU64(ONE_PERCENT * 100),
//   );
//   print(`Initial liquidity lock: ${initialLiquidityLock.toString()}`);
//   const liquidity = SafeMath256.sub(totalLiquidity, initialLiquidityLock);
//   print(`Liquidity: ${liquidity.toString()}`);

//   const am = denormalizeFromDecimals(aNormalized, aDecimals);
//   print(`am: ${am.toString()}`);
//   const bm = denormalizeFromDecimals(bNormalized, bDecimals);
//   print(`bm: ${bm.toString()}`);
// });

describe('test math', () => {
  const normAmountA = u256.fromU64(10_000_000_000_000_000_000);
  const normAmountB = u256.fromU64(10_000_000_000_000_000_000);
  const normReserveA = u256.Zero;
  const normReserveB = u256.Zero;
  const product = SafeMath256.mul(normAmountA, normAmountB);
  print(`product Manuelly: ${product.toString()}`);
  const totalLiquidity = SafeMath256.sqrt(product);
  print(`Total liquidity Manuelly: ${totalLiquidity.toString()}`);
  const initialLiquidityLock = u256.fromU64(1000);
  const liquidity = SafeMath256.sub(totalLiquidity, initialLiquidityLock);
  print(`Liquidity Manuelly: ${liquidity.toString()}`);
});


// 100_000_000_000_000_000_000_000_000_000_000_000_000 (manuually)
// 100_000_000_000_000_000_000_000_000_000_000_000_000 (contract)
// 10_000_000_000_000_000_000 (sqrt product manuually)
// 10_000_000_000_000_000_000 (sqrt product contract)
