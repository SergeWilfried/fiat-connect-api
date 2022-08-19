import express from 'express'
import { asyncRoute } from './async-route'
import { validateSchema } from '../schema/'
import {
  DeleteFiatAccountRequestParams,
  PostFiatAccountRequestBody,
  SupportedFiatAccountSchemas,
} from '../types'
import { siweAuthMiddleware } from '../middleware/authenticate'
import { Account } from '../entity/account.entity'
import {
  AccountNumber,
  DuniaWallet,
  FiatAccountSchemas,
  FiatConnectError,
  MobileMoney,
} from '@fiatconnect/fiatconnect-types'

export function accountsRouter({
  clientAuthMiddleware,
  dataSource,
}: {
  clientAuthMiddleware: express.RequestHandler[]
  dataSource: any
}): express.Router {
  const router = express.Router()

  router.use(siweAuthMiddleware)
  router.use(clientAuthMiddleware)

  const postFiatAccountRequestBodyValidator = (
    req: express.Request<
      {},
      {},
      PostFiatAccountRequestBody<SupportedFiatAccountSchemas>
    >,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    req.body = validateSchema<
      PostFiatAccountRequestBody<SupportedFiatAccountSchemas>
    >(req.body, 'PostFiatAccountRequestBodySchema')
    next()
  }

  const deleteFiatAccountRequestParamsValidator = (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    req.params = validateSchema<DeleteFiatAccountRequestParams>(
      req.params,
      'DeleteFiatAccountRequestParamsSchema',
    )
    next()
  }

  router.post(
    '/',
    postFiatAccountRequestBodyValidator,
    asyncRoute(
      async (
        req: express.Request<
          {},
          {},
          PostFiatAccountRequestBody<SupportedFiatAccountSchemas>
        >,
        _res: express.Response,
      ) => {
        let userAddress = ''
        if (
          req.session.siwe?.address !== undefined &&
          req.session.siwe.address !== null
        ) {
          userAddress = req.session.siwe?.address
        }

        // Validate data in body for exact fiat account schema type. The body middleware
        // doesn't ensure exact match of fiatAccountSchema and data
        validateSchema<FiatAccountSchemas[typeof req.body.fiatAccountSchema]>(
          req.body.data,
          `${req.body.fiatAccountSchema}Schema`,
        )

        const entity = new Account()
        entity.institutionName = req.body.data.institutionName
        entity.accountName = req.body.data?.accountName
        entity.owner = userAddress
        entity.fiatAccountType = req.body.data?.fiatAccountType
        entity.fiatAccountSchema = req.body.fiatAccountSchema

        // todo: Refactor Typechecking to use type guards
        let formatedType
        switch (req.body.fiatAccountSchema) {
          case 'AccountNumber':
            formatedType = req.body.data as AccountNumber
            entity.accountNumber = formatedType.accountNumber
            entity.country = formatedType?.country
            break
          case 'DuniaWallet':
            formatedType = req.body.data as DuniaWallet
            entity.mobile = formatedType?.mobile

            break
          case 'MobileMoney':
            formatedType = req.body.data as MobileMoney
            entity.mobile = formatedType?.mobile
            entity.operator = formatedType?.operator
            entity.country = formatedType?.country
            break
        }

        /// TODO: Generate entity based on validatedData type

        try {
          // Load Repository
          const repository = dataSource.getRepository(Account)
          await repository.save(entity)

          return _res.send({
            fiatAccountId: entity.id,
            accountName: entity.accountName,
            institutionName: entity.institutionName,
            fiatAccountType: entity.fiatAccountType,
            fiatAccountSchema: `${req.body.fiatAccountSchema}Schema`,
          })
        } catch (error) {
          return _res
            .status(409)
            .send({ error: FiatConnectError.ResourceExists })
        }
      },
    ),
  )

  router.get(
    '/',
    asyncRoute(async (_req: express.Request, _res: express.Response) => {
      try {
        const userAddress = _req.session.siwe?.address
        // Load Repository
        const repository = dataSource.getRepository(Account)
        const transfer = await repository.findBy({
          owner: userAddress,
        })
        return _res.send(transfer)
      } catch (error) {
        return _res
          .status(404)
          .send({ error: FiatConnectError.ResourceNotFound })
      }
    }),
  )

  router.delete(
    '/:fiatAccountId',
    deleteFiatAccountRequestParamsValidator,
    asyncRoute(
      async (
        _req: express.Request<DeleteFiatAccountRequestParams>,
        _res: express.Response,
      ) => {
        const userAddress = _req.session.siwe?.address

        try {
          // Load Repository
          const repository = dataSource.getRepository(Account)

          const toRemove = await repository.findOneBy({
            id: _req.body.fiatAccountId,
            owner: userAddress,
          })

          await repository.remove(toRemove)
          return _res.status(200).send({})
        } catch (error) {
          return _res
            .status(404)
            .send({ error: FiatConnectError.ResourceNotFound })
        }
      },
    ),
  )
  return router
}
