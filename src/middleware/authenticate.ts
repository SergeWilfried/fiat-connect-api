import express from 'express'
import * as dotenv from 'dotenv'

import {
  AuthenticationConfig,
  ClientAuthStrategy,
  FiatConnectError,
  UnauthorizedError,
} from '../types'

dotenv.config()

/// TODO: get api key from configuration
const EXPECTED_API_KEY = process.env.API_KEY
export const COINMARKETCAP_KEY = process.env.COINMARKETCAP_KEY

function doNothingMiddleware(
  _req: express.Request,
  _res: express.Response,
  next: express.NextFunction,
) {
  next()
}

function verifyClientKeyMiddleware(
  _req: express.Request,
  _res: express.Response,
  _next: express.NextFunction,
) {
  // could be something like `
  if (_req.headers.authorization !== `Bearer ${EXPECTED_API_KEY}`)
    throw new Error('Missing api key')
  _next()
}

export function getClientAuthMiddleware(
  authConfig: AuthenticationConfig,
): express.RequestHandler[] {
  switch (authConfig.clientAuthStrategy) {
    case ClientAuthStrategy.Optional:
      // Checks the authorization header for a client key, but does not require one; if present, validates that it's a recognized key.
      return [doNothingMiddleware]
    case ClientAuthStrategy.Required:
      // Requires that the authorization header contains a recognized client key.
      return [verifyClientKeyMiddleware]
    default:
      throw new Error(
        `Auth strategy does not have a handler defined: ${authConfig.clientAuthStrategy}`,
      )
  }
}

export function siweAuthMiddleware(
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction,
) {
  if (!req.session.siwe) {
    throw new UnauthorizedError()
  }
  if (new Date() > new Date(req.session.siwe.expirationTime!)) {
    throw new UnauthorizedError(FiatConnectError.SessionExpired)
  }
  next()
}
