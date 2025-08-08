import { ethers } from 'hardhat';

async function main() {
  console.log('🚀 Starting simple deployment...');

  try {
    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log('📝 Deploying with account:', deployer.address);
    console.log('💰 Balance:', ethers.utils.formatEther(await deployer.getBalance()));

    // Deploy a simple test contract first
    console.log('\n🏗️  Deploying Lock contract...');
    const Lock = await ethers.getContractFactory('Lock');
    const unlockTime = Math.floor(Date.now() / 1000) + 60; // 1 minute from now
    const lock = await Lock.deploy(unlockTime);
    await lock.deployed();
    console.log('✅ Lock deployed to:', lock.address);

    // Deploy KYCVerification
    console.log('\n🏗️  Deploying KYCVerification...');
    const KYCVerification = await ethers.getContractFactory('KYCVerification');
    const kycVerification = await KYCVerification.deploy();
    await kycVerification.deployed();
    console.log('✅ KYCVerification deployed to:', kycVerification.address);

    console.log('\n🎉 Simple deployment completed!');
    console.log('Lock:', lock.address);
    console.log('KYCVerification:', kycVerification.address);

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  }
}

main()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }); 