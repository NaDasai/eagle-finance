import { print, resetStorage } from '@massalabs/massa-as-sdk';
import { SafeMath256 } from '../lib/safeMath';
import { u256 } from 'as-bignum/assembly';

beforeEach(() => {
  resetStorage();
});

describe('test calculations', () => {
  it('sqrt calculation', () => {
    const sqrt = SafeMath256.sqrt(u256.from(25));
    print(`sqrt of 25: ${sqrt.toString()}`);
    expect(sqrt).toBe(u256.from(5));
  });
});
