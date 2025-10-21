export type ErrorResponse = {
  success: false;
  errorCode: number;
  errorMessage: string;
};

export type SuccessResponse<T = undefined> = {
  success: true;
  data: T;
};
