const { ethers } = require('ethers')

const RPC = 'https://l2.rarimo.com'
const REGISTRATION2 = '0x11BB4B14AA6e4b836580F3DBBa741dD89423B971'
const REG_SMT = '0x479F84502Db545FA8d2275372E0582425204A879'
const CERT_SMT = '0xA8b350d699632569D5351B20ffC1b31202AcEDD8'

async function main() {
  const p = new ethers.JsonRpcProvider(RPC)

  // 1. Check SMT roots
  const regSmt = new ethers.Contract(REG_SMT, ['function getRoot() view returns (bytes32)'], p)
  const certSmt = new ethers.Contract(CERT_SMT, ['function getRoot() view returns (bytes32)'], p)

  const regRoot = await regSmt.getRoot()
  const certRoot = await certSmt.getRoot()
  console.log('=== Mainnet Registration Status ===')
  console.log('RegistrationSMT root:', regRoot)
  console.log('RegistrationSMT has entries:', regRoot !== '0x' + '0'.repeat(64))
  console.log('CertificatesSMT root:', certRoot)
  console.log('CertificatesSMT has entries:', certRoot !== '0x' + '0'.repeat(64))

  // 2. Check C_RSA_2048 dispatcher (INID)
  const reg2 = new ethers.Contract(
    REGISTRATION2,
    ['function certificateDispatchers(bytes32) view returns (address)'],
    p,
  )

  const typeHash = ethers.keccak256(ethers.toUtf8Bytes('C_RSA_2048'))
  const dispatcherAddr = await reg2.certificateDispatchers(typeHash)
  console.log('\nC_RSA_2048 dispatcher:', dispatcherAddr)
  console.log(
    'INID dispatcher exists:',
    dispatcherAddr !== '0x0000000000000000000000000000000000000000',
  )

  // 3. Scan ALL registration events from block 0
  const blockNum = await p.getBlockNumber()
  console.log('\nCurrent mainnet block:', blockNum)

  // Use Registration2 ABI for events
  const reg2Events = new ethers.Contract(
    REGISTRATION2,
    [
      'event IdentityRegistered(uint256 indexed identityKey, uint8 method)',
      'event CertificateRegistered(bytes32 indexed certificateKey)',
    ],
    p,
  )

  // Scan in chunks of 2000
  let identityEvents = []
  let certEvents = []
  const chunkSize = 2000
  for (let from = 0; from <= blockNum; from += chunkSize) {
    const to = Math.min(from + chunkSize - 1, blockNum)
    try {
      const iEvents = await reg2Events.queryFilter('IdentityRegistered', from, to)
      const cEvents = await reg2Events.queryFilter('CertificateRegistered', from, to)
      identityEvents.push(...iEvents)
      certEvents.push(...cEvents)
    } catch (e) {
      // RPC might not support large ranges, try to continue
    }
  }

  console.log('\n=== Registration Events (all time) ===')
  console.log('Total IdentityRegistered events:', identityEvents.length)
  console.log('Total CertificateRegistered events:', certEvents.length)

  for (const e of identityEvents) {
    console.log(
      '  Identity - block:',
      e.blockNumber,
      'key:',
      e.args[0].toString().substring(0, 30) + '...',
      'method:',
      e.args[1],
    )
  }

  for (const e of certEvents) {
    console.log('  Certificate - block:', e.blockNumber, 'key:', e.args[0])
  }
}

main().catch(e => console.error('Error:', e.message))
