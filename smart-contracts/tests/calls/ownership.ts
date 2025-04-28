import {
  Args,
  bytesToStr,
  OperationStatus,
  SmartContract,
} from '@massalabs/massa-web3';

export async function getContractOwner(contract: SmartContract) {
  return bytesToStr((await contract.read('ownerAddress')).value);
}

export async function getPendingContractOwner(contract: SmartContract) {
  return bytesToStr((await contract.read('pendingOwnerAddress')).value);
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
    console.log('Ownership transfer started successfully');
  } else {
    console.log('Ownership transfer start failed');
    console.log('Error events: ', await op.getSpeculativeEvents());
    throw new Error('Ownership transfer start failed');
  }
}


export async function acceptOwnership(
  contract: SmartContract
) {
  const op = await contract.call(
    'acceptOwnership',
    new Args().serialize(),
  );

  const status = await op.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Ownership Accepted successfully');
  } else {
    console.log('Ownership transfer accept failed');
    console.log('Error events: ', await op.getSpeculativeEvents());
    throw new Error('Ownership transfer accept failed');
  }
}
