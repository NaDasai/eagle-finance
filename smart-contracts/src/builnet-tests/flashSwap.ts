import {
  Account,
  Args,
  bytesToU64,
  formatUnits,
  Mas,
  MRC20,
  OperationStatus,
  parseUnits,
  Provider,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { getScByteCode } from '../utils';
import { Pool } from './structs/pool';
import { getPoolReserves, getPools, increaseAllowance } from './helpers';

const account = await Account.fromEnv();
const provider = Web3Provider.buildnet(account);

console.log('Deploying contract...');

const byteCode = getScByteCode('build', 'registry.wasm');

// Native MAS coin address to determine if the token address is the native Mas coin
export const NATIVE_MAS_COIN_ADDRESS = 'NATIVE_COIN';

// constructr takes fee share protocol as a parameter
const constructorArgs = new Args()
  .addF64(25) // 25% fee share protocol
  .addString('AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU') // WMAS address
  .serialize();

let contract = await SmartContract.deploy(provider, byteCode, constructorArgs, {
  coins: Mas.fromString('10'),
});

console.log('Contract deployed at:', contract.address);

let poolAddress: string | null = null;

const aTokenAddress = 'AS12mGPKTyQYC5FwJG5wHQFwmtbzhQTvvoGLBVvSgLCGtUhpDeGSb';
const bTokenAddress = 'AS126PjhhpC2aYhPcCh5DgJFQjEkPtts5fnqktu1hPJdcLdV5RXXs';

async function createNewPoolWithLiquidity(
  aTokenAddress: string,
  bTokenAddress: string,
  inputFeeRate: number,
  amountA: bigint,
  amountB: bigint,
  isNativeCoin: boolean = false,
) {
  console.log('Creating new poool and add liquidity.....');

  const minAmountA = BigInt(0);
  const minAmountB = BigInt(0);

  const operation = await contract.call(
    'createNewPoolWithLiquidity',
    new Args()
      .addString(aTokenAddress)
      .addString(bTokenAddress)
      .addU256(amountA)
      .addU256(amountB)
      .addU256(minAmountA)
      .addU256(minAmountB)
      .addF64(inputFeeRate)
      .serialize(),
    { coins: isNativeCoin ? Mas.fromString('5.1') : Mas.fromString('0.1') },
  );

  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Pool created successfully and Liquidity added');
  } else {
    console.log('Status:', status);
    throw new Error('Failed to create new pool and add liquidity');
  }
}

async function createAndAddLiquidityAndGetPools() {
  const aToken = aTokenAddress;
  const bToken = bTokenAddress;

  const amount = parseUnits('100', 9);

  console.log('Amount:', amount);

  console.log('Increase allowance of the two tokens.....');
  await increaseAllowance(aToken, amount, provider, contract);
  await increaseAllowance(bToken, amount, provider, contract);

  await createNewPoolWithLiquidity(aToken, bToken, 5, amount, amount);

  const pools = await getPools(contract);

  console.log('Pools:', pools);

  if (pools.length <= 0) {
    console.warn('No pools found');
    return;
  }

  const pool = pools[0];

  console.log('Pool address:', pool.poolAddress);
  console.log('Pool token A address:', pool.aTokenddress);
  console.log('Pool token B address:', pool.bTokenAddress);
  console.log('Pool fee rate:', pool.inputFeeRate);

  poolAddress = pool.poolAddress;

  await getPoolReserves(pool.poolAddress, provider);
}

async function testFlashSwap() {
  if (!poolAddress) {
    console.warn('No pool address found');
    return;
  }

  const aAmount = parseUnits('10', 9);
  const bAmount = 0n;

  const poolContract = new SmartContract(provider, poolAddress);

  const operation = await poolContract.call(
    'flashLoan',
    new Args()
      .addU256(aAmount) // amount of token A
      .addU256(bAmount) // amount of token B
      .addString(contract.address) // callback address
      .addUint8Array(new Args().addString('test callback data').serialize()) // callback data
      .serialize(),
    { coins: Mas.fromString('0.1') },
  );

  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Flash swap executed successfully');
  } else {
    console.log('Status:', status);
    throw new Error('Failed to execute flash swap');
  }

  console.log('Getting pool reserves after flash swap.....');
  await getPoolReserves(poolAddress, provider);
}

console.log('Create and add liquidity and get pools.....');
await createAndAddLiquidityAndGetPools();
console.log('Done creating and adding liquidity and getting pools');
console.log('Flash swap starts.....');
await testFlashSwap();
console.log('Flash Swap End. ');

console.log('Registry Events:');

const events = await provider.getEvents({
  smartContractAddress: contract.address,
});

for (const event of events) {
  console.log('Event message:', event.data);
}

// get event of pool contract if poolAddress is provided
if (poolAddress) {
  console.log('Pool Events:');
  const poolEvents = await provider.getEvents({
    smartContractAddress: poolAddress,
  });

  for (const event of poolEvents) {
    console.log('Event message:', event.data);
  }
}

console.log('Done');
