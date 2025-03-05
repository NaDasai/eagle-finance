import {
  Account,
  Args,
  BUILDNET_TOKENS,
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
} from './calls/registry';
import { getPoolReserves } from './calls/basicPool';
import { increaseAllownace } from './calls/basicPool';

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
  5,
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

// get pools
const pools = await getPools(registryContract);

if (!pools) {
  throw new Error('No pools found');
}

const pool = pools[0];

console.log('Pool:', pool);

const poolContract = new SmartContract(user1Provider, pool.poolAddress);

// Get reserves of the pool
const reserves = await getPoolReserves(poolContract);

console.log('Reserves:', reserves);

await increaseAllownace(
  usdtAddress,
  swapRouterContract.address,
  50,
  user1Provider,
  18,
);

// Create a swap path
const swapPath = new SwapPath(
  pool.poolAddress,
  usdtAddress,
  wmasAddress,
  parseUnits('50', 18),
  parseUnits('0.0001', 9),
);

const wmasBalanceBefore = await new WMASBuildnet(user1Provider).balanceOf(
  user1Provider.address,
);

console.log('WMAS Balance before:', wmasBalanceBefore);

await swap(swapRouterContract, [swapPath], 0.1);

const wmasBalanceAfter = await new WMASBuildnet(user1Provider).balanceOf(
  user1Provider.address,
);

console.log('WMAS Balance after:', wmasBalanceAfter);

const reservesAfter = await getPoolReserves(poolContract);

console.log('Reserves after:', reservesAfter);
