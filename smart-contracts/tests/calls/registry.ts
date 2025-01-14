import { Args, Mas, OperationStatus, SmartContract } from "@massalabs/massa-web3";

export async function createNewPool(
  contract: SmartContract,
  aTokenAddress: string,
  bTokenAddress: string,
  inputFeeRate: number,
) {
  console.log('Creating new pool');

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
