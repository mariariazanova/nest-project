import { inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { initClient } from '@ts-rest/core';
import { lastValueFrom } from 'rxjs';
import { contract } from '@suggestify/shared/contract';

export function createTsRestClient(baseUrl = 'http://localhost:3000/v1') {
  const http = inject(HttpClient);

  return initClient(contract, {
    baseUrl,
    baseHeaders: {},
    api: async ({ path, method, headers, body }) => {
      try {
        const url = path;
        const res = await lastValueFrom(
          http.request(method, url, {
            headers: headers as Record<string, string>,
            body:
              typeof body === 'string' ? JSON.parse(body) : (body ?? undefined),
            observe: 'response',
            responseType: 'json',
          }),
        );
        // API gateway wraps responses in { data: T } — unwrap one level
        const gatewayUnwrapped = (res.body as any)?.data ?? res.body;
        // Strip inner { status, body } wrapper if controllers return it directly instead of the payload
        const responseBody =
          gatewayUnwrapped?.status !== undefined &&
          gatewayUnwrapped?.body !== undefined
            ? gatewayUnwrapped.body
            : gatewayUnwrapped;

        return {
          status: res.status,
          body: responseBody,
          headers: new Headers(
            Object.fromEntries(
              res.headers.keys().map((k) => [k, res.headers.get(k) ?? '']),
            ),
          ),
        };
      } catch (err) {
        // Angular throws HttpErrorResponse for 4xx/5xx — re-wrap so ts-rest sees a status code
        if (err instanceof HttpErrorResponse) {
          return {
            status: err.status,
            body: err.error,
            headers: new Headers(),
          };
        }
        throw err;
      }
    },
  });
}
