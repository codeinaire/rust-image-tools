import type {
  DetectFormatRequest,
  ConvertImageRequest,
  GetDimensionsRequest,
  BenchmarkImagesRequest,
  InitSuccessResponse,
  InitErrorResponse,
  DetectFormatSuccessResponse,
  ConvertImageSuccessResponse,
  GetDimensionsSuccessResponse,
  BenchmarkResultSuccess,
  BenchmarkResultError,
  BenchmarkCompleteResponse,
  ErrorResponse,
} from './interfaces'

export type WorkerRequest =
  | DetectFormatRequest
  | ConvertImageRequest
  | GetDimensionsRequest
  | BenchmarkImagesRequest

export type WorkerResponse =
  | InitSuccessResponse
  | InitErrorResponse
  | DetectFormatSuccessResponse
  | ConvertImageSuccessResponse
  | GetDimensionsSuccessResponse
  | BenchmarkResultSuccess
  | BenchmarkResultError
  | BenchmarkCompleteResponse
  | ErrorResponse
