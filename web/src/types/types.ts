import type {
  DetectFormatRequest,
  ConvertImageRequest,
  GetDimensionsRequest,
  InitSuccessResponse,
  InitErrorResponse,
  DetectFormatSuccessResponse,
  ConvertImageSuccessResponse,
  GetDimensionsSuccessResponse,
  ErrorResponse,
} from './interfaces'

export type WorkerRequest =
  | DetectFormatRequest
  | ConvertImageRequest
  | GetDimensionsRequest

export type WorkerResponse =
  | InitSuccessResponse
  | InitErrorResponse
  | DetectFormatSuccessResponse
  | ConvertImageSuccessResponse
  | GetDimensionsSuccessResponse
  | ErrorResponse
