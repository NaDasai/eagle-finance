import {
  Account,
  Args,
  BUILDNET_TOKENS,
  formatMas,
  formatUnits,
  Mas,
  MRC20,
  OperationStatus,
  parseUnits,
  populateDatastore,
  SmartContract,
  Web3Provider,
  WMASBuildnet,
} from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';
import { SwapPath } from './classes/swapPath';
import { deploySwapRouterContract, swap } from './calls/swapRouter';
import {
  createNewPoolWithLiquidity,
  deployRegistryContract,
  getPools,
  setSwapRouterAddress,
} from './calls/registry';
import { getPoolReserves } from './calls/basicPool';
import { increaseAllownace } from './calls/basicPool';
import { Pool } from '../src/builnet-tests/structs/pool';

dotenv.config();

const user1Provider = Web3Provider.buildnet(await Account.fromEnv());

const user2Provider = Web3Provider.buildnet(
  await Account.fromEnv('PRIVATE_KEY_TWO'),
);

const usdcAddress = 'AS12s8vxjgYc4jwBfA8rFQB6M9NGVzGid6e7EKKA599og9JrNL6AC';
const usdtAddress = 'AS12sQwteFmgj5j1waqKVZ5KtwVW63fcbyrNYKQeB3KcwADzHGHjb';
const wmasAddress = BUILDNET_TOKENS.WMAS;

const registryContract = await deployRegistryContract(
  user1Provider,
  wmasAddress,
);

const swapRouterContract = await deploySwapRouterContract(
  user1Provider,
  registryContract.address,
);

// Set the swap router address in the registry contract
await setSwapRouterAddress(registryContract, swapRouterContract.address);

// Increase allowance for the tokens
await increaseAllownace(
  usdtAddress,
  registryContract.address,
  100,
  user1Provider,
  18,
);

await increaseAllownace(
  wmasAddress,
  registryContract.address,
  10,
  user1Provider,
  9,
);

// Create Pool with usdt wmas
await createNewPoolWithLiquidity(
  registryContract,
  usdtAddress,
  wmasAddress,
  100,
  5,
  0,
  0,
  0.3 * 10_000,
  false,
  18,
  9,
);

await increaseAllownace(
  usdcAddress,
  registryContract.address,
  100,
  user1Provider,
  18,
);

// Create another pool with usdc wmas
await createNewPoolWithLiquidity(
  registryContract,
  usdcAddress,
  wmasAddress,
  100,
  5,
  0,
  0,
  0.3 * 10_000,
  false,
  18,
  9,
);

// get pools
const pools: Pool[] = await getPools(registryContract);

if (!pools || pools.length === 0) {
  throw new Error('No pools found');
}

// filter usdc pool by checking the pool that has aTokenaddress equals to usdc address
const usdcPool = pools.find((pool) => pool.aTokenddress === usdcAddress);

if (!usdcPool) {
  throw new Error('No usdc pool found');
}

const usdtPool = pools.find((pool) => pool.aTokenddress === usdtAddress);

if (!usdtPool) {
  throw new Error('No usdt pool found');
}

await increaseAllownace(
  usdtAddress,
  swapRouterContract.address,
  50,
  user1Provider,
  18,
);

// Create a swap path
const swapPath = new SwapPath(
  usdtPool.poolAddress,
  usdtAddress,
  wmasAddress,
  usdcPool.poolAddress,
  parseUnits('50', 18),
  parseUnits('0.0001', 9),
  true,
);

const swapPath2 = new SwapPath(
  usdcPool.poolAddress,
  wmasAddress,
  usdcAddress,
  user1Provider.address,
  parseUnits('1.663329996', 9),
  parseUnits('0.00001', 9),
  false,
);

const wmasBalanceBefore = await new WMASBuildnet(user1Provider).balanceOf(
  user1Provider.address,
);

const usdtBalanceBefore = await new MRC20(user1Provider, usdtAddress).balanceOf(
  user1Provider.address,
);

const usdcBalanceBefore = await new MRC20(user1Provider, usdcAddress).balanceOf(
  user1Provider.address,
);

console.log('WMAS Balance before:', formatMas(wmasBalanceBefore));
console.log('USDT Balance before:', formatUnits(usdtBalanceBefore, 18));
console.log('USDC Balance before:', formatUnits(usdcBalanceBefore, 18));

await swap(swapRouterContract, [swapPath, swapPath2], 0.1);

const wmasBalanceAfter = await new WMASBuildnet(user1Provider).balanceOf(
  user1Provider.address,
);

const usdtBalanceAfter = await new MRC20(user1Provider, usdtAddress).balanceOf(
  user1Provider.address,
);

const usdcBalanceAfter = await new MRC20(user1Provider, usdcAddress).balanceOf(
  user1Provider.address,
);

console.log('WMAS Balance after:', formatMas(wmasBalanceAfter));
console.log('USDT Balance after:', formatUnits(usdtBalanceAfter, 18));
console.log('USDC Balance after:', formatUnits(usdcBalanceAfter, 18));
