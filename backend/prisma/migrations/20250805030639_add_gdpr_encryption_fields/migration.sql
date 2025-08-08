-- AlterTable
ALTER TABLE "public"."aml_transactions" ADD COLUMN     "anonymizedAt" TIMESTAMP(3),
ADD COLUMN     "isAnonymized" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."kyc_records" ADD COLUMN     "anonymizedAt" TIMESTAMP(3),
ADD COLUMN     "isAnonymized" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."transactions" ADD COLUMN     "anonymizedAt" TIMESTAMP(3),
ADD COLUMN     "isAnonymized" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletionRequestId" TEXT;

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" TEXT NOT NULL,
    "orderId" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "quantity" DECIMAL(20,8) NOT NULL,
    "filledQuantity" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "remainingQuantity" DECIMAL(20,8) NOT NULL,
    "expiryTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "transactionHash" TEXT,
    "blockchainOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."trades" (
    "id" TEXT NOT NULL,
    "tradeId" SERIAL NOT NULL,
    "buyOrderId" INTEGER NOT NULL,
    "sellOrderId" INTEGER NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "buyerAddress" TEXT NOT NULL,
    "sellerAddress" TEXT NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "quantity" DECIMAL(20,8) NOT NULL,
    "totalAmount" DECIMAL(20,8) NOT NULL,
    "platformFee" DECIMAL(20,8),
    "buyerFee" DECIMAL(20,8),
    "sellerFee" DECIMAL(20,8),
    "status" TEXT NOT NULL DEFAULT 'EXECUTED',
    "transactionHash" TEXT,
    "blockchainTradeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."escrows" (
    "id" TEXT NOT NULL,
    "escrowId" SERIAL NOT NULL,
    "tradeId" INTEGER NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "conditions" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionHash" TEXT,
    "blockchainEscrowId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."data_archives" (
    "id" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "encryptedData" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."access_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderId_key" ON "public"."orders"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "trades_tradeId_key" ON "public"."trades"("tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "escrows_escrowId_key" ON "public"."escrows"("escrowId");

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."properties"("propertyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."trades" ADD CONSTRAINT "trades_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."properties"("propertyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."escrows" ADD CONSTRAINT "escrows_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "public"."trades"("tradeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."escrows" ADD CONSTRAINT "escrows_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
