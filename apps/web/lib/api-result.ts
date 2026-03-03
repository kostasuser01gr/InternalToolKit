import { createErrorId, withObservabilityHeaders } from "@/lib/http-observability";

export type ApiError = {
  code: string;
  message: string;
  errorId: string;
};

export type ApiResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: ApiError;
    };

type ApiSuccessInit = {
  requestId: string;
  status?: number;
  headers?: HeadersInit;
};

type ApiErrorInit = {
  requestId: string;
  code: string;
  message: string;
  status?: number;
  headers?: HeadersInit;
};

export function apiSuccess<T>(data: T, init: ApiSuccessInit) {
  const responseInit: ResponseInit = {
    status: init.status ?? 200,
    ...(init.headers ? { headers: init.headers } : {}),
  };

  return Response.json(
    {
      ok: true,
      data,
    } satisfies ApiResult<T>,
    withObservabilityHeaders(responseInit, init.requestId),
  );
}

export function apiError(init: ApiErrorInit) {
  const errorId = createErrorId();
  const responseInit: ResponseInit = {
    status: init.status ?? 500,
    ...(init.headers ? { headers: init.headers } : {}),
  };

  return Response.json(
    {
      ok: false,
      error: {
        code: init.code,
        message: init.message,
        errorId,
      },
    } satisfies ApiResult<never>,
    withObservabilityHeaders(responseInit, init.requestId, errorId),
  );
}
