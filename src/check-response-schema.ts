import path from 'path'
import { expect, use } from 'chai'
import { chaiPlugin } from 'api-contract-validator'
import { AxiosResponse } from 'axios'
import { loadConfig } from './config'

const { openapiSpec } = loadConfig()
const apiDefinitionsPath = path.join(openapiSpec)
use(chaiPlugin({ apiDefinitionsPath }))

/**
 * Check that the response matches the API schema.
 *
 * Ignores /vX prefix
 */
export function checkResponseSchema(response: AxiosResponse) {
  const versionPrefixMatch = response.request.path.match(/^\/v([0-9]+)/)
  if (versionPrefixMatch) {
    // removes /vX prefix, total hack to get api schema matcher to work
    response.request.path = response.request.path.slice(
      versionPrefixMatch[0].length,
    )
  }
  expect(response).to.matchApiSchema()
}
