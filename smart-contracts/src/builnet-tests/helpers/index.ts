import {
  Args,
  bytesToU64,
  formatUnits,
  Mas,
  MRC20,
  OperationStatus,
  Provider,
  SmartContract,
} from '@massalabs/massa-web3';
import { Pool } from '../structs/pool';

export async function getRegistryFeeShareProtocol(contract: SmartContract) {
  const result = await contract.read(
    'getFeeShareProtocol',
    new Args().serialize(),
  );

  const feeShareProtocol = bytesToU64(result.value);

  console.log('Fee share protocol:', feeShareProtocol);
}

export async function getPools(contract: SmartContract): Promise<Pool[]> {
  const result = await contract.read('getPools', new Args().serialize());

  const pools = new Args(result.value).nextSerializableObjectArray<Pool>(Pool);

  console.log('Pools:', pools);
  return pools;
}

export async function increaseAllowance(
  tokenAddress: string,
  amount: bigint,
  provider: Provider,
  contract: SmartContract,
) {
  console.log('Increase allowance of the token: ', tokenAddress);

  const mrc20 = new MRC20(provider, tokenAddress);

  // increase allowance of the token
  const operation = await mrc20.increaseAllowance(contract.address, amount, {
    coins: Mas.fromString('0.1'),
  });

  const status = await operation.waitSpeculativeExecution();

  console.log('Status ops :', status);

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Allowance increased successfully');
  } else {
    console.log('Status:', status);
    throw new Error('Failed to increase allowance');
  }
}

export async function getBalanceOf(
  tokenAddress: string,
  accountAddress: string,
  provider: Provider,
) {
  const mrc20 = new MRC20(provider, tokenAddress);

  const balance = await mrc20.balanceOf(accountAddress);

  console.log('Balance of ', accountAddress, ':', balance);
}

export async function getPoolReserves(poolAddress: string, provider: Provider) {
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
