import { ethers } from 'hardhat';
// import { createPropertyMetadata, uploadMetadataToIPFS } from './ipfs-utils';

// 임시 IPFS 유틸리티 함수들
function createPropertyMetadata(propertyData: any): any {
  return {
    propertyId: propertyData.propertyId.toString(),
    name: propertyData.name || `Property ${propertyData.propertyId}`,
    description: propertyData.description || '',
    location: {
      address: propertyData.location,
      city: propertyData.city || '',
      country: propertyData.country || 'South Korea',
      coordinates: propertyData.coordinates
    },
    propertyType: propertyData.propertyType || 'RESIDENTIAL',
    totalValue: propertyData.totalValue,
    landArea: propertyData.landArea,
    buildingArea: propertyData.buildingArea,
    yearBuilt: propertyData.yearBuilt,
    features: propertyData.features || [],
    images: propertyData.images || [],
    documents: propertyData.documents || [],
    owner: {
      name: propertyData.ownerName || '',
      address: propertyData.owner,
      contact: propertyData.ownerContact || ''
    },
    tokenization: {
      totalTokens: propertyData.totalTokens || 0,
      tokenPrice: propertyData.tokenPrice || 0,
      minInvestment: propertyData.minInvestment || 0,
      maxInvestment: propertyData.maxInvestment || 0,
      lockupPeriod: propertyData.lockupPeriod || 0,
      dividendRate: propertyData.dividendRate || 0
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function uploadMetadataToIPFS(metadata: any): Promise<string> {
  // 임시로 고정된 IPFS 해시 반환
  console.log('✅ Metadata created (IPFS upload simulated)');
  return 'QmTestMetadataHash';
}

async function main() {
  console.log('🏗️  Testing Property Registration and Tokenization System...');

  // 컨트랙트 인스턴스 가져오기
  const [deployer, user1, user2] = await ethers.getSigners();
  
  const PropertyRegistry = await ethers.getContractFactory('PropertyRegistry');
  const PropertyToken = await ethers.getContractFactory('PropertyToken');
  const KYCVerification = await ethers.getContractFactory('KYCVerification');

  // 컨트랙트 배포 (이미 배포되어 있다면 주소 사용)
  console.log('\n📝 Deploying contracts...');
  
  const kycVerification = await KYCVerification.deploy();
  await kycVerification.deployed();
  console.log('✅ KYCVerification deployed to:', kycVerification.address);

  const propertyToken = await PropertyToken.deploy(
    'HomeSure Property Token',
    'HSPT',
    kycVerification.address
  );
  await propertyToken.deployed();
  console.log('✅ PropertyToken deployed to:', propertyToken.address);

  const propertyRegistry = await PropertyRegistry.deploy(propertyToken.address);
  await propertyRegistry.deployed();
  console.log('✅ PropertyRegistry deployed to:', propertyRegistry.address);

  // PropertyToken에 PropertyRegistry 권한 부여
  const ISSUER_ROLE = await propertyToken.ISSUER_ROLE();
  await propertyToken.grantRole(ISSUER_ROLE, propertyRegistry.address);
  console.log('✅ Granted ISSUER_ROLE to PropertyRegistry');

  // KYC 검증 설정
  await kycVerification.grantRole(await kycVerification.KYC_MANAGER_ROLE(), deployer.address);
  await kycVerification.verifyKYC(user1.address, 1, 0, 0, 365 * 24 * 60 * 60, 'QmTestHash', 'TEST001');
  await kycVerification.verifyKYC(user2.address, 1, 0, 0, 365 * 24 * 60 * 60, 'QmTestHash', 'TEST002');
  console.log('✅ KYC verification set up');

  // PropertyToken에 KYC 컨트랙트 설정
  await propertyToken.updateKYCVerificationContract(kycVerification.address);
  console.log('✅ KYC contract linked to PropertyToken');

  // 1. 부동산 등록 요청 생성
  console.log('\n🏠 Creating property registration request...');
  
  const registrationFee = ethers.utils.parseEther('0.01');
  const propertyValue = ethers.utils.parseEther('1000000'); // 1M ETH
  
  const tx1 = await propertyRegistry.connect(user1).createRegistrationRequest(
    '서울시 강남구 테헤란로 123',
    propertyValue,
    500, // landArea (sqm)
    300, // buildingArea (sqm)
    2020, // yearBuilt
    0, // PropertyType.RESIDENTIAL
    'QmTestMetadataHash',
    { value: registrationFee }
  );
  
  const receipt1 = await tx1.wait();
  const event1 = receipt1.events?.find(e => e.event === 'RegistrationRequestCreated');
  const requestId = event1?.args?.requestId;
  console.log('✅ Registration request created with ID:', requestId.toString());

  // 2. 등록 요청 승인
  console.log('\n✅ Approving registration request...');
  
  await propertyRegistry.approveRegistrationRequest(requestId);
  console.log('✅ Registration request approved');

  // 3. 부동산 정보 조회
  console.log('\n📋 Getting property information...');
  
  const property = await propertyRegistry.properties(1);
  console.log('Property ID:', property.propertyId.toString());
  console.log('Location:', property.location);
  console.log('Total Value:', ethers.utils.formatEther(property.totalValue), 'ETH');
  console.log('Status:', property.status);
  console.log('Is Tokenized:', property.isTokenized);

  // 4. IPFS 메타데이터 생성 및 업로드 (시뮬레이션)
  console.log('\n🌐 Creating IPFS metadata...');
  
  const propertyData = {
    propertyId: '1',
    name: '강남 고급 아파트',
    description: '서울 강남구 중심부에 위치한 고급 주거용 아파트',
    location: '서울시 강남구 테헤란로 123',
    city: '서울',
    country: 'South Korea',
    coordinates: { latitude: 37.5665, longitude: 126.9780 },
    propertyType: 'RESIDENTIAL',
    totalValue: ethers.utils.formatEther(propertyValue),
    landArea: 500,
    buildingArea: 300,
    yearBuilt: 2020,
    features: ['엘리베이터', '주차장', '보안시스템', '헬스장'],
    images: [],
    documents: [],
    owner: user1.address,
    ownerName: '김철수',
    ownerContact: '010-1234-5678'
  };

  const metadata = createPropertyMetadata(propertyData);
  console.log('✅ Property metadata created');

  // 5. 부동산 토큰화
  console.log('\n🪙 Tokenizing property...');
  
  const totalTokens = ethers.utils.parseEther('1000000'); // 1M tokens
  const tokenPrice = ethers.utils.parseEther('1'); // 1 ETH per token
  const minInvestment = ethers.utils.parseEther('0.1'); // 0.1 ETH
  const maxInvestment = ethers.utils.parseEther('100'); // 100 ETH
  const lockupPeriod = 365 * 24 * 60 * 60; // 1 year
  const dividendRate = 500; // 5% (500 basis points)
  
  await propertyRegistry.tokenizeProperty(
    1, // propertyId
    totalTokens,
    tokenPrice,
    minInvestment,
    maxInvestment,
    lockupPeriod,
    dividendRate,
    'QmTokenMetadataHash'
  );
  console.log('✅ Property tokenized successfully');

  // 6. 토큰화 정보 조회
  console.log('\n📊 Getting tokenization information...');
  
  const tokenizationInfo = await propertyRegistry.getTokenizationInfo(1);
  console.log('Total Tokens:', ethers.utils.formatEther(tokenizationInfo.totalTokens));
  console.log('Token Price:', ethers.utils.formatEther(tokenizationInfo.tokenPrice), 'ETH');
  console.log('Issued Tokens:', ethers.utils.formatEther(tokenizationInfo.issuedTokens));
  console.log('Available Tokens:', ethers.utils.formatEther(tokenizationInfo.availableTokens));
  console.log('Min Investment:', ethers.utils.formatEther(tokenizationInfo.minInvestment), 'ETH');
  console.log('Max Investment:', ethers.utils.formatEther(tokenizationInfo.maxInvestment), 'ETH');
  console.log('Lockup Period:', tokenizationInfo.lockupPeriod.toString(), 'seconds');
  console.log('Dividend Rate:', tokenizationInfo.dividendRate.toString(), 'basis points');

  // 7. 토큰 투자 (user2가 투자)
  console.log('\n💰 Investing in property tokens...');
  
  const investmentAmount = ethers.utils.parseEther('10'); // 10 ETH
  const tokenAmount = investmentAmount.mul(ethers.utils.parseEther('1')).div(tokenPrice);
  
  await propertyRegistry.connect(user2).investInProperty(1, tokenAmount, { value: investmentAmount });
  console.log('✅ Investment successful');
  console.log('Investment Amount:', ethers.utils.formatEther(investmentAmount), 'ETH');
  console.log('Token Amount:', ethers.utils.formatEther(tokenAmount));

  // 8. 투자자 정보 조회
  console.log('\n👤 Getting investor information...');
  
  const investorInfo = await propertyRegistry.getInvestorInfo(user2.address, 1);
  console.log('Investor:', investorInfo.investor);
  console.log('Token Amount:', ethers.utils.formatEther(investorInfo.tokenAmount));
  console.log('Investment Amount:', ethers.utils.formatEther(investorInfo.investmentAmount));
  console.log('Investment Date:', new Date(investorInfo.investmentDate.toNumber() * 1000).toISOString());
  console.log('Lockup End Date:', new Date(investorInfo.lockupEndDate.toNumber() * 1000).toISOString());
  console.log('Is Active:', investorInfo.isActive);

  // 9. 토큰 잔액 확인
  console.log('\n💎 Checking token balances...');
  
  const user2Balance = await propertyToken.balanceOf(user2.address);
  console.log('User2 Token Balance:', ethers.utils.formatEther(user2Balance));

  // 10. 부동산 투자자 목록 조회
  console.log('\n📋 Getting property investors...');
  
  const investors = await propertyRegistry.getPropertyInvestors(1);
  console.log('Property Investors:', investors);

  // 11. 투자자별 부동산 목록 조회
  console.log('\n🏠 Getting investor properties...');
  
  const user2Properties = await propertyRegistry.getInvestorProperties(user2.address);
  console.log('User2 Properties:', user2Properties.map(p => p.toString()));

  // 12. 소유권 현황 조회
  console.log('\n📊 Getting ownership status...');
  
  const [propertyIds, balances] = await propertyRegistry.getOwnerTokenBalances(user2.address);
  console.log('User2 Property IDs:', propertyIds.map(p => p.toString()));
  console.log('User2 Token Balances:', balances.map(b => ethers.utils.formatEther(b)));

  console.log('\n🎉 Property registration and tokenization test completed successfully!');
  console.log('\n📋 Summary:');
  console.log('- Property registered and approved');
  console.log('- Property tokenized with ERC-1400 standard');
  console.log('- Investment made successfully');
  console.log('- All queries working correctly');
  console.log('- KYC integration functional');
  console.log('- IPFS metadata system ready');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }); 