import express from 'express'
import { asyncRoute } from './async-route'
import { validateSchema } from '../schema/'
import { KycRequestParams, KycSchemas, SupportedKycSchemas } from '../types'
import { siweAuthMiddleware } from '../middleware/authenticate'
import { KYC } from '../entity/kyc.entity'
import {
  FiatConnectError,
  KycSchema,
  KycStatus,
} from '@fiatconnect/fiatconnect-types'

export function kycRouter({
  clientAuthMiddleware,
  dataSource,
}: {
  clientAuthMiddleware: express.RequestHandler[]
  dataSource: any
}): express.Router {
  const router = express.Router()

  router.use(siweAuthMiddleware)
  router.use(clientAuthMiddleware)

  const kycSchemaRequestParamsValidator = (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    req.params = validateSchema<KycRequestParams>(
      req.params,
      'KycRequestParamsSchema',
    )
    next()
  }

  router.post(
    '/:kycSchema',
    kycSchemaRequestParamsValidator,
    asyncRoute(
      async (
        req: express.Request<
          KycRequestParams,
          {},
          KycSchemas[SupportedKycSchemas]
        >,
        _res: express.Response,
      ) => {
        const kycOwner = req.session.siwe?.address

        // Delegate to type-specific handlers after validation provides type guards
        const formattedSchema = validateSchema<
          KycSchemas[typeof req.params.kycSchema]
        >(req.body, `${req.params.kycSchema}KycSchema`)
        /// TODO: Handle Geo
        try {
          // Load Repository
          const repository = dataSource.getRepository(KYC)
          const entity = new KYC()
          entity.kycRequired = true
          entity.address = formattedSchema?.address
          entity.dateOfBirth = formattedSchema?.dateOfBirth
          entity.firstName = formattedSchema?.firstName
          entity.owner = kycOwner != null ? kycOwner : ''
          entity.lastName = formattedSchema?.lastName
          entity.middleName = formattedSchema?.middleName
          entity.phoneNumber = formattedSchema?.phoneNumber
          entity.selfieDocument = formattedSchema?.selfieDocument
          entity.identificationDocument =
            formattedSchema?.identificationDocument
          entity.kycSchemaName = req.params.kycSchema
          entity.status = KycStatus.KycPending

          await repository.save(entity)
          return _res.send({ kycStatus: KycStatus.KycPending })
        } catch (error) {
          return _res
            .status(409)
            .send({ error: FiatConnectError.ResourceExists })
        }
      },
    ),
  )

  router.get(
    '/:kycSchema/status',
    kycSchemaRequestParamsValidator,
    asyncRoute(
      async (req: express.Request<KycRequestParams>, res: express.Response) => {
        const kycOwner = req.session.siwe?.address

        try {
          validateSchema<KycSchemas[typeof req.params.kycSchema]>(
            req.body,
            `${req.params.kycSchema}KycSchema`,
          )
          // Load Repository
          const repository = dataSource.getRepository(KYC)

          const result = await repository.findOneBy({
            owner: kycOwner,
            kycSchemaName: req.params.kycSchema,
          })

          return res.send({ status: result?.status })
        } catch (error) {
          return res
            .status(404)
            .send({ error: FiatConnectError.ResourceNotFound })
        }
      },
    ),
  )

  router.delete(
    '/:kycSchema',
    kycSchemaRequestParamsValidator,
    asyncRoute(
      async (req: express.Request<KycRequestParams>, res: express.Response) => {
        validateSchema<KycSchemas[typeof req.params.kycSchema]>(
          req.body,
          `${req.params.kycSchema}KycSchema`,
        )
        const kycOwner = req.session.siwe?.address

        try {
          // Load Repository
          const repository = dataSource.getRepository(KYC)

          const toRemove = await repository.findOneBy({
            owner: kycOwner,
            kycSchemaName: req.params.kycSchema,
          })

          await repository.remove(toRemove)
          return res.status(200).send({})
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
