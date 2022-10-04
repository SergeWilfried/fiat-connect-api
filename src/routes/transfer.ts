import express from 'express'
import { asyncRoute } from './async-route'
import { validateSchema } from '../schema/'
import { TransferRequestBody, TransferStatusRequestParams } from '../types'
import { siweAuthMiddleware } from '../middleware/authenticate'
import { Transfer } from '../entity/transfer.entity'
import {
  CryptoType,
  FiatAccountSchema,
  FiatAccountType,
  FiatConnectError,
  TransferStatus,
  TransferType,
} from '@fiatconnect/fiatconnect-types'
import { ethers } from 'ethers'
import { ensureLeading0x } from '@celo/utils/lib/address'

import * as dotenv from 'dotenv'
import { Quote } from '../entity/quote.entity'
import { Repository } from 'typeorm'
import { Account } from '../entity/account.entity'

dotenv.config()

/// Load private keys from environment
const SENDER_PRIVATE_KEY: string =
  process.env.SENDER_PRIVATE_KEY !== undefined
    ? process.env.SENDER_PRIVATE_KEY
    : ''

const RECEIVER_PRIVATE_KEY: string =
  process.env.RECEIVER_PRIVATE_KEY !== undefined
    ? process.env.RECEIVER_PRIVATE_KEY
    : ''

