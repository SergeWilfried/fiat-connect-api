import { ethers } from 'ethers'
import { ensureLeading0x } from '@celo/utils/lib/address'
import fetch from 'node-fetch'
import { SiweMessage } from 'siwe'

const DOMAIN = 'dunia.africa'

/**
 * This function shows how to use SIWE for authentication with a local server via the FiatConnect API.
 *
 * (Note that the transferId given is 'test', which probably won't exist. Note also that this function doesn't start
 *  the local server. It's just an example that you can optionally borrow from for integration testing.)
 */
async function main() {
  // deepcode ignore HardcodedNonCryptoSecret: <debug>
  const privateKey =
    '0x9999999999999999999999999999999999999999999999999999999999999999'
  const publicKey = new ethers.utils.SigningKey(privateKey).compressedPublicKey
  const accountAddress = ethers.utils.computeAddress(ensureLeading0x(publicKey))
  const wallet = new ethers.Wallet(privateKey)

  const expirationDate = new Date(Date.now() + 14400000)  // 4 hours from now

  const siweMessage = new SiweMessage({
    domain: DOMAIN,
    address: accountAddress,
    statement: 'Sign in with Ethereum',
    uri: `https://${DOMAIN}`,
    version: '1',
    chainId: 44787,
    nonce: '123839086978',
    expirationTime: expirationDate.toISOString(),
  })
  const message = siweMessage.prepareMessage()
  const signature = await wallet.signMessage(message)

  console.log(JSON.stringify({ message, signature }))

  const authResponse = await fetch('http://localhost:8080/auth/login', {
    method: 'POST',
    body: JSON.stringify({ message, signature }),
    headers: { 'Content-Type': 'application/json' },
  })

  if (!authResponse.ok) {
    console.log('Auth request failed:', await authResponse.text())
    return
  }


  // set-cookie will be of the form:
  // api-starter=<cookie-val>; Path=/; Expires=Fri, 22 Apr 2022 10:36:40 GMT; HttpOnly; SameSite=Strict
  const authCookie = authResponse.headers.raw()['set-cookie'][0]
  // console.log('cookie',authCookie.split(';')[0])
  console.log('cookie',authCookie.split(';')[0])

  // const response = await fetch('http://localhost:8080/kyc/personalDataAndDocuments', {
  //   headers: {
  //     'cookie': authCookie.split(';')[0] // strip out additional fields like Path, Expires
  //   },
  //   method: 'POST',
  //   body: JSON.stringify(
  //     {

  //       "lastName": "Bob",
  //       "firstName": "Alice",
  //       "middleName": "Foo",
  //       "dateOfBirth": {
  //         "day": "12",
  //         "year": "1994",
  //         "month": "4"
  //       },
  //       "address": {
  //         "city": "Lagos",
  //         "address1": "No 15",
  //         "address2": "string",
  //         "postalCode": "100001",
  //         "isoRegionCode": "KD",
  //         "isoCountryCode": "NG"
  //       },
  //       "phoneNumber": "07037205555",
  //       "selfieDocument": "abc",
  //       "identificationDocument": "def"
      
  //   })
  // })
  // const data = await response.json()
  // console.log(data)
}

main()
