type QueryPayload = {
  data: any;
  error: null;
};

function createQueryProxy(payload: QueryPayload = { data: [], error: null }) {
  const promise = Promise.resolve(payload);

  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return promise.then.bind(promise);
        if (prop === "catch") return promise.catch.bind(promise);
        if (prop === "finally") return promise.finally.bind(promise);

        if (prop === "maybeSingle" || prop === "single") {
          return () => createQueryProxy({ data: null, error: null });
        }

        return (..._args: any[]) => proxy;
      },
    }
  );

  return proxy;
}

export function createEmptySupabaseClient() {
  const emptyQuery = createQueryProxy();

  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: { message: "Supabase is not configured." },
      }),
    },
    from: () => emptyQuery,
    rpc: () => createQueryProxy({ data: null, error: null }),
  } as any;
}
