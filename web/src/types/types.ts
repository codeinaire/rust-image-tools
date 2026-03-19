import type {
  DetectFormatRequest,
  ConvertImageRequest,
  GetDimensionsRequest,
  GetMetadataRequest,
  BenchmarkImagesRequest,
  InitSuccessResponse,
  InitErrorResponse,
  DetectFormatSuccessResponse,
  ConvertImageSuccessResponse,
  GetDimensionsSuccessResponse,
  GetMetadataSuccessResponse,
  BenchmarkResultSuccess,
  BenchmarkResultError,
  BenchmarkCompleteResponse,
  ErrorResponse,
} from './interfaces'

export type WorkerRequest =
  | DetectFormatRequest
  | ConvertImageRequest
  | GetDimensionsRequest
  | GetMetadataRequest
  | BenchmarkImagesRequest

export type WorkerResponse =
  | InitSuccessResponse
  | InitErrorResponse
  | DetectFormatSuccessResponse
  | ConvertImageSuccessResponse
  | GetDimensionsSuccessResponse
  | GetMetadataSuccessResponse
  | BenchmarkResultSuccess
  | BenchmarkResultError
  | BenchmarkCompleteResponse
  | ErrorResponse
