import {
  Account,
  Args,
  bytesToF64,
  formatUnits,
  Mas,
  MRC20,
  OperationStatus,
  parseUnits,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { getScByteCode } from '../utils';
import { Pool } from './structs/pool';

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

async function createNewPool(
  aTokenAddress: string,
  bTokenAddress: string,
  inputFeeRate: number,
) {
  console.log('Creating new poool.....');

  const operation = await contract.call(
    'createNewPool',
    new Args()
      .addString(aTokenAddress)
      .addString(bTokenAddress)
      .addF64(inputFeeRate)
      .serialize(),
    { coins: Mas.fromString('0.1') },
  );

  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Pool created successfully');
  } else {
    console.log('Status:', status);
    throw new Error('Failed to create new pool');
  }
}

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

  const status = await operation.waitFinalExecution();

  if (status === OperationStatus.Success) {
    console.log('Pool created successfully and Liquidity added');
  } else {
    console.log('Status:', status);
    throw new Error('Failed to create new pool and add liquidity');
  }
}

async function getPools(): Promise<Pool[]> {
  const result = await contract.read('getPools', new Args().serialize());

  const pools = new Args(result.value).nextSerializableObjectArray<Pool>(Pool);

  console.log('Pools:', pools);
  return pools;
}

async function getRegistryFeeShareProtocol() {
  const result = await contract.read(
    'getFeeShareProtocol',
    new Args().serialize(),
  );

  const feeShareProtocol = bytesToF64(result.value);

  console.log('Fee share protocol:', feeShareProtocol);
}

async function testCreateAndGetPools() {
  await getRegistryFeeShareProtocol();

  const aTokenAddress = 'AS12V58y942EBAexRzU3bGVb7Fxoduba4UxfLAQCbSeKNVamDCHfL';
  const bTokenAddress = 'AS1mb6djKDu2LnhQtajuLPGX1J2PNYgCY2LoUxQxa69ABUgedJXN';

  await createNewPool(aTokenAddress, bTokenAddress, 0.3 * 1000);

  await getPools();
}

async function getPoolReserves(poolAddress: string) {
  const poolContract = new SmartContract(provider, poolAddress);

  const aReserve = await poolContract.read('getLocalReserveA');

  const bReserve = await poolContract.read('getLocalReserveB');

  console.log(
    'A reserve:',
    formatUnits(new Args(aReserve.value).nextU256(), 9),
  );
  console.log(
    'B reserve:',
    formatUnits(new Args(bReserve.value).nextU256(), 9),
  );
}

async function increaseAllowance(tokenAddress: string, amount: bigint) {
  const mrc20 = new MRC20(provider, tokenAddress);

  // increase allowance of the token
  const operation = await mrc20.increaseAllowance(contract.address, amount, {
    coins: Mas.fromString('0.1'),
  });

  const status = await operation.waitFinalExecution();

  if (status === OperationStatus.Success) {
    console.log('Allowance increased successfully');
  } else {
    console.log('Status:', status);
    throw new Error('Failed to increase allowance');
  }
}

async function getBalanceOf(tokenAddress: string, accountAddress: string) {
  const mrc20 = new MRC20(provider, tokenAddress);

  const balance = await mrc20.balanceOf(accountAddress);

  console.log('Balance of ', accountAddress, ':', balance);
}

async function testCreateAndAddLiquidityAndGetPools() {
  const aToken = 'AS12iCU3KNvPCoxCFiPnXbRAqN128hXGwQ2tDhkqfM4EKsU9xqXvb';
  const bToken = 'AS1f8dKz2ZLVyTtfh7se6MCE8yQk1t3ZshRgJnmCNpRm8WL2WoFV';

  const amount = parseUnits('1', 9);

  console.log('Amount:', amount);

  console.log('Increase allowance of the two tokens.....');
  await increaseAllowance(aToken, amount);
  await increaseAllowance(bToken, amount);

  await createNewPoolWithLiquidity(aToken, bToken, 5, amount, amount);

  const pools = await getPools();

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

  await getPoolReserves(pool.poolAddress);

  const events = await provider.getEvents({
    smartContractAddress: pool.poolAddress,
  });

  console.log('Pool Events:');

  for (const event of events) {
    console.log('Event message:', event.data);
  }
}

async function testCreatePoolAndAddLiquidityWithMAS() {
  const aToken = 'AS12iCU3KNvPCoxCFiPnXbRAqN128hXGwQ2tDhkqfM4EKsU9xqXvb';
  // const bToken = 'AS1f8dKz2ZLVyTtfh7se6MCE8yQk1t3ZshRgJnmCNpRm8WL2WoFV';
  const bToken = NATIVE_MAS_COIN_ADDRESS;

  const amount = parseUnits('5', 9);

  console.log('Amount:', amount);

  console.log('Increase allowance of the two tokens.....');
  await increaseAllowance(aToken, amount);
  // await increaseAllowance(bToken, amount);

  await createNewPoolWithLiquidity(aToken, bToken, 5, amount, amount, true);

  const pools = await getPools();

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

  await getPoolReserves(pool.poolAddress);

  const events = await provider.getEvents({
    smartContractAddress: pool.poolAddress,
  });

  console.log('Pool Events:');

  for (const event of events) {
    console.log('Event message:', event.data);
  }
}

await testCreateAndGetPools();
// await getBalanceOf(
//   'AS128szebpFEzt62KYEkRNxAxmNh5BM26WgeHR1gCEpCTcyWa1TcG',
//   contract.address,
// );

// await testCreateAndAddLiquidityAndGetPools();
// await testCreatePoolAndAddLiquidityWithMAS();

console.log('Registry Events:');

const events = await provider.getEvents({
  smartContractAddress: contract.address,
});

for (const event of events) {
  console.log('Event message:', event.data);
}

console.log('Done');
