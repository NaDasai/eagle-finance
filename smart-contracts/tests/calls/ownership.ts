import {
  Args,
  bytesToStr,
  OperationStatus,
  SmartContract,
} from '@massalabs/massa-web3';

export async function getContractOwner(contract: SmartContract) {
  return bytesToStr((await contract.read('ownerAddress')).value);
}

export async function transferOwnership(
  contract: SmartContract,
  newOwner: string,
) {
  const op = await contract.call(
    'transferOwnership',
    new Args().addString(newOwner).serialize(),
  );

  const status = await op.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Ownership transferred successfully');
  } else {
    console.log('Ownership transfer failed');
    console.log('Error events: ', await op.getSpeculativeEvents());
    throw new Error('Ownership transfer failed');
  }
}
