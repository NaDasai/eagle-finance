import {
  Args,
  Mas,
  OperationStatus,
  parseMas,
  Provider,
  SmartContract,
} from '@massalabs/massa-web3';
import { getScByteCode } from '../utils';
import { SwapPath } from '../classes/swapPath';

export async function deploySwapRouterContract(
  user1Provider: Provider,
  registryAddress: string,
) {
  const swpaRouteByteCode = getScByteCode('build', 'swapRouter.wasm');

  const constructorArgs = new Args().addString(registryAddress).serialize();

  const contract = await SmartContract.deploy(
    user1Provider,
    swpaRouteByteCode,
    constructorArgs,
    {
      coins: Mas.fromString('0.1'),
    },
  );

  console.log('SwapRouter contract deployed at:', contract.address);

  return contract;
}

export async function swap(
  swapRouterContract: SmartContract,
  swapRoute: SwapPath[],
  coinsToUseOnEachSwap: number,
) {
  console.log('Swapping...');
  const swapArgs = new Args()
    .addSerializableObjectArray(swapRoute)
    .addU64(parseMas(coinsToUseOnEachSwap.toString()))
    .serialize();

  const operation = await swapRouterContract.call('swap', swapArgs, {
    coins: Mas.fromString('0.1'),
  });

  const status = await operation.waitSpeculativeExecution();

  console.log('Swap status:', status);

  const events = await operation.getSpeculativeEvents();
  console.log('Swap Events:', events);

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Swap successful');
  } else {
    console.log('Swap failed');
    const events = await operation.getSpeculativeEvents();
    console.log('Swap Events:', events);
    throw new Error('Swap failed');
  }
}
