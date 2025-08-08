import { ethers } from 'hardhat';

async function main() {
  try {
    console.log('🚀 Starting deployment...');

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log('📝 Deploying contracts with account:', deployer.address);
    console.log('💰 Account balance:', ethers.utils.formatEther(await deployer.getBalance()));

    // Deploy KYCVerification contract
    console.log('\n🏗️  Deploying KYCVerification...');
    const KYCVerification = await ethers.getContractFactory('KYCVerification');
    const kycVerification = await KYCVerification.deploy();
    await kycVerification.deployed();
    console.log('✅ KYCVerification deployed to:', kycVerification.address);

      // Deploy PropertyToken contract
  console.log('\n🏗️  Deploying PropertyToken...');
  const PropertyToken = await ethers.getContractFactory('PropertyToken');
  const propertyToken = await PropertyToken.deploy(
    'HomeSure Property Token',
    'HSPT',
    kycVerification.address
  );
  await propertyToken.deployed();
  console.log('✅ PropertyToken deployed to:', propertyToken.address);

    // Deploy PropertyOracle
    console.log('\n🏗️  Deploying PropertyOracle...');
    const PropertyOracle = await ethers.getContractFactory('PropertyOracle');
    const propertyOracle = await PropertyOracle.deploy();
    await propertyOracle.deployed();
    console.log('✅ PropertyOracle deployed to:', propertyOracle.address);

      // Deploy PropertyValuation
  console.log('\n🏗️  Deploying PropertyValuation...');
  const PropertyValuation = await ethers.getContractFactory('PropertyValuation');
  const propertyValuation = await PropertyValuation.deploy(propertyOracle.address);
  await propertyValuation.deployed();
  console.log('✅ PropertyValuation deployed to:', propertyValuation.address);

    // Deploy PropertyRegistry
    console.log('\n🏗️  Deploying PropertyRegistry...');
    const PropertyRegistry = await ethers.getContractFactory('PropertyRegistry');
    const propertyRegistry = await PropertyRegistry.deploy(
      propertyToken.address
    );
    await propertyRegistry.deployed();
    console.log('✅ PropertyRegistry deployed to:', propertyRegistry.address);

    // Deploy TradingContract
    console.log('\n🏗️  Deploying TradingContract...');
    const TradingContract = await ethers.getContractFactory('TradingContract');
    const tradingContract = await TradingContract.deploy(
      propertyToken.address,
      propertyRegistry.address,
      kycVerification.address
    );
    await tradingContract.deployed();
    console.log('✅ TradingContract deployed to:', tradingContract.address);

    console.log('\n🎉 Deployment completed successfully!');
    console.log('\n📋 Contract Addresses:');
    console.log('KYCVerification:', kycVerification.address);
    console.log('PropertyToken:', propertyToken.address);
    console.log('PropertyOracle:', propertyOracle.address);
    console.log('PropertyValuation:', propertyValuation.address);
    console.log('PropertyRegistry:', propertyRegistry.address);
    console.log('TradingContract:', tradingContract.address);

    // Save deployment addresses to a file
    const deploymentInfo = {
      network: 'localhost',
      deployer: deployer.address,
      contracts: {
        KYCVerification: kycVerification.address,
        PropertyToken: propertyToken.address,
        PropertyOracle: propertyOracle.address,
        PropertyValuation: propertyValuation.address,
        PropertyRegistry: propertyRegistry.address,
        TradingContract: tradingContract.address,
      },
      timestamp: new Date().toISOString(),
    };

    const fs = require('fs');
    fs.writeFileSync(
      'deployment.json',
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log('\n💾 Deployment info saved to deployment.json');

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  }
}

main()
  .then(() => {
    console.log('✅ Deployment script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Deployment script failed:', error);
    process.exit(1);
  });
