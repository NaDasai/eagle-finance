import {
  Account,
  Args,
  bytesToStr,
  formatUnits,
  Mas,
  MRC20,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import {
  claimeProtocolFees,
  getAClaimableProtocolFee,
  getBClaimableProtocolFee,
} from '../tests/calls/basicPool';

const account = await Account.fromEnv();
const provider = Web3Provider.buildnet(account);

const poolAddress = 'AS12ecWuC1QLpNw72wHGViot1ys52pBPNv6AhcUJcqXQ5unQJGeS5';

const poolContract = new SmartContract(provider, poolAddress);

// Get pool tokens
const aTokenAddress = bytesToStr(
  (await poolContract.read('getATokenAddress')).value,
);
const bTokenAddress = bytesToStr(
  (await poolContract.read('getBTokenAddress')).value,
);

console.log('Pool tokens:', aTokenAddress, bTokenAddress);

const aTokenDecimals = await new MRC20(provider, aTokenAddress).decimals();
const bTokenDecimals = await new MRC20(provider, bTokenAddress).decimals();

console.log('Pool tokens decimals:', aTokenDecimals, bTokenDecimals);

// get user token balance before
const aTokenBalanceBefore = await new MRC20(provider, aTokenAddress).balanceOf(
  account.address.toString(),
);

const bTokenBalanceBefore = await new MRC20(provider, bTokenAddress).balanceOf(
  account.address.toString(),
);

console.log(
  'A Token balance before:',
  formatUnits(aTokenBalanceBefore, aTokenDecimals),
);
console.log(
  'B Token balance before:',
  formatUnits(bTokenBalanceBefore, bTokenDecimals),
);

// get A claimable protocol fee
const aClaimableProtocolFee = await getAClaimableProtocolFee(poolContract);
const bClaimableProtocolFee = await getBClaimableProtocolFee(poolContract);

console.log('A claimable protocol fee:', aClaimableProtocolFee);
console.log('B claimable protocol fee:', bClaimableProtocolFee);

// Claim protocol fees
await claimeProtocolFees(poolContract);

// get user token balance after
const aTokenBalanceAfter = await new MRC20(provider, aTokenAddress).balanceOf(
  account.address.toString(),
);

const bTokenBalanceAfter = await new MRC20(provider, bTokenAddress).balanceOf(
  account.address.toString(),
);

console.log(
  'A Token balance after:',
  formatUnits(aTokenBalanceAfter, aTokenDecimals),
);
console.log(
  'B Token balance after:',
  formatUnits(bTokenBalanceAfter, bTokenDecimals),
);

console.log(`Diff Token A: ${aTokenBalanceAfter - aTokenBalanceBefore}`);
console.log(`Diff Token B: ${bTokenBalanceAfter - bTokenBalanceBefore}`);
