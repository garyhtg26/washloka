import type { AuthScope } from "./auth-ui";

/** Request a custom email, falling back only when the server explicitly says
 * it has no custom sender configured. Authentication tokens never go in URLs. */
export async function requestVerificationEmail(
  token: string,
  scope: AuthScope,
  firebaseFallback: () => Promise<void>,
  send: typeof fetch = fetch,
) {
  let response: Response;
  try {
    response = await send("/api/auth/verification-email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scope }),
    });
  } catch {
    throw Object.assign(new Error("Verification email unavailable"), {
      code: "auth/verification-email-failed",
    });
  }
  if (!response.ok) {
    throw Object.assign(new Error("Verification email unavailable"), {
      code: response.status === 429 ? "auth/too-many-requests" : "auth/verification-email-failed",
    });
  }
  const result: unknown = await response.json().catch(() => null);
  const delivery = (result as { delivery?: unknown } | null)?.delivery;
  if (delivery === "firebase") {
    await firebaseFallback();
    return "sent" as const;
  }
  if (delivery === "already-verified") return "already-verified" as const;
  if (delivery !== "custom") {
    throw Object.assign(new Error("Verification email unavailable"), {
      code: "auth/verification-email-failed",
    });
  }
  return "sent" as const;
}
