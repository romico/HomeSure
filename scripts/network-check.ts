import { ethers, network } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('네트워크:', network.name);
  console.log('계정:', deployer.address);
  const balance = await deployer.getBalance();
  console.log('잔액:', ethers.utils.formatEther(balance), 'ETH');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});