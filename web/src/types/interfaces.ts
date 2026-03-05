import { MessageType, ValidFormat } from './enums'

// Request types (main thread → worker)

export interface DetectFormatRequest {
  type: MessageType.DetectFormat;
  id: number;
  data: Uint8Array;
}

export interface ConvertImageRequest {
  type: MessageType.ConvertImage;
  id: number;
  data: Uint8Array;
  targetFormat: ValidFormat;
}

export interface GetDimensionsRequest {
  type: MessageType.GetDimensions;
  id: number;
  data: Uint8Array;
}

// Response types (worker → main thread)

export interface InitSuccessResponse {
  type: MessageType.Init;
  success: true;
  initMs: number;
}

export interface InitErrorResponse {
  type: MessageType.Init;
  success: false;
  error: string;
}

export interface DetectFormatSuccessResponse {
  type: MessageType.DetectFormat;
  id: number;
  success: true;
  format: ValidFormat;
}

export interface ConvertImageSuccessResponse {
  type: MessageType.ConvertImage;
  id: number;
  success: true;
  data: Uint8Array;
  conversionMs: number;
}

export interface GetDimensionsSuccessResponse {
  type: MessageType.GetDimensions;
  id: number;
  success: true;
  width: number;
  height: number;
}

export interface ErrorResponse {
  type: MessageType.Error;
  id: number;
  error: string;
}

export interface ImageDimensions {
  width: number;
  height: number;
}
