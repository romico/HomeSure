import { ethers, network } from 'hardhat';

async function main() {
  try {
    console.log('🚀 Starting deployment...');

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log('📝 Deploying contracts with account:', deployer.address);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log('💰 Account balance:', ethers.formatEther(balance));

    // Deploy KYCVerification contract
    console.log('\n🏗️  Deploying KYCVerification...');
    const KYCVerification = await ethers.getContractFactory('KYCVerification');
    const kycVerification = await KYCVerification.deploy();
    await kycVerification.waitForDeployment();
    const kycVerificationAddress = await kycVerification.getAddress();
    console.log('✅ KYCVerification deployed to:', kycVerificationAddress);

    // Deploy PropertyToken contract
    console.log('\n🏗️  Deploying PropertyToken...');
    const PropertyToken = await ethers.getContractFactory('PropertyToken');
    const propertyToken = await PropertyToken.deploy(
      'HomeSure Property Token',
      'HSPT',
      kycVerificationAddress
    );
    await propertyToken.waitForDeployment();
    const propertyTokenAddress = await propertyToken.getAddress();
    console.log('✅ PropertyToken deployed to:', propertyTokenAddress);

    // Deploy PropertyOracle
    console.log('\n🏗️  Deploying PropertyOracle...');
    const PropertyOracle = await ethers.getContractFactory('PropertyOracle');
    const propertyOracle = await PropertyOracle.deploy();
    await propertyOracle.waitForDeployment();
    const propertyOracleAddress = await propertyOracle.getAddress();
    console.log('✅ PropertyOracle deployed to:', propertyOracleAddress);

    // Deploy PropertyValuation
    console.log('\n🏗️  Deploying PropertyValuation...');
    const PropertyValuation = await ethers.getContractFactory('PropertyValuation');
    const propertyValuation = await PropertyValuation.deploy(propertyOracleAddress);
    await propertyValuation.waitForDeployment();
    const propertyValuationAddress = await propertyValuation.getAddress();
    console.log('✅ PropertyValuation deployed to:', propertyValuationAddress);

    // Deploy PropertyRegistry
    console.log('\n🏗️  Deploying PropertyRegistry...');
    const PropertyRegistry = await ethers.getContractFactory('PropertyRegistry');
    const propertyRegistry = await PropertyRegistry.deploy(propertyTokenAddress);
    await propertyRegistry.waitForDeployment();
    const propertyRegistryAddress = await propertyRegistry.getAddress();
    console.log('✅ PropertyRegistry deployed to:', propertyRegistryAddress);

    // Deploy TradingContract
    console.log('\n🏗️  Deploying TradingContract...');
    const TradingContract = await ethers.getContractFactory('TradingContract');
    const tradingContract = await TradingContract.deploy(
      propertyTokenAddress,
      propertyRegistryAddress,
      kycVerificationAddress
    );
    await tradingContract.waitForDeployment();
    const tradingContractAddress = await tradingContract.getAddress();
    console.log('✅ TradingContract deployed to:', tradingContractAddress);

    console.log('\n🎉 Deployment completed successfully!');
    console.log('\n📋 Contract Addresses:');
    console.log('KYCVerification:', kycVerificationAddress);
    console.log('PropertyToken:', propertyTokenAddress);
    console.log('PropertyOracle:', propertyOracleAddress);
    console.log('PropertyValuation:', propertyValuationAddress);
    console.log('PropertyRegistry:', propertyRegistryAddress);
    console.log('TradingContract:', tradingContractAddress);

    // Save deployment addresses to a file
    const deploymentInfo = {
      network: network.name,
      deployer: deployer.address,
      contracts: {
        KYCVerification: kycVerificationAddress,
        PropertyToken: propertyTokenAddress,
        PropertyOracle: propertyOracleAddress,
        PropertyValuation: propertyValuationAddress,
        PropertyRegistry: propertyRegistryAddress,
        TradingContract: tradingContractAddress,
      },
      timestamp: new Date().toISOString(),
    };

    const fs = require('fs');
    fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));
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
  .catch(error => {
    console.error('❌ Deployment script failed:', error);
    process.exit(1);
  });