export function transferRouter({
  clientAuthMiddleware,
  dataSource,
  client,
}: {
  clientAuthMiddleware: express.RequestHandler[]
  dataSource: any
  client: any
}): express.Router {
  const router = express.Router()
  // Load Repository
  const repository = dataSource.getRepository(Transfer)
  const quoteRepository: Repository<Quote> = dataSource.getRepository(Quote)
  const accountRepository = dataSource.getRepository(Account)
  const entity = new Transfer()

  router.use(siweAuthMiddleware)
  router.use(clientAuthMiddleware)
  const transferRequestBodyValidator = (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    req.body = validateSchema<TransferRequestBody>(
      req.body,
      'TransferRequestBodySchema',
    )
    next()
  }

  const transferStatusRequestParamsValidator = (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    req.params = validateSchema<TransferStatusRequestParams>(
      req.params,
      'TransferStatusRequestParamsSchema',
    )
    next()
  }

  router.post(
    '/in',
    transferRequestBodyValidator,
    asyncRoute(
      async (
        req: express.Request<{}, {}, TransferRequestBody>,
        res: express.Response,
      ) => {
        const idempotencyKey = req.headers['idempotency-key']?.toString()

        let isKeyValid
        if (idempotencyKey) {
          isKeyValid = await validateIdempotencyKey(idempotencyKey, client)
        } else {
          return res.status(422).send('Unprocessable Entity')
        }
        // Check if the idempotency key is already in the cache
        if (isKeyValid) {
          try {
            // Load the corresponding privateKey
            const publicKey = new ethers.utils.SigningKey(SENDER_PRIVATE_KEY)
              .compressedPublicKey
            const transferAddress = ethers.utils.computeAddress(
              ensureLeading0x(publicKey),
            )
            console.log('quote', req.body.quoteId)
            entity.id = idempotencyKey
            entity.quoteId = req.body.quoteId
            entity.fiatAccountId = req.body.fiatAccountId
            entity.transferAddress = transferAddress
            entity.transferType = TransferType.TransferIn
            const quote = await quoteRepository.findOneBy({
              id: req.body.quoteId,
            })
            const account: Account = await accountRepository.findOneBy({
              id: req.body.fiatAccountId,
            })
            const fiatAccounts: any = quote?.fiatAccount
            const detailledQuote: any = quote?.quote
            let fee = 0
            if (account.fiatAccountType === FiatAccountType.MobileMoney) {
              fee = fiatAccounts[FiatAccountSchema.MobileMoney]?.fee
            } else {
              fee = fiatAccounts[FiatAccountSchema.DuniaWallet]?.fee
            }
            entity.fiatType = detailledQuote?.fiatType
            entity.cryptoType = detailledQuote?.cryptoType
            entity.amountProvided = detailledQuote?.fiatAmount.toString()
            entity.amountReceived = detailledQuote?.cryptoAmount.toString()
            console.log('fiatAccounts', fiatAccounts)
            /// Verify quote validity
            const isValidUntil: Date = detailledQuote?.guaranteedUntil
            if (Date.now() > isValidUntil.getTime()) {
              entity.status = TransferStatus.TransferFailed
            }
            entity.status = TransferStatus.TransferStarted

            //TODO: GET Fee from account Map

            entity.fee = fee
            const results = await repository.save(entity)
            await markKeyAsUsed(idempotencyKey, client, results.id)

            return res.send({
              transferId: entity.id,
              transferStatus: entity.status,
              // Address from which the transfer will be sent
              transferAddress: entity.transferAddress,
            })
          } catch (error: any) {
            res.status(409).send({ error: FiatConnectError.ResourceExists })
          }
        }
        const transfer = await repository.findOneBy({
          id: idempotencyKey,
        })
        return res.send({
          transferId: transfer.id,
          transferStatus: transfer.status,
          // Address that the user must send funds to
          transferAddress: transfer.transferAddress,
        })
      },
    ),
  )

  router.post(
    '/out',
    transferRequestBodyValidator,
    asyncRoute(
      async (
        req: express.Request<{}, {}, TransferRequestBody>,
        res: express.Response,
      ) => {
        const idempotencyKey = req.headers['idempotency-key']?.toString()

        if (!idempotencyKey) {
          return res.status(422).send('Unprocessable Entity')
        }

        const isValid = await validateIdempotencyKey(idempotencyKey, client)

        // Check if the idempotency key is already in the cache
        if (isValid) {
          try {
            // Load the corresponding privateKey

            const publicKey = new ethers.utils.SigningKey(RECEIVER_PRIVATE_KEY)
              .compressedPublicKey
            const transferAddress = ethers.utils.computeAddress(
              ensureLeading0x(publicKey),
            )

            entity.id = idempotencyKey
            entity.quoteId = req.body.quoteId
            entity.fiatAccountId = req.body.fiatAccountId
            entity.transferAddress = transferAddress
            entity.transferType = TransferType.TransferOut
            const quote = await quoteRepository.findOneBy({
              id: req.body.quoteId,
            })
            const fiatAccounts: any = quote?.fiatAccount
            const detailledQuote: any = quote?.quote
            const account: Account = await accountRepository.findOneBy({
              id: req.body.fiatAccountId,
            })

            entity.fiatType = detailledQuote?.fiatType
            entity.cryptoType = detailledQuote?.cryptoType
            entity.amountProvided = detailledQuote?.cryptoAmount.toString()
            entity.amountReceived = detailledQuote?.fiatAmount.toString()
            let fee = 0

            if (account.fiatAccountType === FiatAccountType.MobileMoney) {
              fee = fiatAccounts[FiatAccountSchema.MobileMoney]?.fee
            } else if (
              account.fiatAccountType === FiatAccountType.DuniaWallet
            ) {
              fee = fiatAccounts[FiatAccountSchema.DuniaWallet]?.fee
            } else {
              fee = fiatAccounts[FiatAccountSchema.AccountNumber]?.fee
            }
            entity.fee = fee

            const results = await repository.save(entity)

            await markKeyAsUsed(idempotencyKey, client, results.id)

            return res.send({
              transferId: results.id,
              transferStatus: entity.status,
              // Address that the user must send funds to
              transferAddress: entity.transferAddress,
            })
          } catch (error: any) {
            res.status(409).send({ error: FiatConnectError.ResourceExists })
          }
        }
        const transfer = await repository.findOneBy({
          id: idempotencyKey,
        })
        return res.send({
          transferId: transfer.id,
          transferStatus: transfer.status,
          // Address that the user must send funds to
          transferAddress: transfer.transferAddress,
        })
      },
    ),
  )

  router.get(
    '/:transferId/status',
    transferStatusRequestParamsValidator,
    asyncRoute(
      async (
        req: express.Request<TransferStatusRequestParams>,
        res: express.Response,
      ) => {
        try {
          const transfer = await repository.findOneBy({
            id: req.params.transferId,
          })

          return res.send({
            status: transfer.status,
            transferType: transfer.transferType,
            fiatType: transfer.fiatType,
            cryptoType: transfer.cryptoType,
            amountProvided: transfer.amountProvided,
            amountReceived: transfer.amountReceived,
            fee: transfer.fee,
            fiatAccountId: transfer.fiatAccountId,
            transferId: transfer.id,
            transferAddress: transfer.transferAddress,
          })
        } catch (error) {
          return res
            .status(404)
            .send({ error: FiatConnectError.ResourceNotFound })
        }
      },
    ),
  )

  return router
}

async function validateIdempotencyKey(_nonce: string, _redisClient: any) {
  // must validate that the IdempotencyKey hasn't already been used. If a IdempotencyKey is already used, must throw a InvalidParameters
  // error. e.g. `throw new Error(FiatConnectError.InvalidParameters)`
  try {
    const keyInUse = await _redisClient.get(_nonce)
    // eslint-disable-next-line no-console
    if (keyInUse) {
      return false
    }
    return true
  } catch (error) {
    return false
  }
}

async function markKeyAsUsed(_key: string, _redisClient: any, _id: string) {
  // helper method for storing nonces, which can then be used by the above method.
  try {
    await _redisClient.set(_key, _id, {
      NX: true,
    })
    return true
  } catch (error) {
    return false
  }
}
