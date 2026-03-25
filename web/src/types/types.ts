import type {
  DetectFormatRequest,
  ConvertImageRequest,
  GetDimensionsRequest,
  GetMetadataRequest,
  BenchmarkImagesRequest,
  ProcessImageRequest,
  PreviewOperationsRequest,
  InitSuccessResponse,
  InitErrorResponse,
  DetectFormatSuccessResponse,
  ConvertImageSuccessResponse,
  GetDimensionsSuccessResponse,
  GetMetadataSuccessResponse,
  BenchmarkResultSuccess,
  BenchmarkResultError,
  BenchmarkCompleteResponse,
  ProcessImageSuccessResponse,
  PreviewOperationsSuccessResponse,
  ErrorResponse,
} from './interfaces'

export type WorkerRequest =
  | DetectFormatRequest
  | ConvertImageRequest
  | GetDimensionsRequest
  | GetMetadataRequest
  | BenchmarkImagesRequest
  | ProcessImageRequest
  | PreviewOperationsRequest

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
  | ProcessImageSuccessResponse
  | PreviewOperationsSuccessResponse
  | ErrorResponse
