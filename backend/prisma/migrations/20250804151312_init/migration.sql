-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('USER', 'ADMIN', 'REGISTRAR', 'VALUATOR', 'EXPERT', 'ORACLE');

-- CreateEnum
CREATE TYPE "public"."KYCStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'COMMERCIAL', 'LAND', 'OFFICE', 'RETAIL', 'INDUSTRIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PropertyStatus" AS ENUM ('PENDING', 'ACTIVE', 'SOLD', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."DocumentType" AS ENUM ('REGISTRATION_CERTIFICATE', 'VALUATION_REPORT', 'CONTRACT', 'IDENTITY_DOCUMENT', 'PROOF_OF_ADDRESS', 'FINANCIAL_STATEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('TOKEN_PURCHASE', 'TOKEN_SALE', 'TOKEN_TRANSFER', 'PROPERTY_PURCHASE', 'PROPERTY_SALE', 'VALUATION_FEE', 'DISPUTE_FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ValuationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'RE_EVALUATING', 'FINALIZED');

-- CreateEnum
CREATE TYPE "public"."ValuationMethod" AS ENUM ('COMPARABLE_SALES', 'INCOME_CAPITALIZATION', 'COST_APPROACH', 'DISCOUNTED_CASH_FLOW', 'AUTOMATED_MODEL', 'EXPERT_OPINION');

-- CreateEnum
CREATE TYPE "public"."DataType" AS ENUM ('PROPERTY_PRICE', 'MARKET_TREND', 'RENTAL_RATE', 'INTEREST_RATE', 'ECONOMIC_INDICATOR', 'REGULATORY_INFO', 'WEATHER_DATA', 'CRIME_RATE', 'INFRASTRUCTURE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."SourceType" AS ENUM ('CHAINLINK', 'API3', 'BAND_PROTOCOL', 'NEST_PROTOCOL', 'CUSTOM_API', 'MANUAL_ENTRY', 'GOVERNMENT_DATA', 'REAL_ESTATE_AGENCY', 'APPRAISAL_FIRM', 'OTHER_SOURCE');

-- CreateEnum
CREATE TYPE "public"."ReliabilityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "public"."VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "public"."KYCSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."WhitelistStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "public"."AMLTransactionType" AS ENUM ('TOKEN_PURCHASE', 'TOKEN_SALE', 'TOKEN_TRANSFER', 'WITHDRAWAL', 'DEPOSIT', 'EXCHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."AMLAlertType" AS ENUM ('HIGH_VALUE_TRANSACTION', 'FREQUENT_TRANSACTIONS', 'SUSPICIOUS_PATTERN', 'SANCTIONS_MATCH', 'PEP_MATCH', 'GEOGRAPHIC_RISK', 'STRUCTURED_TRANSACTION', 'UNUSUAL_ACTIVITY');

-- CreateEnum
CREATE TYPE "public"."AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."ConsentType" AS ENUM ('DATA_PROCESSING', 'MARKETING', 'THIRD_PARTY_SHARING', 'COOKIES', 'ANALYTICS', 'SECURITY');

-- CreateEnum
CREATE TYPE "public"."DeletionRequestType" AS ENUM ('ACCOUNT_DELETION', 'DATA_ANONYMIZATION', 'SPECIFIC_DATA_DELETION', 'PORTABILITY_REQUEST');

-- CreateEnum
CREATE TYPE "public"."DeletionRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "kycStatus" "public"."KYCStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "role" "public"."UserRole" NOT NULL DEFAULT 'USER',
    "walletAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."properties" (
    "id" TEXT NOT NULL,
    "propertyId" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "propertyType" "public"."PropertyType" NOT NULL,
    "totalValue" DECIMAL(20,8) NOT NULL,
    "landArea" DECIMAL(10,2),
    "buildingArea" DECIMAL(10,2),
    "yearBuilt" INTEGER,
    "status" "public"."PropertyStatus" NOT NULL DEFAULT 'PENDING',
    "isTokenized" BOOLEAN NOT NULL DEFAULT false,
    "tokenContractId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documents" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "documentType" "public"."DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "ipfsHash" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "encryptionKey" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transactions" (
    "id" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "tokenAmount" DECIMAL(20,8),
    "transactionType" "public"."TransactionType" NOT NULL,
    "status" "public"."TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "gasUsed" INTEGER,
    "gasPrice" DECIMAL(20,8),
    "blockNumber" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."portfolios" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalValue" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "totalTokens" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "propertiesCount" INTEGER NOT NULL DEFAULT 0,
    "performance" JSONB,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."kyc_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" "public"."DocumentType" NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "verificationStatus" "public"."KYCStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ownership_history" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "previousOwner" TEXT,
    "newOwner" TEXT NOT NULL,
    "transferAmount" DECIMAL(20,8) NOT NULL,
    "tokenAmount" DECIMAL(20,8),
    "ownershipPercentage" DECIMAL(5,2),
    "transferReason" TEXT,
    "transactionHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ownership_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."valuations" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "originalValue" DECIMAL(20,8) NOT NULL,
    "evaluatedValue" DECIMAL(20,8),
    "marketValue" DECIMAL(20,8),
    "confidenceScore" INTEGER,
    "status" "public"."ValuationStatus" NOT NULL DEFAULT 'PENDING',
    "method" "public"."ValuationMethod" NOT NULL,
    "reportHash" TEXT NOT NULL,
    "notes" TEXT,
    "isDisputed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "valuatorId" TEXT NOT NULL,

    CONSTRAINT "valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."disputes" (
    "id" TEXT NOT NULL,
    "valuationId" TEXT NOT NULL,
    "appellant" TEXT NOT NULL,
    "proposedValue" DECIMAL(20,8) NOT NULL,
    "reason" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."expert_reviews" (
    "id" TEXT NOT NULL,
    "valuationId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "comments" TEXT,
    "fee" DECIMAL(20,8),
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expert_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."oracle_data" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "dataType" "public"."DataType" NOT NULL,
    "sourceType" "public"."SourceType" NOT NULL,
    "dataSource" TEXT NOT NULL,
    "value" DECIMAL(20,8) NOT NULL,
    "confidence" INTEGER,
    "reliability" "public"."ReliabilityLevel" NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oracle_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."blacklisted_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'logout',
    "blacklistedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blacklisted_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "verificationStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "documentType" TEXT,
    "documentNumber" TEXT,
    "documentHash" TEXT,
    "country" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "verificationDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "isDocumentAuthentic" BOOLEAN,
    "documentConfidence" DECIMAL(3,2),
    "isFaceMatch" BOOLEAN,
    "faceConfidence" DECIMAL(3,2),
    "metadata" JSONB,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT true,
    "encryptionKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."kyc_sessions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."KYCSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "redirectUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "callbackData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."whitelist_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "status" "public"."WhitelistStatus" NOT NULL DEFAULT 'ACTIVE',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whitelist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."aml_transactions" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "transactionType" "public"."AMLTransactionType" NOT NULL,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskFactors" JSONB,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aml_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."aml_alerts" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "alertType" "public"."AMLAlertType" NOT NULL,
    "severity" "public"."AlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aml_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."gdpr_consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" "public"."ConsentType" NOT NULL,
    "isGranted" BOOLEAN NOT NULL DEFAULT false,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gdpr_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."data_deletion_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestType" "public"."DeletionRequestType" NOT NULL,
    "status" "public"."DeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "public"."users"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "properties_propertyId_key" ON "public"."properties"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_fileHash_key" ON "public"."documents"("fileHash");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_transactionHash_key" ON "public"."transactions"("transactionHash");

-- CreateIndex
CREATE UNIQUE INDEX "portfolios_userId_key" ON "public"."portfolios"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_records_userId_key" ON "public"."kyc_records"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "blacklisted_tokens_token_key" ON "public"."blacklisted_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_sessionToken_key" ON "public"."user_sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refreshToken_key" ON "public"."user_sessions"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "user_verifications_userId_key" ON "public"."user_verifications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_verifications_sessionId_key" ON "public"."user_verifications"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_sessions_sessionId_key" ON "public"."kyc_sessions"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "whitelist_entries_userId_key" ON "public"."whitelist_entries"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "whitelist_entries_verificationId_key" ON "public"."whitelist_entries"("verificationId");

-- CreateIndex
CREATE UNIQUE INDEX "aml_transactions_transactionId_key" ON "public"."aml_transactions"("transactionId");

-- AddForeignKey
ALTER TABLE "public"."properties" ADD CONSTRAINT "properties_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."portfolios" ADD CONSTRAINT "portfolios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."kyc_records" ADD CONSTRAINT "kyc_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ownership_history" ADD CONSTRAINT "ownership_history_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."valuations" ADD CONSTRAINT "valuations_valuatorId_fkey" FOREIGN KEY ("valuatorId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."valuations" ADD CONSTRAINT "valuations_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."disputes" ADD CONSTRAINT "disputes_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "public"."valuations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."disputes" ADD CONSTRAINT "disputes_appellant_fkey" FOREIGN KEY ("appellant") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expert_reviews" ADD CONSTRAINT "expert_reviews_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "public"."valuations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expert_reviews" ADD CONSTRAINT "expert_reviews_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_verifications" ADD CONSTRAINT "user_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."kyc_sessions" ADD CONSTRAINT "kyc_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."whitelist_entries" ADD CONSTRAINT "whitelist_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."whitelist_entries" ADD CONSTRAINT "whitelist_entries_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "public"."user_verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."aml_transactions" ADD CONSTRAINT "aml_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."aml_transactions" ADD CONSTRAINT "aml_transactions_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "public"."user_verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."aml_alerts" ADD CONSTRAINT "aml_alerts_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."aml_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gdpr_consents" ADD CONSTRAINT "gdpr_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
