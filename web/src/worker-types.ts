export enum MessageType {
  Init = "init",
  DetectFormat = "detect_format",
  ConvertImage = "convert_image",
  GetDimensions = "get_dimensions",
  Error = "error",
}

// Request types (main thread → worker)

interface DetectFormatRequest {
  type: MessageType.DetectFormat;
  id: number;
  data: Uint8Array;
}

interface ConvertImageRequest {
  type: MessageType.ConvertImage;
  id: number;
  data: Uint8Array;
  targetFormat: string;
}

interface GetDimensionsRequest {
  type: MessageType.GetDimensions;
  id: number;
  data: Uint8Array;
}

export type WorkerRequest =
  | DetectFormatRequest
  | ConvertImageRequest
  | GetDimensionsRequest;

// Response types (worker → main thread)

interface InitSuccessResponse {
  type: MessageType.Init;
  success: true;
  initMs: number;
}

interface InitErrorResponse {
  type: MessageType.Init;
  success: false;
  error: string;
}

interface DetectFormatSuccessResponse {
  type: MessageType.DetectFormat;
  id: number;
  success: true;
  format: string;
}

interface ConvertImageSuccessResponse {
  type: MessageType.ConvertImage;
  id: number;
  success: true;
  data: Uint8Array;
}

interface GetDimensionsSuccessResponse {
  type: MessageType.GetDimensions;
  id: number;
  success: true;
  width: number;
  height: number;
}

interface ErrorResponse {
  type: MessageType.Error;
  id: number;
  error: string;
}

export type WorkerResponse =
  | InitSuccessResponse
  | InitErrorResponse
  | DetectFormatSuccessResponse
  | ConvertImageSuccessResponse
  | GetDimensionsSuccessResponse
  | ErrorResponse;

export interface ImageDimensions {
  width: number;
  height: number;
}
