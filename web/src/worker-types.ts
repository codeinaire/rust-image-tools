// Request types (main thread → worker)

interface DetectFormatRequest {
  type: "detect_format";
  id: number;
  data: Uint8Array;
}

interface ConvertImageRequest {
  type: "convert_image";
  id: number;
  data: Uint8Array;
  targetFormat: string;
}

interface GetDimensionsRequest {
  type: "get_dimensions";
  id: number;
  data: Uint8Array;
}

export type WorkerRequest =
  | DetectFormatRequest
  | ConvertImageRequest
  | GetDimensionsRequest;

// Response types (worker → main thread)

interface InitSuccessResponse {
  type: "init";
  success: true;
  initMs: number;
}

interface InitErrorResponse {
  type: "init";
  success: false;
  error: string;
}

interface DetectFormatSuccessResponse {
  type: "detect_format";
  id: number;
  success: true;
  format: string;
}

interface ConvertImageSuccessResponse {
  type: "convert_image";
  id: number;
  success: true;
  data: Uint8Array;
}

interface GetDimensionsSuccessResponse {
  type: "get_dimensions";
  id: number;
  success: true;
  width: number;
  height: number;
}

interface ErrorResponse {
  type: "error";
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
