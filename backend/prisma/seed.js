const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@homesure.com' },
    update: {},
    create: {
      email: 'admin@homesure.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      kycStatus: 'APPROVED',
      walletAddress: '0x1234567890123456789012345678901234567890',
    },
  });

  // Create registrar user
  const registrarPassword = await bcrypt.hash('registrar123', 12);
  const registrar = await prisma.user.upsert({
    where: { email: 'registrar@homesure.com' },
    update: {},
    create: {
      email: 'registrar@homesure.com',
      password: registrarPassword,
      firstName: 'Property',
      lastName: 'Registrar',
      role: 'REGISTRAR',
      kycStatus: 'APPROVED',
      walletAddress: '0x2345678901234567890123456789012345678901',
    },
  });

  // Create valuator user
  const valuatorPassword = await bcrypt.hash('valuator123', 12);
  const valuator = await prisma.user.upsert({
    where: { email: 'valuator@homesure.com' },
    update: {},
    create: {
      email: 'valuator@homesure.com',
      password: valuatorPassword,
      firstName: 'Property',
      lastName: 'Valuator',
      role: 'VALUATOR',
      kycStatus: 'APPROVED',
      walletAddress: '0x3456789012345678901234567890123456789012',
    },
  });

  // Create expert user
  const expertPassword = await bcrypt.hash('expert123', 12);
  const expert = await prisma.user.upsert({
    where: { email: 'expert@homesure.com' },
    update: {},
    create: {
      email: 'expert@homesure.com',
      password: expertPassword,
      firstName: 'Property',
      lastName: 'Expert',
      role: 'EXPERT',
      kycStatus: 'APPROVED',
      walletAddress: '0x4567890123456789012345678901234567890123',
    },
  });

  // Create regular user
  const userPassword = await bcrypt.hash('user123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'user@homesure.com' },
    update: {},
    create: {
      email: 'user@homesure.com',
      password: userPassword,
      firstName: 'Regular',
      lastName: 'User',
      role: 'USER',
      kycStatus: 'APPROVED',
      walletAddress: '0x5678901234567890123456789012345678901234',
    },
  });

  // Create sample property
  const property = await prisma.property.create({
    data: {
      title: '강남구 테헤란로 아파트',
      description: '강남구 테헤란로에 위치한 고급 아파트입니다.',
      location: '강남구 테헤란로 123',
      city: '서울특별시',
      country: '대한민국',
      postalCode: '06123',
      propertyType: 'APARTMENT',
      totalValue: 500000000, // 5억원
      landArea: 150.5,
      buildingArea: 89.3,
      yearBuilt: 2015,
      status: 'ACTIVE',
      isTokenized: false,
      metadata: {
        amenities: ['주차장', '헬스장', '수영장', '도서관'],
        nearby: ['지하철역', '버스정류장', '상업시설'],
        features: ['전용면적', '남향', '고층'],
      },
      ownerId: user.id,
    },
  });

  // Create sample document
  const document = await prisma.document.create({
    data: {
      propertyId: property.id,
      documentType: 'REGISTRATION_CERTIFICATE',
      fileName: '등기부등본.pdf',
      fileHash: 'QmHash123456789',
      ipfsHash: 'QmIPFSHash123456789',
      version: '1.0',
      isEncrypted: false,
      isVerified: true,
      verifiedBy: registrar.id,
      verifiedAt: new Date(),
      verificationNotes: '정상 등기부등본 확인됨',
    },
  });

  // Create sample portfolio
  const portfolio = await prisma.portfolio.create({
    data: {
      userId: user.id,
      totalValue: 500000000,
      totalTokens: 0,
      propertiesCount: 1,
      performance: {
        totalReturn: 0,
        monthlyReturn: 0,
        yearlyReturn: 0,
      },
    },
  });

  // Create sample valuation
  const valuation = await prisma.valuation.create({
    data: {
      propertyId: property.id,
      originalValue: 500000000,
      evaluatedValue: 520000000,
      marketValue: 510000000,
      confidenceScore: 85,
      status: 'COMPLETED',
      method: 'COMPARABLE_SALES',
      reportHash: 'QmReportHash123456789',
      notes: '시장 비교법을 통한 평가 완료',
      isDisputed: false,
      completedAt: new Date(),
      valuatorId: valuator.id,
    },
  });

  // Create sample expert review
  const expertReview = await prisma.expertReview.create({
    data: {
      valuationId: valuation.id,
      expertId: expert.id,
      isApproved: true,
      confidenceScore: 90,
      comments: '평가가 적절하며 시장 상황을 잘 반영함',
      fee: 1000000, // 100만원
    },
  });

  // Create sample transaction
  const transaction = await prisma.transaction.create({
    data: {
      transactionHash: '0xTransactionHash123456789',
      propertyId: property.id,
      fromAddress: '0x0000000000000000000000000000000000000000',
      toAddress: user.walletAddress,
      amount: 500000000,
      transactionType: 'PROPERTY_PURCHASE',
      status: 'CONFIRMED',
      gasUsed: 21000,
      gasPrice: 20000000000, // 20 Gwei
      blockNumber: 12345678,
      metadata: {
        method: 'transfer',
        gasLimit: 21000,
      },
      userId: user.id,
    },
  });

  // Create sample ownership history
  const ownershipHistory = await prisma.ownershipHistory.create({
    data: {
      propertyId: property.id,
      previousOwner: null,
      newOwner: user.walletAddress,
      transferAmount: 500000000,
      transferReason: '초기 소유권 이전',
      transactionHash: transaction.transactionHash,
    },
  });

  console.log('✅ Database seeding completed!');
  console.log('📊 Created:');
  console.log(`  - Admin: ${admin.email}`);
  console.log(`  - Registrar: ${registrar.email}`);
  console.log(`  - Valuator: ${valuator.email}`);
  console.log(`  - Expert: ${expert.email}`);
  console.log(`  - User: ${user.email}`);
  console.log(`  - Property: ${property.title}`);
  console.log(`  - Document: ${document.fileName}`);
  console.log(`  - Portfolio: ${portfolio.id}`);
  console.log(`  - Valuation: ${valuation.id}`);
  console.log(`  - Expert Review: ${expertReview.id}`);
  console.log(`  - Transaction: ${transaction.transactionHash}`);
  console.log(`  - Ownership History: ${ownershipHistory.id}`);
}

main()
  .catch(e => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
