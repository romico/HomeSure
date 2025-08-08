import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  const address = process.argv[2] || deployer.address;
  console.log('잔액 확인 주소:', address);
  const balance = await ethers.provider.getBalance(address);
  console.log('잔액:', ethers.utils.formatEther(balance), 'ETH');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});