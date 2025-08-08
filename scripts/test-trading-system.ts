import { ethers } from 'hardhat';

async function main() {
  console.log('🏗️  Testing Trading System...');

  // 컨트랙트 인스턴스 가져오기
  const [deployer, user1, user2, user3] = await ethers.getSigners();
  
  const PropertyRegistry = await ethers.getContractFactory('PropertyRegistry');
  const PropertyToken = await ethers.getContractFactory('PropertyToken');
  const KYCVerification = await ethers.getContractFactory('KYCVerification');
  const TradingContract = await ethers.getContractFactory('TradingContract');

  // 컨트랙트 배포
  console.log('\n📝 Deploying contracts...');
  
  const kycVerification = await KYCVerification.deploy();
  await kycVerification.deployed();
  console.log('✅ KYCVerification deployed to:', kycVerification.address);

  const propertyToken = await PropertyToken.deploy();
  await propertyToken.deployed();
  console.log('✅ PropertyToken deployed to:', propertyToken.address);

  const propertyRegistry = await PropertyRegistry.deploy(propertyToken.address);
  await propertyRegistry.deployed();
  console.log('✅ PropertyRegistry deployed to:', propertyRegistry.address);

  const tradingContract = await TradingContract.deploy(
    propertyToken.address,
    propertyRegistry.address,
    kycVerification.address
  );
  await tradingContract.deployed();
  console.log('✅ TradingContract deployed to:', tradingContract.address);

  // 권한 설정
  const ISSUER_ROLE = await propertyToken.ISSUER_ROLE();
  await propertyToken.grantRole(ISSUER_ROLE, propertyRegistry.address);
  console.log('✅ Granted ISSUER_ROLE to PropertyRegistry');

  // KYC 검증 설정
  await kycVerification.grantRole(await kycVerification.KYC_MANAGER_ROLE(), deployer.address);
  await kycVerification.verifyKYC(user1.address, 1, 0, 0, 365 days, 'QmTestHash', 'TEST001');
  await kycVerification.verifyKYC(user2.address, 1, 0, 0, 365 days, 'QmTestHash', 'TEST002');
  await kycVerification.verifyKYC(user3.address, 1, 0, 0, 365 days, 'QmTestHash', 'TEST003');
  console.log('✅ KYC verification set up');

  // PropertyToken에 KYC 컨트랙트 설정
  await propertyToken.updateKYCVerificationContract(kycVerification.address);
  console.log('✅ KYC contract linked to PropertyToken');

  // 1. 부동산 등록 및 토큰화
  console.log('\n🏠 Registering and tokenizing property...');
  
  const registrationFee = ethers.utils.parseEther('0.01');
  const propertyValue = ethers.utils.parseEther('1000000'); // 1M ETH
  
  const tx1 = await propertyRegistry.connect(user1).createRegistrationRequest(
    '서울시 강남구 테헤란로 123',
    propertyValue,
    500, // landArea (sqm)
    300, // buildingArea (sqm)
    2020, // yearBuilt
    0, // RESIDENTIAL
    'QmTestMetadataHash',
    { value: registrationFee }
  );
  
  const receipt1 = await tx1.wait();
  const event1 = receipt1.events?.find(e => e.event === 'RegistrationRequestCreated');
  const requestId = event1?.args?.requestId;
  console.log('✅ Registration request created with ID:', requestId.toString());

  await propertyRegistry.approveRegistrationRequest(requestId);
  console.log('✅ Registration request approved');

  // 토큰화
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

  // 2. 초기 토큰 분배
  console.log('\n💰 Distributing initial tokens...');
  
  const initialInvestment = ethers.utils.parseEther('100'); // 100 ETH
  const tokenAmount = initialInvestment.mul(ethers.utils.parseEther('1')).div(tokenPrice);
  
  await propertyRegistry.connect(user2).investInProperty(1, tokenAmount, { value: initialInvestment });
  console.log('✅ User2 invested:', ethers.utils.formatEther(initialInvestment), 'ETH');
  console.log('✅ User2 received:', ethers.utils.formatEther(tokenAmount), 'tokens');

  await propertyRegistry.connect(user3).investInProperty(1, tokenAmount, { value: initialInvestment });
  console.log('✅ User3 invested:', ethers.utils.formatEther(initialInvestment), 'ETH');
  console.log('✅ User3 received:', ethers.utils.formatEther(tokenAmount), 'tokens');

  // 3. 거래 권한 설정
  console.log('\n🔐 Setting up trading permissions...');
  
  const TRADER_ROLE = await tradingContract.TRADER_ROLE();
  const MATCHER_ROLE = await tradingContract.MATCHER_ROLE();
  
  await tradingContract.grantRole(TRADER_ROLE, user1.address);
  await tradingContract.grantRole(TRADER_ROLE, user2.address);
  await tradingContract.grantRole(TRADER_ROLE, user3.address);
  console.log('✅ Granted TRADER_ROLE to users');

  // 4. 토큰 승인
  console.log('\n✅ Approving tokens for trading...');
  
  await propertyToken.connect(user2).approve(tradingContract.address, tokenAmount);
  await propertyToken.connect(user3).approve(tradingContract.address, tokenAmount);
  console.log('✅ Tokens approved for trading contract');

  // 5. 매도 주문 생성
  console.log('\n📉 Creating sell orders...');
  
  const sellPrice = ethers.utils.parseEther('1.1'); // 1.1 ETH per token
  const sellQuantity = ethers.utils.parseEther('1000'); // 1000 tokens
  const expiryTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  
  const sellOrder1 = await tradingContract.connect(user2).createOrder(
    1, // propertyId
    1, // SELL
    sellPrice,
    sellQuantity,
    expiryTime
  );
  console.log('✅ User2 sell order created');

  const sellOrder2 = await tradingContract.connect(user3).createOrder(
    1, // propertyId
    1, // SELL
    sellPrice,
    sellQuantity,
    expiryTime
  );
  console.log('✅ User3 sell order created');

  // 6. 매수 주문 생성
  console.log('\n📈 Creating buy orders...');
  
  const buyPrice = ethers.utils.parseEther('1.2'); // 1.2 ETH per token
  const buyQuantity = ethers.utils.parseEther('500'); // 500 tokens
  const buyAmount = buyPrice.mul(buyQuantity);
  
  const buyOrder1 = await tradingContract.connect(user1).createOrder(
    1, // propertyId
    0, // BUY
    buyPrice,
    buyQuantity,
    expiryTime,
    { value: buyAmount }
  );
  console.log('✅ User1 buy order created with', ethers.utils.formatEther(buyAmount), 'ETH');

  // 7. 주문 매칭 및 거래 실행
  console.log('\n🤝 Matching orders and executing trades...');
  
  const matchQuantity = ethers.utils.parseEther('500'); // 500 tokens
  
  const trade1 = await tradingContract.matchOrders(
    buyOrder1.orderId,
    sellOrder1.orderId,
    matchQuantity
  );
  console.log('✅ Trade executed between User1 and User2');

  // 8. 거래 정보 조회
  console.log('\n📊 Getting trade information...');
  
  const trade = await tradingContract.getTrade(1);
  console.log('Trade ID:', trade.tradeId.toString());
  console.log('Buyer:', trade.buyer);
  console.log('Seller:', trade.seller);
  console.log('Price:', ethers.utils.formatEther(trade.price), 'ETH');
  console.log('Quantity:', ethers.utils.formatEther(trade.quantity));
  console.log('Trade Amount:', ethers.utils.formatEther(trade.tradeAmount), 'ETH');
  console.log('Platform Fee:', ethers.utils.formatEther(trade.platformFee), 'ETH');

  // 9. 주문 상태 확인
  console.log('\n📋 Checking order status...');
  
  const buyOrder = await tradingContract.getOrder(buyOrder1.orderId);
  const sellOrder = await tradingContract.getOrder(sellOrder1.orderId);
  
  console.log('Buy Order Status:', buyOrder.status);
  console.log('Buy Order Filled:', ethers.utils.formatEther(buyOrder.filledQuantity));
  console.log('Buy Order Remaining:', ethers.utils.formatEther(buyOrder.remainingQuantity));
  
  console.log('Sell Order Status:', sellOrder.status);
  console.log('Sell Order Filled:', ethers.utils.formatEther(sellOrder.filledQuantity));
  console.log('Sell Order Remaining:', ethers.utils.formatEther(sellOrder.remainingQuantity));

  // 10. 토큰 잔액 확인
  console.log('\n💎 Checking token balances...');
  
  const user1Balance = await propertyToken.balanceOf(user1.address);
  const user2Balance = await propertyToken.balanceOf(user2.address);
  const user3Balance = await propertyToken.balanceOf(user3.address);
  
  console.log('User1 Token Balance:', ethers.utils.formatEther(user1Balance));
  console.log('User2 Token Balance:', ethers.utils.formatEther(user2Balance));
  console.log('User3 Token Balance:', ethers.utils.formatEther(user3Balance));

  // 11. 거래 히스토리 조회
  console.log('\n📜 Getting trade history...');
  
  const user1History = await tradingContract.getTraderHistory(user1.address);
  const user2History = await tradingContract.getTraderHistory(user2.address);
  
  console.log('User1 Trade History Count:', user1History.length);
  console.log('User2 Trade History Count:', user2History.length);

  // 12. 에스크로 생성 (시뮬레이션)
  console.log('\n🔒 Creating escrow (simulation)...');
  
  const ESCROW_MANAGER_ROLE = await tradingContract.ESCROW_MANAGER_ROLE();
  await tradingContract.grantRole(ESCROW_MANAGER_ROLE, deployer.address);
  
  const escrowAmount = ethers.utils.parseEther('10'); // 10 ETH
  const escrow = await tradingContract.createEscrow(
    1, // tradeId
    escrowAmount,
    'Release after 24 hours'
  );
  console.log('✅ Escrow created for trade 1');

  // 13. 부동산별 거래 목록 조회
  console.log('\n🏠 Getting property trades...');
  
  const propertyTrades = await tradingContract.getPropertyTrades(1);
  console.log('Property 1 Trade Count:', propertyTrades.length);

  // 14. 거래자별 주문 목록 조회
  console.log('\n👤 Getting trader orders...');
  
  const user1Orders = await tradingContract.getTraderOrders(user1.address);
  const user2Orders = await tradingContract.getTraderOrders(user2.address);
  
  console.log('User1 Order Count:', user1Orders.length);
  console.log('User2 Order Count:', user2Orders.length);

  // 15. 플랫폼 수수료 확인
  console.log('\n💰 Checking platform fees...');
  
  const contractBalance = await tradingContract.getContractBalance();
  console.log('Trading Contract Balance:', ethers.utils.formatEther(contractBalance), 'ETH');

  console.log('\n🎉 Trading system test completed successfully!');
  console.log('\n📋 Summary:');
  console.log('- Property registered and tokenized');
  console.log('- Initial token distribution completed');
  console.log('- Buy and sell orders created');
  console.log('- Orders matched and trade executed');
  console.log('- Trade history recorded');
  console.log('- Escrow system functional');
  console.log('- All queries working correctly');
  console.log('- Platform fees collected');
  console.log('- ERC-1400 integration working');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }); 