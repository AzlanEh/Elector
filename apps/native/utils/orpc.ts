import type { AppRouterClient } from "@elector/api/routers/index";
import { env } from "@elector/env/native";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";

const IDENTITY_KEY = "elector.verified-identity";

type StoredIdentity = {
  voterToken?: string;
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      console.log(error);
    },
  }),
});

export const link = new RPCLink({
  url: `${env.EXPO_PUBLIC_SERVER_URL}/rpc`,
  fetch: async (input, init) => {
    const request = new Request(input, init as RequestInit);
    const raw = await SecureStore.getItemAsync(IDENTITY_KEY);

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StoredIdentity;
        if (parsed.voterToken) {
          request.headers.set("authorization", `Bearer ${parsed.voterToken}`);
        }
      } catch {
        // ignore malformed local identity payload
      }
    }

    return fetch(request);
  },
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
