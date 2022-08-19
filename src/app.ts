import express from 'express'
import Session from 'express-session'
import { quoteRouter } from './routes/quote'
import { kycRouter } from './routes/kyc'
import { accountsRouter } from './routes/accounts'
import { transferRouter } from './routes/transfer'
import { errorToStatusCode } from './middleware/error'
import { authRouter } from './routes/auth'
import { AppDataSource } from './utils/data-source'

function getSessionName(): string {
  // must return a name for the session cookie, typically the provider name
  return 'DUNIA PAYMENT'
}

export function initApp({
  clientAuthMiddleware,
  sessionSecret,
  chainId,
  client,
}: {
  clientAuthMiddleware: express.RequestHandler[]
  sessionSecret: string
  chainId: number
  client: any
}): express.Application {
  const app = express()
  const dataSource = AppDataSource
  app.use(express.json())

  app.get('/clock', (_req, _res) => {
    // NOTE: you *could* just use res.status(200).send({time: new Date().toISOFormat()}), BUT only if your server is single-node
    //  (otherwise you need session affinity or some way of guaranteeing consistency of the current time between nodes)
    return _res.status(200).send({ time: new Date().toISOString() })
  })

  app.use(
    // https://www.npmjs.com/package/express-session-expire-timeout#sessionoptions
    Session({
      name: getSessionName(),
      secret: sessionSecret,
      resave: true,
      saveUninitialized: true,
      cookie: { secure: false, sameSite: true },
    }),
  )

  app.use('/auth', authRouter({ chainId, client }))

  app.use('/quote', quoteRouter({ clientAuthMiddleware, client, dataSource }))
  app.use('/kyc', kycRouter({ clientAuthMiddleware, dataSource }))
  app.use('/accounts', accountsRouter({ clientAuthMiddleware, dataSource }))
  app.use('/transfer', transferRouter({ clientAuthMiddleware, dataSource }))

  app.use(errorToStatusCode)
  return app
}
