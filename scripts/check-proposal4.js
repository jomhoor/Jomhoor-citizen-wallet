const { ethers } = require('ethers')

async function main() {
  const p = new ethers.JsonRpcProvider('https://l2.rarimo.com')
  const psAddr = '0xa16d9BC3d71acfC4F188A51417811660b285428A'
  const abi = [
    'function getProposalInfo(uint256) view returns (tuple(address, uint8, tuple(uint256,uint256,uint256,uint256[],string,address[],bytes[]), tuple(uint256[])[]))',
  ]
  const c = new ethers.Contract(psAddr, abi, p)
  const r = await c.getProposalInfo(4)

  const wdList = r[2][6] // votingWhitelistData array (bytes[])
  console.log('Whitelist data count:', wdList.length)
  console.log('Raw whitelist hex (first 200):', wdList[0].substring(0, 200))

  // Decode the whitelist data
  const dec = ethers.AbiCoder.defaultAbiCoder().decode(
    ['tuple(uint256,uint256[],uint256,uint256,uint256,uint256,uint256,uint256)'],
    wdList[0],
  )
  const d = dec[0]
  console.log('\n=== Decoded Whitelist Data ===')
  console.log('selector:', d[0].toString(), '(hex: 0x' + d[0].toString(16) + ')')
  console.log(
    'nationalities:',
    d[1].map(n => '0x' + n.toString(16)),
  )
  console.log('identityCreationTimestampUpperBound:', d[2].toString())
  console.log('identityCounterUpperBound:', d[3].toString())
  console.log('sex:', d[4].toString())
  console.log('birthDateLowerbound:', d[5].toString(), '(hex: 0x' + d[5].toString(16) + ')')
  console.log('birthDateUpperbound:', d[6].toString(), '(hex: 0x' + d[6].toString(16) + ')')
  console.log('expirationDateLowerBound:', d[7].toString(), '(hex: 0x' + d[7].toString(16) + ')')

  // Also check the voting addresses
  const votingAddrs = r[2][5] // votingAddresses
  console.log('\n=== Voting Addresses ===')
  votingAddrs.forEach((v, i) => console.log(`  [${i}]:`, v))

  // Check proposal status
  console.log('\n=== Proposal Status ===')
  console.log('Voting contract:', r[0])
  console.log('Status:', r[1])
}

main().catch(e => console.error(e.message))
