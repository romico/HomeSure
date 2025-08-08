import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract, ContractFactory } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('PropertyToken', function () {
  let PropertyToken: ContractFactory;
  let propertyToken: Contract;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addr3: SignerWithAddress;

  beforeEach(async function () {
    // Get signers
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    // Deploy contract
    PropertyToken = await ethers.getContractFactory('PropertyToken');
    propertyToken = await PropertyToken.deploy('HomeSure Property Token', 'HSPT');
    await propertyToken.deployed();
  });

  describe('Deployment', function () {
    it('Should set the right owner', async function () {
      expect(await propertyToken.owner()).to.equal(owner.address);
    });

    it('Should have correct name and symbol', async function () {
      expect(await propertyToken.name()).to.equal('HomeSure Property Token');
      expect(await propertyToken.symbol()).to.equal('HSPT');
    });

    it('Should have zero total supply initially', async function () {
      expect(await propertyToken.totalSupply()).to.equal(0);
    });
  });

  describe('Access Control', function () {
    it('Should allow owner to grant roles', async function () {
      const ISSUER_ROLE = await propertyToken.ISSUER_ROLE();
      await propertyToken.grantRole(ISSUER_ROLE, addr1.address);
      expect(await propertyToken.hasRole(ISSUER_ROLE, addr1.address)).to.be.true;
    });

    it('Should not allow non-owner to grant roles', async function () {
      const ISSUER_ROLE = await propertyToken.ISSUER_ROLE();
      await expect(
        propertyToken.connect(addr1).grantRole(ISSUER_ROLE, addr2.address)
      ).to.be.revertedWith('AccessControl');
    });
  });

  describe('Property Registration', function () {
    beforeEach(async function () {
      // Grant issuer role to addr1
      const ISSUER_ROLE = await propertyToken.ISSUER_ROLE();
      await propertyToken.grantRole(ISSUER_ROLE, addr1.address);
    });

    it('Should allow issuer to register property', async function () {
      const location = 'Seoul, Gangnam-gu';
      const totalValue = ethers.utils.parseEther('1000000'); // 1M ETH
      const maxTokens = ethers.utils.parseEther('1000000'); // 1M tokens
      const propertyType = 0; // RESIDENTIAL
      const metadata = 'ipfs://QmTestHash';

      await propertyToken.connect(addr1).registerProperty(
        location,
        totalValue,
        maxTokens,
        propertyType,
        metadata
      );

      const property = await propertyToken.getProperty(1);
      expect(property.location).to.equal(location);
      expect(property.totalValue).to.equal(totalValue);
      expect(property.maxTokens).to.equal(maxTokens);
      expect(property.propertyType).to.equal(propertyType);
      expect(property.metadata).to.equal(metadata);
      expect(property.owner).to.equal(addr1.address);
    });

    it('Should not allow non-issuer to register property', async function () {
      const location = 'Seoul, Gangnam-gu';
      const totalValue = ethers.utils.parseEther('1000000');
      const maxTokens = ethers.utils.parseEther('1000000');
      const propertyType = 0;
      const metadata = 'ipfs://QmTestHash';

      await expect(
        propertyToken.connect(addr2).registerProperty(
          location,
          totalValue,
          maxTokens,
          propertyType,
          metadata
        )
      ).to.be.revertedWith('AccessControl');
    });
  });

  describe('KYC Management', function () {
    beforeEach(async function () {
      // Grant KYC role to addr1
      const KYC_ROLE = await propertyToken.KYC_ROLE();
      await propertyToken.grantRole(KYC_ROLE, addr1.address);
    });

    it('Should allow KYC role to set KYC status', async function () {
      await propertyToken.connect(addr1).setKYCStatus(addr2.address, true);
      expect(await propertyToken.isKYCVerified(addr2.address)).to.be.true;
    });

    it('Should not allow non-KYC role to set KYC status', async function () {
      await expect(
        propertyToken.connect(addr2).setKYCStatus(addr3.address, true)
      ).to.be.revertedWith('AccessControl');
    });
  });

  describe('Token Issuance', function () {
    beforeEach(async function () {
      // Grant issuer role to addr1
      const ISSUER_ROLE = await propertyToken.ISSUER_ROLE();
      await propertyToken.grantRole(ISSUER_ROLE, addr1.address);

      // Grant KYC role to addr1
      const KYC_ROLE = await propertyToken.KYC_ROLE();
      await propertyToken.grantRole(KYC_ROLE, addr1.address);

      // Register a property
      const location = 'Seoul, Gangnam-gu';
      const totalValue = ethers.utils.parseEther('1000000');
      const maxTokens = ethers.utils.parseEther('1000000');
      const propertyType = 0;
      const metadata = 'ipfs://QmTestHash';

      await propertyToken.connect(addr1).registerProperty(
        location,
        totalValue,
        maxTokens,
        propertyType,
        metadata
      );

      // Set property status to ACTIVE
      await propertyToken.connect(addr1).updatePropertyStatus(1, 1); // ACTIVE = 1

      // Set KYC status for addr2
      await propertyToken.connect(addr1).setKYCStatus(addr2.address, true);
    });

    it('Should allow issuer to issue tokens to KYC verified address', async function () {
      const amount = ethers.utils.parseEther('1000');
      const price = ethers.utils.parseEther('1');
      const reason = 'Initial token issuance';

      await propertyToken.connect(addr1).issueTokens(
        1, // propertyId
        addr2.address,
        amount,
        price,
        reason
      );

      expect(await propertyToken.balanceOf(addr2.address)).to.be.gt(0);
    });

    it('Should not allow issuance to non-KYC verified address', async function () {
      const amount = ethers.utils.parseEther('1000');
      const price = ethers.utils.parseEther('1');
      const reason = 'Initial token issuance';

      await expect(
        propertyToken.connect(addr1).issueTokens(
          1, // propertyId
          addr3.address, // Not KYC verified
          amount,
          price,
          reason
        )
      ).to.be.revertedWithCustomError(propertyToken, 'NotKYCVerified');
    });
  });

  describe('Token Transfer', function () {
    beforeEach(async function () {
      // Grant issuer role to addr1
      const ISSUER_ROLE = await propertyToken.ISSUER_ROLE();
      await propertyToken.grantRole(ISSUER_ROLE, addr1.address);

      // Grant KYC role to addr1
      const KYC_ROLE = await propertyToken.KYC_ROLE();
      await propertyToken.grantRole(KYC_ROLE, addr1.address);

      // Register a property
      const location = 'Seoul, Gangnam-gu';
      const totalValue = ethers.utils.parseEther('1000000');
      const maxTokens = ethers.utils.parseEther('1000000');
      const propertyType = 0;
      const metadata = 'ipfs://QmTestHash';

      await propertyToken.connect(addr1).registerProperty(
        location,
        totalValue,
        maxTokens,
        propertyType,
        metadata
      );

      // Set property status to ACTIVE
      await propertyToken.connect(addr1).updatePropertyStatus(1, 1); // ACTIVE = 1

      // Set KYC status for addr2 and addr3
      await propertyToken.connect(addr1).setKYCStatus(addr2.address, true);
      await propertyToken.connect(addr1).setKYCStatus(addr3.address, true);

      // Issue tokens to addr2
      const amount = ethers.utils.parseEther('1000');
      const price = ethers.utils.parseEther('1');
      const reason = 'Initial token issuance';

      await propertyToken.connect(addr1).issueTokens(
        1, // propertyId
        addr2.address,
        amount,
        price,
        reason
      );
    });

    it('Should allow transfer between KYC verified addresses', async function () {
      const transferAmount = ethers.utils.parseEther('100');
      const balanceBefore = await propertyToken.balanceOf(addr2.address);

      await propertyToken.connect(addr2).transfer(addr3.address, transferAmount);

      const balanceAfter = await propertyToken.balanceOf(addr2.address);
      expect(balanceAfter).to.equal(balanceBefore.sub(transferAmount));
      expect(await propertyToken.balanceOf(addr3.address)).to.equal(transferAmount);
    });

    it('Should not allow transfer to non-KYC verified address', async function () {
      const transferAmount = ethers.utils.parseEther('100');

      await expect(
        propertyToken.connect(addr2).transfer(addr1.address, transferAmount)
      ).to.be.revertedWithCustomError(propertyToken, 'NotKYCVerified');
    });
  });

  describe('Token Redemption', function () {
    beforeEach(async function () {
      // Grant issuer role to addr1
      const ISSUER_ROLE = await propertyToken.ISSUER_ROLE();
      await propertyToken.grantRole(ISSUER_ROLE, addr1.address);

      // Grant KYC role to addr1
      const KYC_ROLE = await propertyToken.KYC_ROLE();
      await propertyToken.grantRole(KYC_ROLE, addr1.address);

      // Register a property
      const location = 'Seoul, Gangnam-gu';
      const totalValue = ethers.utils.parseEther('1000000');
      const maxTokens = ethers.utils.parseEther('1000000');
      const propertyType = 0;
      const metadata = 'ipfs://QmTestHash';

      await propertyToken.connect(addr1).registerProperty(
        location,
        totalValue,
        maxTokens,
        propertyType,
        metadata
      );

      // Set property status to ACTIVE
      await propertyToken.connect(addr1).updatePropertyStatus(1, 1); // ACTIVE = 1

      // Set KYC status for addr2
      await propertyToken.connect(addr1).setKYCStatus(addr2.address, true);

      // Issue tokens to addr2
      const amount = ethers.utils.parseEther('1000');
      const price = ethers.utils.parseEther('1');
      const reason = 'Initial token issuance';

      await propertyToken.connect(addr1).issueTokens(
        1, // propertyId
        addr2.address,
        amount,
        price,
        reason
      );
    });

    it('Should allow token redemption', async function () {
      const redeemAmount = ethers.utils.parseEther('100');
      const balanceBefore = await propertyToken.balanceOf(addr2.address);

      await propertyToken.connect(addr2).redeemTokens(1, redeemAmount);

      const balanceAfter = await propertyToken.balanceOf(addr2.address);
      expect(balanceAfter).to.equal(balanceBefore.sub(redeemAmount));
    });

    it('Should not allow redemption of more tokens than owned', async function () {
      const balance = await propertyToken.balanceOf(addr2.address);
      const redeemAmount = balance.add(ethers.utils.parseEther('1'));

      await expect(
        propertyToken.connect(addr2).redeemTokens(1, redeemAmount)
      ).to.be.revertedWithCustomError(propertyToken, 'InsufficientBalance');
    });
  });

  describe('Pause/Unpause', function () {
    beforeEach(async function () {
      // Grant issuer role to addr1
      const ISSUER_ROLE = await propertyToken.ISSUER_ROLE();
      await propertyToken.grantRole(ISSUER_ROLE, addr1.address);
    });

    it('Should allow issuer to pause and unpause', async function () {
      await propertyToken.connect(addr1).pause();
      expect(await propertyToken.paused()).to.be.true;

      await propertyToken.connect(addr1).unpause();
      expect(await propertyToken.paused()).to.be.false;
    });

    it('Should not allow non-issuer to pause', async function () {
      await expect(
        propertyToken.connect(addr2).pause()
      ).to.be.revertedWith('AccessControl');
    });
  });
}); 