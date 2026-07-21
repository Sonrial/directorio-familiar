export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  if (origin !== new URL(request.url).origin) {
    throw new HttpError(403, "Origen no permitido");
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("Error interno", error instanceof Error ? error.message : "desconocido");
  return Response.json({ error: "Ocurrió un error inesperado" }, { status: 500 });
}

export function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export function normalizeMethod(type: string, value: string) {
  return type === "email" ? value.trim().toLowerCase() : normalizePhone(value.trim());
}

