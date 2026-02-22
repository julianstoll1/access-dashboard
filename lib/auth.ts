import { createSupabaseServerClient } from "./supabase-server";
import { authenticateAndTrackApiKeyFromAuthHeader } from "./apiKeys";

export async function getCurrentUser() {
    const supabase = await createSupabaseServerClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    return user;
}

export async function authenticateApiKeyRequest(request: Request) {
    const authHeader = request.headers.get("authorization");
    return authenticateAndTrackApiKeyFromAuthHeader(authHeader);
}
