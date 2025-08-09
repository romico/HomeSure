import { ethers } from 'hardhat';

async function main() {
  console.log('🧪 Running Simple Integration Test...');

  // 계정 가져오기
  const [deployer, user1, user2] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  console.log('User1:', user1.address);
  console.log('User2:', user2.address);

  try {
    // 1. KYCVerification 배포
    console.log('\n📝 Deploying KYCVerification...');
    const KYCVerification = await ethers.getContractFactory('KYCVerification');
    const kycVerification = await KYCVerification.deploy();
    await kycVerification.waitForDeployment();
    const kycVerificationAddress = await kycVerification.getAddress();
    console.log('✅ KYCVerification deployed to:', kycVerificationAddress);

    // 2. PropertyToken 배포
    console.log('\n📝 Deploying PropertyToken...');
    const PropertyToken = await ethers.getContractFactory('PropertyToken');
    const propertyToken = await PropertyToken.deploy(
      'HomeSure Property Token',
      'HSPT',
      kycVerificationAddress
    );
    await propertyToken.waitForDeployment();
    const propertyTokenAddress = await propertyToken.getAddress();
    console.log('✅ PropertyToken deployed to:', propertyTokenAddress);

    // 3. PropertyRegistry 배포
    console.log('\n📝 Deploying PropertyRegistry...');
    const PropertyRegistry = await ethers.getContractFactory('PropertyRegistry');
    const propertyRegistry = await PropertyRegistry.deploy(propertyTokenAddress);
    await propertyRegistry.waitForDeployment();
    const propertyRegistryAddress = await propertyRegistry.getAddress();
    console.log('✅ PropertyRegistry deployed to:', propertyRegistryAddress);

    // 4. 기본 권한 설정
    console.log('\n🔐 Setting up permissions...');

    // PropertyToken에 PropertyRegistry 권한 부여
    const ISSUER_ROLE = await propertyToken.ISSUER_ROLE();
    await propertyToken.grantRole(ISSUER_ROLE, propertyRegistryAddress);
    console.log('✅ Granted ISSUER_ROLE to PropertyRegistry');

    // KYC 검증 설정
    const KYC_MANAGER_ROLE = await kycVerification.KYC_MANAGER_ROLE();
    await kycVerification.grantRole(KYC_MANAGER_ROLE, deployer.address);
    console.log('✅ Granted KYC_MANAGER_ROLE to deployer');

    // 5. KYC 검증 테스트
    console.log('\n🔍 Testing KYC verification...');
    await kycVerification.verifyKYC(
      user1.address,
      1, // kycLevel (KYCLevel.BASIC)
      'QmTestHash', // documentHash
      'TEST001', // verificationId
      0 // riskScore
    );
    console.log('✅ KYC verification for user1 completed');

    // 6. KYC 상태 확인
    const isVerified = await kycVerification.isKYCVerified(user1.address);
    console.log('User1 KYC verified:', isVerified);

    // 7. PropertyToken에 KYC 컨트랙트 연결
    await propertyToken.updateKYCVerificationContract(kycVerificationAddress);
    console.log('✅ KYC contract linked to PropertyToken');

    // 8. 간단한 토큰 발행 테스트
    console.log('\n🪙 Testing token issuance...');

    // 부동산 등록 (PropertyToken의 registerProperty 사용)
    const tx = await propertyToken.registerProperty(
      '서울시 강남구 테헤란로 123',
      ethers.parseEther('1000000'), // 1M ETH
      ethers.parseEther('1000000'), // 1M tokens
      0, // PropertyType.RESIDENTIAL
      'QmTestMetadataHash'
    );
    const receipt = await tx.wait();
    console.log('✅ Property registration transaction completed');
    // 이벤트에서 propertyId 추출 (ethers v6 방식)
    let propertyId: any = 1n;
    try {
      for (const log of receipt.logs || []) {
        try {
          const parsed = propertyToken.interface.parseLog(log);
          if (parsed && parsed.name === 'PropertyRegistered') {
            propertyId = parsed.args?.propertyId ?? propertyId;
            break;
          }
        } catch {}
      }
    } catch {}
    console.log('✅ Property registered with ID:', propertyId.toString());

    // 부동산 상태를 ACTIVE로 변경
    console.log('🔄 Activating property...');
    await propertyToken.updatePropertyStatus(propertyId, 1); // PropertyStatus.ACTIVE = 1
    console.log('✅ Property activated');

    // 토큰 발행
    const issueId = await propertyToken.issueTokensAdvanced(
      propertyId,
      user1.address,
      ethers.parseEther('1'), // 1 ETH per token
      10000, // 100% ownership (10000 basis points)
      'Initial token issuance',
      'QmTokenMetadataHash'
    );
    console.log('✅ Tokens issued with ID:', issueId.toString());

    // 9. 잔액 확인
    const balance = await propertyToken.balanceOf(user1.address);
    console.log('User1 token balance:', ethers.formatEther(balance), 'HSPT');

    // 10. 부동산 정보 확인
    const property = await propertyToken.properties(propertyId);
    console.log('Property location:', property.location);
    console.log('Property total value:', ethers.formatEther(property.totalValue), 'ETH');
    console.log('Property total tokens:', ethers.formatEther(property.totalTokens), 'HSPT');

    console.log('\n🎉 Simple Integration Test Completed Successfully!');

    // 배포된 컨트랙트 주소들 출력
    console.log('\n📋 Deployed Contract Addresses:');
    console.log('KYCVerification:', kycVerificationAddress);
    console.log('PropertyToken:', propertyTokenAddress);
    console.log('PropertyRegistry:', propertyRegistryAddress);
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
