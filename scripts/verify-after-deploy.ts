import { run, network } from 'hardhat';
import fs from 'fs';

async function main() {
  const raw = fs.readFileSync('deployment.json', 'utf8');
  const { contracts } = JSON.parse(raw);

  // 각 컨트랙트 검증 (생성자 인자 주입 필요 시 scripts/args.* 로 확장)
  const ordered: Array<[string, string, string[]]> = [
    ['KYCVerification', contracts.KYCVerification, []],
    ['PropertyOracle', contracts.PropertyOracle, []],
    ['PropertyValuation', contracts.PropertyValuation, [contracts.PropertyOracle]],
    [
      'PropertyToken',
      contracts.PropertyToken,
      ['HomeSure Property Token', 'HSPT', contracts.KYCVerification],
    ],
    ['PropertyRegistry', contracts.PropertyRegistry, [contracts.PropertyToken]],
    [
      'TradingContract',
      contracts.TradingContract,
      [contracts.PropertyToken, contracts.PropertyRegistry, contracts.KYCVerification],
    ],
  ];

  for (const [name, address, args] of ordered) {
    console.log(`\n🔎 Verifying ${name} at ${address} on ${network.name}...`);
    try {
      await run('verify:verify', {
        address,
        constructorArguments: args,
      });
      console.log(`✅ Verified ${name}`);
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (
        msg.includes('Already Verified') ||
        msg.includes('Contract source code already verified')
      ) {
        console.log(`ℹ️  ${name} already verified`);
      } else {
        console.warn(`⚠️  Verification skipped for ${name}: ${msg}`);
      }
    }
  }

  console.log('\n🎉 Verification flow finished.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
